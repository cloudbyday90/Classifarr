# Policy Engine Architecture

## Overview

The Policy Engine is the core classification component in Classifarr v0.37.0. It replaces the previous rule-based system with a hybrid, transparent, and configurable approach that combines multiple signal sources to determine the best library for each media item.

## Core Philosophy

**Formula First, AI Second**

The Policy Engine follows a "formula calculates, AI validates" approach:

1. **Formula-based scoring** provides the primary classification signal
2. **AI validation** confirms or adjusts when confidence is medium
3. **User prompts** handle edge cases and build learning data

This approach is:
- **Transparent**: Users see exactly why items were classified
- **Efficient**: Reduces AI API calls by 60-85%
- **Configurable**: Adjust weights and thresholds per policy
- **Explainable**: Full breakdown of reasoning

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      New Item Arrives                       │
│                (from Overseerr, manual, etc.)               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Authoritative Signal Check                     │
│  ✓ Already in media server (source_library)                │
│  ✓ User previously corrected (manual_correction)           │
│  ✓ Exact TMDB match with high confidence                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                  100% match?
                   ┌───┴───┐
                  Yes      No
                   │        │
                   │        ▼
                   │  ┌─────────────────────────────────────┐
                   │  │   Get All Active Policies           │
                   │  │   (for target media type)           │
                   │  └────────────┬────────────────────────┘
                   │               │
                   │               ▼
                   │  ┌─────────────────────────────────────┐
                   │  │      Evaluate Each Policy           │
                   │  │                                     │
                   │  │  ┌──────────────────────────────┐  │
                   │  │  │  1. Score Presets            │  │
                   │  │  │     - 168 content definitions│  │
                   │  │  │     - Genre, rating, keyword │  │
                   │  │  │     - Studio, language, year │  │
                   │  │  └──────────────────────────────┘  │
                   │  │               │                     │
                   │  │               ▼                     │
                   │  │  ┌──────────────────────────────┐  │
                   │  │  │  2. Score Patterns           │  │
                   │  │  │     - Auto-discovered        │  │
                   │  │  │     - User-approved          │  │
                   │  │  │     - Confidence-based       │  │
                   │  │  └──────────────────────────────┘  │
                   │  │               │                     │
                   │  │               ▼                     │
                   │  │  ┌──────────────────────────────┐  │
                   │  │  │  3. Score RAG                │  │
                   │  │  │     - Embedding similarity   │  │
                   │  │  │     - Past classifications   │  │
                   │  │  │     - Graceful fallback      │  │
                   │  │  └──────────────────────────────┘  │
                   │  │               │                     │
                   │  │               ▼                     │
                   │  │  ┌──────────────────────────────┐  │
                   │  │  │  4. Score History            │  │
                   │  │  │     - Similar items          │  │
                   │  │  │     - Accuracy track record  │  │
                   │  │  └──────────────────────────────┘  │
                   │  │                                     │
                   │  └────────────┬────────────────────────┘
                   │               │
                   │               ▼
                   │  ┌─────────────────────────────────────┐
                   │  │      Apply Weights & Combine        │
                   │  │                                     │
                   │  │  Score = (Preset × 0.40) +          │
                   │  │          (Pattern × 0.25) +         │
                   │  │          (RAG × 0.20) +             │
                   │  │          (History × 0.15)           │
                   │  │                                     │
                   │  │  Maximum: 95% (capped)              │
                   │  └────────────┬────────────────────────┘
                   │               │
                   │               ▼
                   │  ┌─────────────────────────────────────┐
                   │  │      Rank All Policies              │
                   │  │      (by weighted score)            │
                   │  └────────────┬────────────────────────┘
                   │               │
                   │               ▼
                   │  ┌─────────────────────────────────────┐
                   │  │      Determine Action               │
                   │  │                                     │
                   │  │  ≥85%: AUTO_CLASSIFY                │
                   │  │  60-84%: PROMPT_CONFIRM             │
                   │  │  40-59%: PROMPT_SELECT              │
                   │  │  <40%: MANUAL_CLASSIFY              │
                   │  └────────────┬────────────────────────┘
                   │               │
                   ▼               ▼
           ┌─────────────────────────────────────────────────┐
           │              Execute Classification             │
           │                                                 │
           │  Auto: Classify immediately                    │
           │  Prompt: Send to user (Discord/Web)            │
           │  Manual: Flag for manual review                │
           └────────────┬────────────────────────────────────┘
                        │
                        ▼
           ┌─────────────────────────────────────────────────┐
           │          Record Feedback & Learn                │
           │                                                 │
           │  - Log decision to policy_feedback_log          │
           │  - Update learning stats                        │
           │  - Discover new patterns                        │
           │  - Generate tuning suggestions                  │
           └─────────────────────────────────────────────────┘
```

---

## Components

### 1. PolicyEngine Service

**File:** `server/src/services/policyEngine.js`

**Main Functions:**

- `evaluateItem(item)` - Entry point for classification
- `checkAuthoritativeSignals(item)` - Checks for 100% confidence matches
- `evaluatePolicy(policy, item)` - Scores a single policy
- `scorePresets(presets, item)` - Evaluates preset signals
- `scorePatterns(libraryId, item)` - Matches discovered patterns
- `scoreRAG(libraryId, item)` - Semantic similarity scoring
- `scoreHistory(libraryId, item)` - Historical accuracy scoring
- `rankResults(evaluations)` - Sorts policies by score
- `determineAction(ranked)` - Decides auto/prompt/manual

### 2. FeedbackAnalysis Service

**File:** `server/src/services/feedbackAnalysis.js`

**Responsibilities:**

- Record user decisions and corrections
- Analyze classification patterns
- Detect systematic failures
- Generate tuning suggestions
- Update learning statistics
- Trigger pattern discovery

### 3. PromptBuilder Service

**File:** `server/src/services/promptBuilder.js`

**Responsibilities:**

- Generate context-rich user prompts
- Explain classification uncertainty
- Build reason options
- Create pattern learning options
- Format for Discord and Web UI

### 4. LegacyMigration Service

**File:** `server/src/services/legacyMigration.js`

**Responsibilities:**

- Analyze legacy rules
- Suggest preset equivalents
- Convert rules to policy overrides
- Track migration progress

---

## Signal Evaluation

### Preset Scoring

Presets define content profiles using JSONB signals:

```javascript
{
  "certifications": { "mode": "include", "values": ["G", "PG"] },
  "genres": { "mode": "require_any", "values": ["Animation", "Family"], "weight": 0.8 },
  "keywords": { "mode": "prefer", "values": ["kids", "children"] },
  "studios": { "mode": "prefer", "values": ["Pixar", "Disney"] },
  "release_year": { "min": 2000, "max": 2024 },
  "vote_average": { "min": 6.5 },
  "runtime": { "min": 60, "max": 180 },
  "language": { "mode": "prefer", "values": ["en"] },
  "media_type": { "mode": "require", "value": "movie" }
}
```

**Scoring Logic:**

1. **Certifications**: Filter by rating (include/exclude/max modes)
2. **Genres**: Match required/preferred genres
3. **Keywords**: Detect keywords in title/overview
4. **Studios**: Match production companies
5. **Year/Rating/Runtime**: Range-based filtering
6. **Language**: Language preferences
7. **Media Type**: Movie vs TV filtering

Each signal contributes a weighted sub-score. Signals are combined using policy's `combination_mode`:

- `best_match`: Highest single signal
- `average`: Mean of all signals
- `weighted_average`: Weighted mean
- `require_all`: All signals must match

### Pattern Scoring

Patterns are auto-discovered from user feedback:

```sql
SELECT * FROM discovered_patterns
WHERE pattern_type = 'studio'
  AND pattern_value = 'A24'
  AND target_library_id = 'indie_movies'
  AND confidence >= 70
  AND status = 'approved';
```

**Confidence Calculation:**

```javascript
confidence = (correct_predictions / total_uses) * 100
```

Patterns learn through reinforcement:
- **Correct**: +5% confidence (capped at 95%)
- **Incorrect**: -5% confidence
- **Auto-deprecate**: Below 30% confidence

### RAG Scoring

Uses vector embeddings for semantic similarity:

1. Generate embedding for new item
2. Query vector store for similar items
3. Filter by target library
4. Calculate similarity scores
5. Weight by historical accuracy

**Graceful Fallback:**

- If embedding service unavailable → score = 0
- If insufficient history → score = 0
- Does not block classification

### History Scoring

Tracks accuracy per policy:

```sql
SELECT 
  COUNT(*) FILTER (WHERE was_correct = true) * 100.0 / COUNT(*) as accuracy
FROM policy_feedback_log
WHERE policy_id = $1
  AND created_at > NOW() - INTERVAL '30 days';
```

Higher historical accuracy → higher weight in scoring.

---

## Thresholds & Actions

### Default Thresholds

```javascript
{
  auto_classify_threshold: 85,    // Auto-process above 85%
  prompt_threshold: 60,            // Prompt between 60-84%
  ai_validation_threshold: 90,    // Skip AI above 90%
  trust_patterns: true,            // Use pattern signals
  trust_rag: true,                 // Use RAG signals
  trust_history: true              // Use history signals
}
```

### Action Determination

| Score Range | Action | Behavior |
|-------------|--------|----------|
| ≥85% | `AUTO_CLASSIFY` | Immediate classification |
| 60-84% | `PROMPT_CONFIRM` | "Is this correct?" |
| 40-59% | `PROMPT_SELECT` | "Pick from top 3" |
| <40% | `MANUAL_CLASSIFY` | Full manual selection |

### AI Validation

When score is 60-90%:

1. Formula provides top suggestion
2. AI validates decision
3. AI can override if confident
4. Both signals logged for learning

---

## Learning Loop

### Feedback Capture

Every classification decision is logged:

```javascript
{
  policy_id: 123,
  tmdb_id: 12345,
  original_scores: { preset: 0.8, pattern: 0.6, rag: 0.5, history: 0.7 },
  top_suggestions: [{ library_id: 'movies', score: 0.85 }],
  user_choice: 'movies',
  was_correction: false,
  user_reasons: ['genre_match'],
  patterns_created: [{ type: 'studio', value: 'A24' }],
  response_time_ms: 1500
}
```

### Pattern Discovery

Triggered after feedback:

```javascript
// Auto-discover if studio appears 3+ times for same library
if (studio_count >= 3 && accuracy >= 70%) {
  await createPattern({
    type: 'studio',
    value: 'A24',
    target_library: 'indie_movies',
    confidence: accuracy,
    status: accuracy >= 85 ? 'approved' : 'pending'
  });
}
```

### Tuning Suggestions

Generated from feedback analysis:

```javascript
// Example: Underperforming preset
if (preset_accuracy < 60% && sample_size >= 10) {
  await createSuggestion({
    type: 'remove_preset',
    preset_id: 'family_friendly',
    confidence: 'high',
    impact: 'Removing this preset may improve accuracy by 15%',
    supporting_feedback: [...]
  });
}
```

### Statistics Tracking

Updated after each decision:

```sql
UPDATE policy_learning_stats
SET total_decisions = total_decisions + 1,
    auto_classified = auto_classified + (action = 'AUTO_CLASSIFY' ? 1 : 0),
    corrections = corrections + (was_correction ? 1 : 0),
    accuracy_rate = (correct / total_decisions) * 100,
    trend = calculate_trend(accuracy_7day, accuracy_30day)
WHERE policy_id = $1;
```

---

## Performance Considerations

### Caching

- Active policies cached in memory
- Preset definitions cached (rarely change)
- Pattern cache invalidated on approval/rejection

### Database Optimization

- Indexes on foreign keys
- GIN indexes on JSONB columns
- Partial indexes on status columns
- Materialized views for stats (future)

### Scoring Optimization

- Early exit for authoritative signals (100%)
- Parallel signal evaluation
- Skip disabled signal types
- Cap expensive operations (RAG)

---

## Configuration

### Global Defaults

```javascript
// In ai_provider_config table
{
  default_preset_weight: 0.40,
  default_pattern_weight: 0.25,
  default_rag_weight: 0.20,
  default_history_weight: 0.15,
  default_auto_threshold: 85,
  default_prompt_threshold: 60
}
```

### Per-Policy Overrides

```javascript
// In library_policies table
{
  preset_weight: 0.50,        // Override global default
  pattern_weight: 0.30,
  rag_weight: 0.10,
  history_weight: 0.10,
  auto_classify_threshold: 90,  // More conservative
  prompt_threshold: 70
}
```

---

## Error Handling

### Graceful Degradation

- If RAG fails → continue with other signals
- If pattern DB query fails → skip patterns
- If history query fails → skip history scoring
- Always return a result (may be low confidence)

### Logging

```javascript
// All operations logged with context
logger.info('PolicyEngine evaluation', {
  item_id: tmdb_id,
  policies_evaluated: 3,
  top_score: 0.87,
  action: 'AUTO_CLASSIFY',
  duration_ms: 120
});
```

---

## Future Enhancements

### Planned Features

1. **Multi-policy combination modes**
   - Consensus voting
   - Weighted ensemble
   - Fallback chains

2. **Dynamic weight adjustment**
   - Auto-tune weights based on accuracy
   - A/B testing for weight changes
   - Bayesian optimization

3. **Advanced pattern types**
   - Director patterns
   - Cast patterns
   - Temporal patterns (release season)

4. **Real-time learning**
   - Immediate pattern updates
   - Online learning algorithms
   - Continuous optimization

---

## Related Documentation

- [API Reference](../api/README.md)
- [Preset Reference](../presets/README.md)
- [Migration Guide](../migration/v037.md)
- [Feedback Analysis](./feedback-analysis.md)
