# Implementation Plan: Genre-Level Learning from Policy Clarification

**Status:** Draft  
**Prerequisite:** Production diagnosis complete (see session context)

---

## 1. Problem Statement

Documentary movies are stuck in a recurring loop:

1. Item arrives → formula engine scores 5–6% confidence for all libraries
2. PolicyEngine routes to `awaiting_decision` (Needs Attention)
3. User sees policy question → clicks "Movies"
4. `resolvePolicyQuestion()` writes an `exact_match` pattern for that specific TMDB ID
5. **Next documentary starts the exact same loop from scratch**

The system has no memory of the genre → library decision. Every Documentary is treated as a new, unknown item.

### Why the score is 5–6%

The formula engine computes (with default weights):

| Component | Score | Weight | Contribution |
|-----------|-------|--------|--------------|
| Profile   | 0     | 0.40   | 0 pts        |
| Rules     | 0     | 0.30   | 0 pts        |
| RAG       | 0     | 0.20   | 0 pts        |
| History   | 50*   | 0.10   | 5 pts        |

*History returns 50 (neutral) when no prior TMDB ID record exists.

- **Profile = 0**: The `library_profiles` for Movies shows `"Documentary": 0` (stale snapshot)—even though 63 Documentary movies exist in the library. Even with a fresh profile, the profile score contribution is modest.
- **Rules = 0**: No `library_custom_rules` rows configured.
- **RAG = 0**: No prior confirmed Documentary embeddings in the vector index, so semantic search returns 0 relevant results → RAG cannot contribute.

---

## 2. Root Cause Analysis

### 2a. The Dead Code Gap

`classification.js` contains this at Step 2 of its classification pipeline:

```javascript
// Step 2: Check learned patterns (high confidence)
const learnedPattern = await this.checkLearnedPatterns(metadata);
if (learnedPattern && learnedPattern.confidence >= 80) {
  return {
    library: libraries.find(l => l.id === learnedPattern.library_id),
    confidence: learnedPattern.confidence,
    method: 'learned_pattern',
    reason: 'Matched learned pattern from previous corrections',
    libraries: libraries,
  };
}
```

And `checkLearnedPatterns()` queries:

```javascript
SELECT library_id, confidence FROM learning_patterns 
WHERE pattern_type = 'genre_pattern' AND success_rate >= 70
ORDER BY confidence DESC, usage_count DESC LIMIT 1
```

**Problem**: No code ever inserts a row with `pattern_type = 'genre_pattern'`. This step always returns `null`. The intended mechanism exists but was never connected.

### 2b. `resolvePolicyQuestion()` only writes item-level patterns

When a user confirms "This documentary → Movies library", `clarificationService.resolvePolicyQuestion()` writes:

```sql
INSERT INTO learning_patterns (tmdb_id, media_type, library_id, pattern_type, ...)
VALUES (12345, 'movie', 58, 'exact_match', ...)
```

This is TMDB-ID specific. It helps the *same item* if it ever appears again, but teaches the system nothing about Documentaries in general.

### 2c. `checkLearnedPatterns()` doesn't filter by item genres

Even if genre patterns were written, the current query doesn't pass in the item's genres—it just returns the first `genre_pattern` row with `success_rate >= 70`. This bug means it would misroute items once multiple genre patterns exist.

---

## 3. Design Decision

**Chosen approach: Fix the `genre_pattern` learning path (the designed mechanism)**

This approach:
- Uses the existing `learning_patterns` table and `genre_pattern` type the code already queries
- Keeps genre signals separate from user-visible Rules Builder (`library_custom_rules`)
- Preserves the authoritative hierarchy: corrections > exact_match > genre_pattern > formula
- Is minimal in scope—connects two endpoints of a designed-but-unfinished feature

**Alternative considered: Auto-create `library_custom_rules`**  
Rejected because auto-created rules would appear in the Rules Builder UI and be confusing to users. However, this is a valid alternative if more weight is needed in the formula score.

---

## 4. Phases

### Phase 0: Refresh Library Profile (Quick Win, ~10 min)

**The stale profile is a separate bug that should be fixed regardless.**

The `library_profiles` table shows `"Documentary": 0` for the Movies library despite 63 real items having that genre. This causes the formula engine's profile component to score 0 for any Documentary, even in a library that demonstrably contains them.

**Fix**: Trigger a profile regeneration for all libraries. This is an admin action:
- **Option A (Admin UI)**: Navigate to Settings → Libraries → "Refresh Library Profiles" (if this button exists)
- **Option B (Scheduled)**: Profile regeneration already runs on a schedule in `scheduler.js`—check if it's running and if the schedule was missed after initial sync
- **Option C (SQL)**: Call `libraryProfileService.generateAllProfiles()` via the diagnostics endpoint

After regeneration, the Movies library profile will show `"Documentary": 63`, giving the formula engine a valid profile signal. This alone will not fully solve the problem (profile score capped at 15 pts × 0.40 weight = 6 pts), but it's a necessary correctness fix.

---

### Phase 1: Schema Migration (New Migration File)

**File**: `database/migrations/YYYYMMDD_HHMMSS_genre_pattern_index.sql`

Add a partial unique index to prevent duplicate genre patterns for the same genre+media_type+library combination. The existing unique constraint `(tmdb_id, media_type, pattern_type)` is designed for `exact_match` rows (where TMDB ID is the key). Genre patterns have NULL `tmdb_id`, so we need a separate mechanism.

```sql
-- Unique index for genre patterns (tmdb_id is NULL for these rows)
-- Allows ON CONFLICT upsert by genre + media_type + library combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_patterns_genre_unique
  ON learning_patterns (
    (pattern_data->>'genre'),
    media_type,
    library_id
  )
  WHERE pattern_type = 'genre_pattern';
```

This is a **partial unique index** (the `WHERE` clause) — it only enforces uniqueness among `genre_pattern` rows, leaving `exact_match` rows unaffected.

---

### Phase 2: Fix `checkLearnedPatterns()` (classification.js)

**File**: `server/src/services/classification.mjs`

The current method ignores `_metadata` entirely (underscored parameter is a hint it was stubbed). Fix it to filter by the item's actual genres and use the new `pattern_data->>'genre'` column for matching.

**Before:**
```javascript
async checkLearnedPatterns(_metadata) {
  const result = await db.query(
    `SELECT library_id, confidence FROM learning_patterns 
     WHERE pattern_type = 'genre_pattern' AND success_rate >= 70
     ORDER BY confidence DESC, usage_count DESC LIMIT 1`
  );
  return result.rows[0] || null;
}
```

**After:**
```javascript
async checkLearnedPatterns(metadata) {
  const genres = metadata.genres || [];
  if (genres.length === 0) return null;

  const mediaType = metadata.media_type || metadata.mediaType || null;

  const result = await db.query(
    `SELECT library_id, confidence, usage_count
     FROM learning_patterns 
     WHERE pattern_type = 'genre_pattern'
       AND success_rate >= 70
       AND ($1::text[] IS NULL OR (pattern_data->>'genre') = ANY($1::text[]))
       AND ($2::text IS NULL OR media_type = $2)
     ORDER BY usage_count DESC, confidence DESC
     LIMIT 1`,
    [genres, mediaType]
  );
  return result.rows[0] || null;
}
```

**Logic**: "Among confirmed genre patterns with ≥70% success rate, find one that matches any of this item's genres and media type. Prefer patterns with more usage (more user confirmations = more trustworthy)."

---

### Phase 3: Write Genre Patterns from `resolvePolicyQuestion()` (clarificationService.js)

**File**: `server/src/services/clarificationService.mjs`

After writing the existing `exact_match` pattern, also extract genres from the item metadata and upsert a `genre_pattern` row for each genre.

**Location**: Inside `resolvePolicyQuestion()`, after the `exact_match` INSERT (around line 625).

**Addition:**
```javascript
// After the existing exact_match INSERT...

// Write genre-level patterns so future items with the same genre are learned
const itemGenres = (metadata.genres || []);
if (itemGenres.length > 0) {
  for (const genre of itemGenres) {
    const genreLower = genre.toLowerCase();
    await client.query(
      `INSERT INTO learning_patterns
         (tmdb_id, media_type, library_id, pattern_type, pattern_data,
          confidence, usage_count, success_rate, created_by)
       VALUES (NULL, $1, $2, 'genre_pattern',
               jsonb_build_object('genre', $3),
               85, 1, 100.00, $4)
       ON CONFLICT ((pattern_data->>'genre'), media_type, library_id)
         WHERE pattern_type = 'genre_pattern'
       DO UPDATE SET
         usage_count  = learning_patterns.usage_count + 1,
         confidence   = LEAST(learning_patterns.confidence + 2, 95),
         updated_at   = NOW()`,
      [classification.media_type, selectedLibraryId, genreLower, resolvedBy]
    );
  }
  logger.info('Wrote genre patterns from policy resolution', {
    genres: itemGenres,
    libraryId: selectedLibraryId,
    mediaType: classification.media_type
  });
}
```

**Key design choices:**
- Initial confidence = **85** (above the ≥80 threshold in `checkLearnedPatterns` result check, so it immediately becomes authoritative)
- Initial `usage_count` = 1, `success_rate` = 100
- Each subsequent user confirmation increments `usage_count` and nudges confidence up to 95 (capped)
- `confidence` caps at 95 (reserved; 100 is for `exact_match` / manual corrections)
- Genre stored lowercase to match how `checkLearnedPatterns` will compare

---

### Phase 4: Backfill from Existing Classification History

Users who have already confirmed documentaries → Movies via policy questions have `classification_history` rows with `method = 'manual_classification'` and the genre in `metadata`. These should generate genre patterns retroactively.

**Approach A (One-time admin script)**:

New script at `scripts/backfill_genre_patterns.js`:

```javascript
// Reads all classification_history rows where:
//   method = 'manual_classification' OR method = 'corrected'
//   AND metadata->genres IS NOT NULL
// Then upserts genre_pattern rows into learning_patterns
// for each genre × library_id combination found
```

**Approach B (Migration-time SQL)**:

Include a backfill in the Phase 1 migration:

```sql
INSERT INTO learning_patterns (tmdb_id, media_type, library_id, pattern_type, pattern_data, confidence, usage_count, success_rate, created_by)
SELECT 
  NULL,
  ch.media_type,
  ch.library_id,
  'genre_pattern',
  jsonb_build_object('genre', lower(g.genre)),
  85,
  COUNT(*),
  100.00,
  'backfill'
FROM classification_history ch
CROSS JOIN LATERAL jsonb_array_elements_text(ch.metadata->'genres') AS g(genre)
WHERE ch.method IN ('manual_classification', 'corrected')
  AND ch.library_id IS NOT NULL
  AND ch.metadata->'genres' IS NOT NULL
GROUP BY ch.media_type, ch.library_id, lower(g.genre)
ON CONFLICT ((pattern_data->>'genre'), media_type, library_id)
  WHERE pattern_type = 'genre_pattern'
DO UPDATE SET
  usage_count = EXCLUDED.usage_count,
  updated_at = NOW();
```

**Recommendation**: Use Approach B (migration-time SQL) since it runs automatically on deploy and doesn't require a separate script execution.

---

### Phase 5: Tests

#### 5a. `classification.test.js` or `classificationService.test.js`
- `checkLearnedPatterns()` returns null when metadata has no genres
- `checkLearnedPatterns()` returns null when no matching genre_pattern rows exist
- `checkLearnedPatterns()` returns the correct library when a matching genre_pattern exists with success_rate ≥ 70
- `checkLearnedPatterns()` skips rows where success_rate < 70
- `checkLearnedPatterns()` filters by media_type correctly

#### 5b. `clarification.test.js`
- `resolvePolicyQuestion()` writes genre_pattern rows when metadata.genres is populated
- `resolvePolicyQuestion()` writes one genre_pattern per genre
- `resolvePolicyQuestion()` skips genre pattern writing when metadata.genres is empty
- Genre stored lowercase in pattern_data

---

## 5. Expected Outcome After Implementation

When a user confirms "Documentary movie → Movies library":

1. An `exact_match` pattern is written for that TMDB ID (existing behavior, unchanged)
2. **NEW**: A `genre_pattern` row is written: `{genre: 'documentary'} + movie + library_id=58`

When the **next** Documentary movie arrives for classification:
1. `checkExactMatch()` → no match (different TMDB ID)
2. `checkLearnedPatterns()` → **MATCH**: `genre_pattern` for 'documentary' + 'movie' → Movies library → returns `{library_id: 58, confidence: 85}`
3. Since confidence ≥ 80, **bypasses AI entirely**
4. Result: **85% confidence, method='learned_pattern'**, routes directly to Movies

Each additional user confirmation on any documentary escalates the `usage_count` and inches confidence toward 95, making the pattern more trustworthy over time.

---

## 6. Files Changed

| File | Change |
|------|--------|
| `database/migrations/YYYYMMDD_genre_pattern_index.sql` | New partial unique index + optional backfill SQL |
| `server/src/services/classification.mjs` | Fix `checkLearnedPatterns()` to use metadata |
| `server/src/services/clarificationService.mjs` | Write `genre_pattern` rows in `resolvePolicyQuestion()` |
| `server/src/__tests__/classification.test.mjs` (or similar) | New tests for `checkLearnedPatterns()` |
| `server/src/__tests__/clarification.test.mjs` | New tests for genre pattern writing |
| `database/schema/current.sql` | Regenerate after migration |

> **Not changed**: `formulaEngine.js`, `libraryProfileService.js`, `library_custom_rules`. The genre pattern path bypasses the formula engine entirely (it's a high-priority Step 2 shortcut in classification.js), so no formula weight changes are needed.

---

## 7. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| False positives: "Horror" tagged movie goes to wrong library | Low | Pattern only writes for the library the *user confirmed*; success_rate decay would catch errors |
| Same genre exists in multiple libraries (e.g., "Action" in Movies AND Kids Movies) | Medium | Each genre+media_type+library_id combination is a separate row; the query returns the one with highest usage_count (most user confirmations win) |
| Partial unique index not supported on JSONB in older Postgres | Low | Postgres 12+ supports this; our schema uses many other JSONB expressions |
| Backfill SQL fails if metadata column schema differs | Low | Guard with `WHERE jsonb_typeof(ch.metadata->'genres') = 'array'` |

---

## 8. Out of Scope

- Changing formula engine weights
- Adding genre signals to the `scoreProfile()` path (profile refresh in Phase 0 covers this)
- UI changes to surface genre patterns to users (the Rules Builder is separate)
- Handling items with NO genres (current behavior: falls through to AI—acceptable)
