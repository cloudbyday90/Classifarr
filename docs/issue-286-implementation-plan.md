# Issue 286 Implementation Plan

Title: RAG Enhancement: Graph and Structured Retrieval for Context-Aware Recommendations

Owner: Classifarr team
Status: **Planning** - Not yet scheduled for release
Date: 2026-03-09
Issue: https://github.com/cloudbyday90/Classifarr/issues/286

## Summary

Augment the existing vector + full-text RAG pipeline with a third, structurally-grounded
retrieval path: **graph retrieval**. Graph retrieval finds past classifications that are
_relationally_ connected to the query item (same franchise/collection, director, studio,
or cast overlap) even when semantic similarity is too low to surface them — for example,
a new film in an established franchise may embed very differently from earlier entries.

The implementation is **Postgres-native**. No external graph database is introduced. Relationship
attributes are denormalized from the existing `metadata jsonb` column into indexed scalar/array
columns on `classification_history`, and graph queries are plain SQL. Results are merged into
the existing Reciprocal Rank Fusion (RRF) pipeline as a third signal track alongside the
existing vector (semantic) and full-text tracks.

## Why

- Pure vector search underperforms on sequels, spin-offs, reboots, and franchise installments.
  A new movie in a series may embed very differently from earlier entries, falling below the
  similarity threshold even though they should share a library destination.
- Structured retrieval on `collection_id`, director, studio, and cast overlap is deterministic
  and explainable, unlike vector proximity.
- The data needed is already captured in `metadata jsonb` on every classification; it just
  isn't indexed for relational lookups.
- Leading RAG systems in 2025–2026 use graph or multi-hop retrieval as a recall layer to
  complement vector search (references: LogRocket RAG Techniques, MDPI Systematic RAG SOTA
  Review 2025, Han et al. "GraphRAG" survey arXiv:2501.00309).
- The approach in this plan exactly matches the **neural-symbolic retrieval** best practice
  for recommendation GraphRAG (Han et al. §6.3): a symbolic retriever (structured SQL on
  relational identifiers) combined with a neural retriever (vector embeddings), fused via RRF.
  This pattern is confirmed as providing the best trade-off between rule-based precision and
  neural-based adaptability.

## Out of Scope

- External graph database (Neo4j, RedisGraph, or similar). Postgres is sufficient and no
  new stateful service dependency will be introduced.
- Semantic re-ranking models (cross-encoders). Not needed; RRF fusion is adequate.
- User-facing graph visualizations or relationship explorer UI.
- Restructuring or replacing the existing vector or full-text retrieval paths.
- Any change to how classification decisions are made after retrieval (that is the policy
  engine and AI prompt responsibility, not the retriever).

## Relationship to Existing Architecture

The current `hybridSearch()` pipeline in `server/src/services/ragRetriever.mjs`:

```
[semanticSearch] ──┐
                   ├── RRF fusion ──> ranked results ──> policy/AI context
[fullTextSearch] ──┘
```

After this issue:

```
[semanticSearch] ──┐
[fullTextSearch] ──┼── 3-way RRF fusion ──> ranked results ──> policy/AI context
[graphSearch]    ──┘
```

`graphSearch()` is a new method on `RAGRetriever` that runs one or more SQL queries
against indexed relationship columns then returns scored, ranked candidates. Fusion
weight for graph results is configurable and defaults to a conservative value.

## Data Model Analysis (Current State)

### What already exists

| Signal | Current storage | Indexed for relational query? |
|---|---|---|
| Franchise / collection | `classification_history.collection_id` (INTEGER) | Yes — `idx_classification_history_collection_id` |
| Collection name | `metadata->>'belongs_to_collection'` (jsonb) | No |
| Director | ⚠️ NOT stored — enrichment only captures `cast`, not `crew` | No |
| Primary studio | `metadata->'production_companies'->0->>'name'` (jsonb) | No |
| Cast | `metadata->'cast'` (jsonb array of objects with `.id`, `.name`) | No |
| Genres | `metadata->'genres'` (jsonb array of **strings**, not objects) | No |

### What is needed

Denormalize and index the following relationship attributes as first-class columns so that
graph queries run on B-tree or GIN indexes rather than jsonb expression scans across the
full history table:

| New column | Type | Source in metadata jsonb | Notes |
|---|---|---|---|
| `director_name` | `varchar(255)` | `metadata.director_name` (string, after enrichment fix) | Enrichment function must be updated to extract director at enrichment time (see Phase 0 Finding 2); backfill re-queries TMDB for existing rows |
| `primary_studio_name` | `varchar(255)` | `metadata.production_companies?.[0]?.name` | First company only; normalized to lowercase trim |
| `genre_names` | `text[]` | `metadata.genres` (already string array) | Direct copy; `metadata.genres` stores name strings, not objects — no mapping needed |
| `cast_ids` | `integer[]` | `metadata.cast?.slice(0,5).map(c => c.id)` | Top-5 cast TMDB person IDs; array overlap |
| `cast_names` | `text[]` | `metadata.cast?.slice(0,5).map(c => c.name)` | Top-5 cast names; kept for display without join |

`collection_id` already exists and is indexed — graph queries will reuse it as-is.

## Phase Plan

### Phase 0 — Codebase Audit and Schema Freeze

**Status: COMPLETE — findings documented below.**

Deliverables:
- Audit all paths that write `classification_history` rows to understand which ones populate
  `metadata jsonb` and with what shape (list all callers of INSERT/UPDATE on
  `classification_history`).
- Audit `metadata jsonb` contents in the running database to establish fill-rate for
  `production_companies`, `cast`, `crew`/`director`, `genres`, and `belongs_to_collection`
  across existing rows.
- Document the exact source field names used by TMDB, OMDB, and Jellyfin/Plex/Emby responses
  for director, cast, studio, and genres — these may vary between providers.
- Lock the schema for Phase 1 (column names, types, normalization rules).
- Confirm that `rag_graph_enabled` flag can reuse the existing embedding config table
  (`embedding_config`) without a breaking migration to its settings column surface.

#### Phase 0 Audit Findings

##### Write Paths Enumerated

Four production INSERT paths exist:

| File | Path | Metadata shape | TMDB-enriched? |
|---|---|---|---|
| `server/src/services/classification.mjs:3242` | PRIMARY — all AI/policy-classified items | Full TMDB enrichment (see shape below) | ✅ Yes |
| `server/src/routes/queue.mjs:442` | Manual classification (user resolves a queued task) | Raw task payload from Sonarr/Radarr/Plex hook | ❌ No |
| `server/src/services/queueService.mjs:951` | Source-library "already in library" path | Raw task `enrichPayload` | ❌ No |
| `server/src/services/classification.mjs:3242` (same) | AI re-run / policy recheck paths | Full TMDB enrichment | ✅ Yes |

Three UPDATE paths exist but do **not** modify `metadata`:
- `classification.mjs:297` — POST /corrections — updates `library_id`, `library_name`, `status` only.
- `classification.mjs:624` — status update to `'routed'` only.
- `prompts.mjs:355` — acknowledgement — updates `status`, `library_id`, `confidence` only.

##### `metadata jsonb` Shape — Primary Write Path

The enrichment function (`classification.mjs` ~line 409) maps the TMDB API response to:
```js
{
  tmdb_id:              number,
  media_type:           'movie' | 'tv',
  title:                string,
  original_title:       string,
  year:                 string,           // e.g. '2019'
  overview:             string,
  genres:               string[],         // ⚠️ NAMES ONLY — e.g. ['Action', 'Comedy']
                                           //    NOT objects with .id — see Critical Finding 1
  keywords:             string[],
  certification:        string|null,
  rating:               number,
  popularity:           number,
  original_language:    string,
  poster_path:          string|null,
  backdrop_path:        string|null,
  belongs_to_collection: { id, name, poster_path, backdrop_path } | null,
  production_companies: [{ id, name, logo_path, origin_country }, ...],  // full objects
  cast:                 [{ id, name, character, order, profile_path }, ...] // top 10, full objects
  // ⚠️ crew is NOT stored — see Critical Finding 2
}
```

TMDB requests both movies and TV series with `append_to_response: '...credits'`, so
`details.credits.crew` is available at enrichment time — it is just not extracted into
the metadata object.

##### Critical Finding 1 — `genres` stores names, not IDs

The enrichment code is:
```js
genres: details.genres?.map(g => g.name) || []
```
So `metadata.genres` is `['Action', 'Comedy']`, NOT `[{id: 28, name: 'Action'}, ...]`.

**Impact on plan:** The originally proposed column `genre_ids integer[]` with extraction
rule `metadata.genres?.map(g => g.id)` would always produce `undefined` values for all
existing rows. **Resolution:** replace `genre_ids integer[]` with `genre_names text[]`
(standard GIN with `array_ops`, no `intarray` needed for this column).

##### Critical Finding 2 — `crew` is not stored; director requires enrichment change

`metadata.crew` does not exist in any stored record. The enrichment only captures
`details.credits.cast`, not `details.credits.crew`.

**Impact on plan:** `director_name` extraction from `metadata.crew` will always return
null for all existing rows, and will return null for all new rows until a source is added.

**Resolution:** In Phase 2, update the enrichment function to add `director_name` as a
first-class string field directly (i.e., resolve director at enrichment time rather than
at extraction time):
```js
director_name: details.credits?.crew?.find(c => c.job === 'Director')?.name || null
```
For all rows written after this change, `metadata.director_name` will be available.
For backfill of existing rows: where `tmdb_id IS NOT NULL`, the backfill script must
make a TMDB API call to retrieve `credits.crew` and extract the director name. Where
`tmdb_id IS NULL` (manual/source-library entries), `director_name` remains null —
acceptable fill-rate impact.

##### Critical Finding 3 — `cast` and `production_companies` shape confirmed

`metadata.cast` stores full TMDB cast objects (`.id`, `.name`, `.character`, `.order`) — top 10.
Extraction rules `cast_ids: metadata.cast?.slice(0,5).map(c => c.id)` and
`cast_names: metadata.cast?.slice(0,5).map(c => c.name)` will work correctly for all
enriched rows.

`metadata.production_companies` stores full TMDB company objects (`.id`, `.name`) —
`primary_studio_name: metadata.production_companies?.[0]?.name` will work correctly.

##### Critical Finding 4 — `collection_id` is set by `signalCollector`, not from enriched metadata

`logClassification()` reads `metadata.collectionId || null` (camelCase) to populate the
`collection_id` column. This is NOT populated from `metadata.belongs_to_collection.id`
(the enriched TMDB field). Instead, `signalCollector.checkFranchiseMembership()` makes a
TMDB call, sets `collectionId: collection.id` on the metadata object during signal collection,
and that camelCase value is what lands in the column.

**Impact on plan:** `collection_id` works correctly today for movies with TMDB franchise
membership via the signal collector. The extractor **does not need to handle** `collection_id`
— it's already a first-class indexed column populated through a separate code path. This is
correct and should remain separate from `ragGraphExtractor`.

##### Critical Finding 5 — TV series director: `credits.crew` is unreliable; use `created_by`

TMDB's TV series endpoint (`/tv/{id}?append_to_response=credits`) returns `credits.crew` at
the aggregate series level, which tends to list episode-level crew. There is typically no
`job === 'Director'` entry at the series level for TV shows. The correct TV equivalent is
`details.created_by` — a top-level array of `[{id, name, ...}]` representing the
showrunner/creator(s).

**Impact on plan:** The enrichment fix must branch by `media_type`:
```js
// For movies: find the credited Director in crew
director_name: mediaType === 'movie'
  ? (details.credits?.crew?.find(c => c.job === 'Director')?.name || null)
  : (details.created_by?.[0]?.name || null)   // For TV: use showrunner/creator
```
This affects both:
1. The enrichment function change in Phase 2 (`classification.mjs` ~line 409).
2. The backfill script — TV rows should read `created_by[0].name` from TMDB, not `credits.crew`.

##### Critical Finding 6 — Backfill director name requires TMDB API calls

Because `crew` is not stored in existing `metadata jsonb`, there is no way to extract
`director_name` from rows already in the database without making a fresh TMDB API call for
each row. All rows where `directory_name IS NULL AND tmdb_id IS NOT NULL` need a
`/movie/{id}?append_to_response=credits` (or `/tv/{id}?...`) request.

**Impact on plan:** The legacy TMDB API rate limit of "40 requests every 10 seconds" was
disabled by TMDB on **December 16, 2019** (confirmed from TMDB developer docs, updated
October 2025). The current undocumented limit is "somewhere in the 40 requests per second
range". The backfill script should target a conservative **20 requests per second** and handle
HTTP 429 responses with exponential backoff. Updated timeline at 20 req/s:
- 1,000 rows ≈ 50 seconds
- 5,000 rows ≈ 4 minutes
- 10,000 rows ≈ 8 minutes

The backfill script must implement per-request rate limiting (sleep between batches). This is
separate from and in addition to the generic per-row batch sleep already planned.
Rows where `tmdb_id IS NULL` (manual/source-library entries) skip the TMDB call and remain
`director_name = null` — acceptable.

##### Critical Finding 7 — `formulaEngine.scoreRAG()` bypasses `hybridSearch()`

`formulaEngine.mjs` calls `ragRetriever.semanticSearch()` directly (not `hybridSearch()`).
This code path computes a per-library RAG score as part of the formula engine's signal
weighting and is entirely separate from the main classification RAG loop.

**Impact on plan:** Graph results will **not** flow into formula-based RAG scoring.
This is a deliberate architectural boundary — `formulaEngine` computes a scalar library
score, not top-k retrieval for context. Extending `formulaEngine.scoreRAG()` to incorporate
graph hits is **out of scope** for Issue 286 and can be addressed in a follow-on issue if
data shows that formula scoring is missing franchise signal.

| Relationship field | Primary (AI) | Manual classification | Source library |
|---|---|---|---|
| `cast_ids` / `cast_names` | ~100% (enriched) | 0% | 0% |
| `primary_studio_name` | ~100% (enriched) | 0% | 0% |
| `genre_names` | ~100% (enriched) | 0% | 0% |
| `director_name` | 0% existing / ~100% after enrichment fix | 0% | 0% |
| `collection_id` | Already populated (existing indexed column) | Yes if tmdb_id present | Partial |

##### `embedding_config` Reuse Confirmed

The `embedding_config` table (which is the `ai_provider_config` table in the schema, single row,
id=1) stores all RAG settings. The Phase 1 migration adding `rag_graph_*` columns to this
table is identical to how all existing RAG settings are stored. No new table needed.

##### RAG Settings UI Confirmed

`client/src/views/RAGSettings.vue` uses a tab component pattern with 5 existing tabs:
Overview, Text Embeddings, Image Embeddings, Backfill, Advanced. Each tab is a separate
component in `client/src/views/rag/`. Phase 4 UI work must add a new `GraphTab.vue` in
that directory and register it in `RAGSettings.vue`.

##### `hybridSearch()` Extension Point Confirmed

The current `hybridSearch()` method in `ragRetriever.mjs` (line 539) produces results via:
```js
results = this.calculateRRF(semanticMatches, textMatches, rrfK);
```
Adding a third `graphSearch()` call before this line and passing graph matches to a
3-way RRF is a minimal, surgical change. The `calculateRRF` method processes inputs
sequentially through a `Map` and is easily extended.

##### Schema Lock Decisions

Based on the above findings, the following schema decisions are locked for Phase 1:

| Column | Type | Changed from original plan? | Reason |
|---|---|---|---|
| `director_name` | `varchar(255)` | No | Same as planned; source is now `metadata.director_name` (after enrichment fix) |
| `primary_studio_name` | `varchar(255)` | No | Source confirmed: `metadata.production_companies[0].name` |
| `genre_names` | `text[]` | ⚠️ **Changed from `genre_ids integer[]`** | `metadata.genres` stores names, not objects with IDs |
| `cast_ids` | `integer[]` | No | Source confirmed: `metadata.cast[*].id` |
| `cast_names` | `text[]` | No | Source confirmed: `metadata.cast[*].name` |

Acceptance criteria:
- Fill-rate audit is documented (✅ see tables above; database-level query will be run in Phase 5 against deployed instance).
- Normalization rules for director/studio name are locked: lowercase trim, first value only.
- All write paths to `classification_history` are enumerated and their metadata shape is known (✅ complete).

### Phase 1 — Schema: Relationship Columns and Indexes

Migration file: `20260309_120000_add_rag_graph_relationship_columns.sql`

Changes:
- `CREATE EXTENSION IF NOT EXISTS intarray` — enables `gin__int_ops` operator class for
  efficient integer array GIN indexes and the `&&` (overlap) and `@>` (contains) operators.
  `intarray` ships with `postgresql17-contrib`, which is already installed in the Dockerfile;
  it is simply not yet activated. This is the same pattern used for `pg_trgm` (migration
  `20260305_200100`) and `vector` (migration `031_add_rag_embeddings`): add the extension
  once via migration, then use it everywhere.
- Add `director_name varchar(255)`, `primary_studio_name varchar(255)`,
  `genre_names text[]`, `cast_ids integer[]`, `cast_names text[]` to `classification_history`.
- Add B-tree index on `director_name` (partial: `WHERE director_name IS NOT NULL`).
- Add B-tree index on `primary_studio_name` (partial: `WHERE primary_studio_name IS NOT NULL`).
- Add GIN index on `genre_names` using standard `array_ops` (text arrays; `intarray` is not
  applicable to `text[]`). Supports `&&` overlap and `@>` containment operators.
- Add GIN index on `cast_ids` using `gin__int_ops` (requires `intarray`). This is more
  efficient than the default `array_ops` GIN for integer arrays because it uses
  dedicated integer-optimized index entries and supports the `&&` overlap operator directly
  (confirmed in Postgres 17 `intarray` docs: operators "work only on integer arrays that do
  not contain nulls, while the built-in operators work for any array type. This restriction
  makes them faster than the built-in operators in many cases.").
  **Critical constraint:** `intarray` operators throw an error at query time if the stored
  array contains any NULL element. The `cast_ids` extractor must call `.filter()` to remove
  null IDs (see Phase 2 extraction rules). An empty array `{}` is valid; a null element is not.
- All columns nullable; no constraints that would break existing rows.

**Index creation — `CONCURRENTLY` must NOT be used here:**
The Classifarr migration runner (`server/src/config/migrations.mjs`) wraps every `.sql`
file in `BEGIN`/`COMMIT`. PostgreSQL prohibits `CREATE INDEX CONCURRENTLY` inside a
transaction block and will throw an error at deploy time: *"CREATE INDEX CONCURRENTLY
cannot run inside a transaction block"*. Use regular `CREATE INDEX IF NOT EXISTS`.

This is safe for Classifarr specifically because migrations run during container startup
(in `index.js` at line 357, before the HTTP server binds and accepts requests). There are
no concurrent writes to `classification_history` at migration time. The brief write lock
held by each `CREATE INDEX` during startup is invisible to users.

Migration file: `20260309_120100_add_rag_graph_config_columns.sql`

Changes:
- Add to `embedding_config`:
  - `rag_graph_enabled boolean DEFAULT false` — master toggle for graph retrieval.
  - `rag_graph_weight numeric(4,2) DEFAULT 0.20` — RRF contribution of graph results in 3-way fusion.
  - `rag_graph_collection_enabled boolean DEFAULT true` — include franchise/collection hits.
  - `rag_graph_director_enabled boolean DEFAULT true` — include director hits.
  - `rag_graph_studio_enabled boolean DEFAULT false` — include studio hits (higher noise; off by default).
  - `rag_graph_cast_enabled boolean DEFAULT false` — include cast hits (high noise; off by default).
  - `rag_graph_genre_enabled boolean DEFAULT false` — genre-overlap hits; off by default (high noise).
  - `rag_graph_min_matches_to_apply integer DEFAULT 1` — minimum graph hits required before including
    graph signal in fusion (avoids injecting a single weak hit).
  - `rag_graph_candidates_limit integer DEFAULT 20` — maximum number of graph candidates returned to
    RRF per query. Tunable; 20 is conservative and matches typical `top_k` in semantic/text paths.

Acceptance criteria:
- Migrations are idempotent (use `IF NOT EXISTS` / `IF NOT EXISTS column` patterns throughout).
- No existing rows are modified; all new columns are NULL by default.
- Schema change is backward-compatible: old code paths do not break if columns are NULL.
- Indexes are created `CONCURRENTLY` where practical to avoid locking production table.

### Phase 2 — Relationship Extraction Service

New file: `server/src/services/ragGraphExtractor.mjs`

Responsibilities:
- Accept a `metadata` object (the same shape stored in `classification_history.metadata`).
- Return a structured `relationships` object:
  ```js
  {
    director_name: string|null,
    primary_studio_name: string|null,
    genre_names: string[],
    cast_ids: number[],
    cast_names: string[]
  }
  ```
- Extraction rules (locked):
  - `director_name`: read `metadata.director_name` directly (a string set at enrichment time;
    see enrichment change below). Movie rows use the credited Director from `credits.crew`;
    TV rows use `created_by[0].name` (showrunner/creator). Normalize: lowercase trim, max
    255 chars. Returns null if not present (manual/source-library rows, or pre-fix rows
    before backfill).
  - `primary_studio_name`: `metadata.production_companies?.[0]?.name`. Normalize: lowercase trim.
  - `genre_names`: `metadata.genres` directly — already a string array (`['Action', 'Comedy']`).
    No mapping needed; max 10 entries; already normalized strings from TMDB.
  - `cast_ids`: `metadata.cast?.slice(0, 5).map(c => c.id).filter(id => id != null)` —
    integers only (TMDB person IDs). The `.filter(id => id != null)` is **mandatory**: the
    `gin__int_ops` operator class in `intarray` throws an error at query time if the stored
    array contains any NULL element. Every TMDB person object should have a numeric `.id`,
    but the filter guards against malformed or partial enrichment data.
  - `cast_names`: `metadata.cast?.slice(0, 5).map(c => c.name)` — strings, max 255 each.

Enrichment function change (prerequisite for director fill-rate):
- In `server/src/services/classification.mjs` (the `enrichMetadata` helper ~line 409), add
  `director_name` to the returned object with **media-type branching**:
  ```js
  // Movie: Director from crew credits
  // TV: showrunner/creator from created_by (credits.crew has episode directors, not series creator)
  director_name: mediaType === 'movie'
    ? (details.credits?.crew?.find(c => c.job === 'Director')?.name || null)
    : (details.created_by?.[0]?.name || null),
  ```
  This is a forward-only change: new classification rows will have `metadata.director_name`
  set; existing rows in the database do not and must get `director_name` via backfill.
- This is the only enrichment change required for Phase 2. `crew` does NOT need to be stored
  wholesale — only the resolved director name string is needed.

Backfill director name (TMDB API calls required):
- Since `crew` was never stored in metadata, backfilling `director_name` for existing rows
  with `tmdb_id IS NOT NULL` requires a fresh TMDB API call per row.
- **Do not attempt to derive `director_name` from `ragGraphExtractor.extract(row.metadata)`
  on old rows** — the extractor reads `metadata.director_name`, which does not exist in
  pre-Phase-2 rows. Only rows written after the enrichment fix will have this field.
- Backfill approach: batch rows where `director_name IS NULL AND tmdb_id IS NOT NULL`.
  Read `media_type` from `metadata->>'media_type'` on the same row to determine which
  endpoint to call:
  - Movie: `GET /movie/{tmdb_id}?append_to_response=credits` → `credits.crew.find(c => c.job === 'Director')?.name`
  - TV: `GET /tv/{tmdb_id}` → `created_by[0]?.name` (no `append_to_response` needed; `created_by` is a top-level field)
  - Unknown/null `media_type`: skip the row and log a warning.
- Apply TMDB rate limiting: target no more than **20 requests per second** (conservative
  ceiling). The legacy "40 requests per 10 seconds" limit was disabled by TMDB in December
  2019; the current undocumented ceiling is ~40 req/s. Using half that rate avoids random
  429 responses. Implement exponential backoff (double sleep, up to 3 retries) on 429.
  Expected throughput at 20 req/s: ~1,000 rows per 50 seconds; ~5,000 rows per 4 minutes.
- Rows where `tmdb_id IS NULL` skip the TMDB call and remain `director_name = null`.

Wire extraction into classification write path — exact files requiring changes:

There are **three INSERT sites** that write new `classification_history` rows. All three
must be updated to call `ragGraphExtractor.extract(metadata)` and append the five new
columns to the INSERT statement.

| File | Line | Path | Contains enriched metadata? | Column source |
|---|---|---|---|---|
| `server/src/services/classification.mjs` | ~3242 | Primary AI/policy path | ✅ Yes — full TMDB enrichment | All 5 columns from `ragGraphExtractor.extract(enrichedMetadata)` |
| `server/src/routes/queue.mjs` | ~442 | Manual classification (user resolves queued task) | ❌ No — raw task payload | `ragGraphExtractor.extract(metadata)` will return mostly nulls/empty; write them anyway |
| `server/src/services/queueService.mjs` | ~951 | Source-library "already in library" path | ❌ No — raw `enrichPayload` | Same as above; mostly nulls acceptable |

The UPDATE paths (`classification.mjs:3999`, `:4069`, `:4084`, `:4114`) do NOT touch
`metadata` — they update `status`, `library_id`, `confidence`, and retry fields only.
They do not need to write relationship columns (the columns were already set at INSERT
time, or are NULL for pre-backfill rows).

Recommended implementation — shared helper:
```js
// server/src/services/ragGraphExtractor.mjs (new)
function extract(metadata) {
    if (!metadata) return { director_name: null, primary_studio_name: null,
                             genre_names: [], cast_ids: [], cast_names: [] };
    return {
        director_name:        metadata.director_name?.toLowerCase().trim().slice(0,255) || null,
        primary_studio_name:  metadata.production_companies?.[0]?.name?.toLowerCase().trim().slice(0,255) || null,
        genre_names:          (metadata.genres || []).slice(0,10),
        cast_ids:             (metadata.cast || []).slice(0,5).map(c => c.id).filter(id => id != null),
        cast_names:           (metadata.cast || []).slice(0,5).map(c => c.name).filter(Boolean),
    };
}
```

Updated INSERT at `classification.mjs:3242` (conceptual diff — add 5 columns):
```js
const rel = ragGraphExtractor.extract(enrichedMetadata);

await db.query(
  `INSERT INTO classification_history
   (...existing columns..., director_name, primary_studio_name, genre_names, cast_ids, cast_names)
   VALUES (...existing params..., $20, $21, $22, $23, $24)
   RETURNING id`,
  [...existingParams, rel.director_name, rel.primary_studio_name,
   rel.genre_names, rel.cast_ids, rel.cast_names]
);
```

The same pattern applies to the other two INSERT sites — call `extract()`, spread the
5 values as the last parameters.

- Because the new columns are additive (`DEFAULT NULL`, no constraints), old code paths
  that don't set them simply leave them NULL. No dual-write logic or feature flags are
  needed — the change is non-breaking from day one. From deployment day, new rows
  automatically populate all five columns via the updated INSERT path.

**Deployment ordering for Phase 2:**
1. Deploy the Phase 1 migration (adds columns + indexes at container startup).
2. Deploy the enrichment fix in `classification.mjs` (same release acceptable). From this
   point, all new classifications write `director_name` and the other columns directly.
3. Run Pass 1 backfill (metadata extraction, no API calls) immediately after startup — fast.
4. Schedule or manually trigger Pass 2 backfill (TMDB director, rate-limited) when convenient.

Running Pass 1 before enabling `rag_graph_enabled` is sufficient to get cast, studio, and
genre signal working. Director backfill (Pass 2) can run asynchronously in the background.

Backfill script:
- New script `server/src/scripts/backfillGraphRelationships.mjs` (no existing backfill
  script exists in `scripts/` to extend).
- The backfill runs in **two passes** that can execute independently:

  **Pass 1 — metadata extraction (fast, no API calls):**
  Reads rows where `(cast_ids IS NULL OR primary_studio_name IS NULL OR genre_names IS NULL)
  AND metadata IS NOT NULL` in batches of 500. Calls `ragGraphExtractor.extract(row.metadata)`
  and UPDATEs `cast_ids`, `cast_names`, `primary_studio_name`, `genre_names`. This pass
  is fast (no network I/O) and should complete in seconds for any reasonable table size.
  Idempotency guard: per-column `IS NULL` checks — already-populated columns are not
  overwritten.

  **Pass 2 — director backfill (slow, TMDB API calls):**
  Reads rows where `director_name IS NULL AND tmdb_id IS NOT NULL` in batches. For each
  row, determines `media_type` from `metadata->>'media_type'`, calls the appropriate
  TMDB endpoint, extracts the director name, and UPDATEs `director_name`. Rate-limited
  at ≤20 req/s with exponential backoff on HTTP 429. `director_name` IS NULL is the
  idempotency guard — already-populated rows are never hit again.

- Designed to run as a one-time startup migration job or manually from CLI.
- Passes can be run separately (e.g., run Pass 1 immediately on deploy, schedule Pass 2).

Acceptance criteria:
- `ragGraphExtractor.extract()` has unit tests covering:
  - TMDB movie metadata shape (`director_name` from `metadata.director_name` + `production_companies` + `cast` + `genres`).
  - TMDB TV metadata shape (`director_name` from `created_by[0].name`, not `credits.crew`).
  - Empty/null metadata returns `{ director_name: null, ... }` with empty arrays, no throw.
  - Malformed cast arrays (missing id, missing name) degrade gracefully.
  - TV series with no `created_by` returns `director_name: null` gracefully.
- Backfill script logs row count, batch progress, and any extraction errors without crashing.
- Forward path: new classification rows written after migration populate all five columns.

### Phase 3 — Graph Retrieval Implementation

File: `server/src/services/ragRetriever.mjs` — add `graphSearch()` method.

```
async graphSearch(metadata, classificationId, limit, options)
```

`limit` defaults to `rag_graph_candidates_limit` (config, default 20). This mirrors the
`semanticSearch` `topK` and `fullTextSearch` `limit` parameters and allows operator tuning.

Query strategy:
1. Extract relationship signals from `metadata` using `ragGraphExtractor.extract(metadata)`.
2. Also read `collection_id` from the provided `classificationId`'s history row if needed.
3. Build a single UNION query (or multiple queries merged in JS) that finds candidates
   matching any of the enabled relationship dimensions:

```sql
SELECT classification_id, title, media_type, library_id, library_name,
       method, confidence, created_at,
       -- relationship match bitmask for scoring
       (CASE WHEN collection_id = $collection_id THEN 8 ELSE 0 END +
        CASE WHEN director_name = $director_name THEN 4 ELSE 0 END +
        CASE WHEN primary_studio_name = $studio_name THEN 2 ELSE 0 END +
        CASE WHEN cast_ids && $cast_ids THEN 1 ELSE 0 END) AS match_score
FROM classification_history
WHERE library_id IS NOT NULL
  AND id != $exclude_id
  AND (
    ($collection_id IS NOT NULL AND collection_id = $collection_id)
    OR ($director_name IS NOT NULL AND director_name = $director_name)
    OR ($studio_name IS NOT NULL AND primary_studio_name = $studio_name AND $studio_enabled)
    OR ($cast_ids IS NOT NULL AND cast_ids && $cast_ids AND $cast_enabled)
  )
ORDER BY match_score DESC, created_at DESC
LIMIT $limit
```

**Implementation note — build the WHERE clause dynamically in JS, not with parameterized
null-checks:** The SQL above is shown as a conceptual template. In the actual
`graphSearch()` implementation:

1. **Parameterized boolean enablement flags** (`AND $studio_enabled`) are not valid SQL
   WHERE predicates in parameterized queries — a boolean `$n` cannot stand alone as a
   condition. This must be handled in application code.

2. **NULL-parameterized OR branches** (`$col IS NOT NULL AND col = $col`) in a prepared
   statement cause Postgres to generate a generic plan that may not efficiently skip NULL
   branches at execution time (Postgres 17 planner optimizer docs: the planner evaluates
   plans at parse time based on the parameter types, not their runtime values).

3. **Recommended pattern:** build the active conditions array in JS before issuing the
   query, appending only the dimensions that are (a) enabled in config and (b) have a
   non-null input value. Use a flat parameterized query with only the active arms:

```js
const conditions = [];
const params = [excludeId];  // $1 always
if (relationships.collection_id != null && options.collectionEnabled) {
    params.push(relationships.collection_id);
    conditions.push(`collection_id = $${params.length}`);
}
if (relationships.director_name != null && options.directorEnabled) {
    params.push(relationships.director_name.toLowerCase().trim());
    conditions.push(`director_name = $${params.length}`);
}
// ... same pattern for studio, cast_ids ...
if (conditions.length === 0) return [];  // nothing to query
const sql = `SELECT ... FROM classification_history
             WHERE library_id IS NOT NULL AND id != $1
               AND (${conditions.join(' OR ')})
             ORDER BY match_score DESC, created_at DESC LIMIT $${params.length + 1}`;
params.push(limit);
```

This pattern guarantees index use on each active condition (Postgres BitmapOr across
the B-tree and GIN indexes), skips all inactive conditions at zero overhead, and avoids
generic-plan issues with nullable prepared-statement parameters.

Scoring: `match_score` is a bitmask (collection=8, director=4, studio=2, cast=1). This
ranks items that match on multiple dimensions above those that match on only one.

**Important — RRF uses rank position, not raw score**: The `match_score` bitmask (1–15)
determines the *ordering of graph results*. Once ordered, `calculateRRF()` consumes only
each hit's rank position (not the bitmask value itself) and applies the standard formula
`1/(k + rank)` with `k=60` (Cormack et al. 2009 canonical default; robust across fusion tasks).
This means the bitmask is never numerically combined with cosine similarity or BM25 scores —
there is no score-range-incompatibility issue. This is explicitly why linear combination
(`final_score = α·vector + β·graph`) is **not** used: BM25, cosine, and bitmask scores are
not in the same domain and are not linearly separable (Qdrant hybrid search analysis).

**RRF k parameter**: The plan's `calculateRRF` should document `k=60` as its constant.
If graph is configured as a lighter supplementary signal (low weight), consider `k=90`
to reduce the gap between top-ranked and lower-ranked hits — making graph contribution
more uniform across its candidates.

Return shape (same as `semanticSearch` return for compatibility with RRF):
```js
{
  classificationId: number,
  title: string,
  mediaType: string,
  libraryId: number,
  libraryName: string,
  method: string,
  confidence: number,
  similarity: null,           // graph hits have no similarity score
  graphMatchScore: number,    // bitmask value (1–15)
  graphMatchDimensions: string[] // e.g. ['collection', 'director']
}
```

Respect abort signal and config flags (`rag_graph_enabled`, dimension-level toggles).

Update `hybridSearch()`:
- After existing semantic and full-text retrieval, call `graphSearch()` if enabled.
- Pass graph results to a new `calculateWeightedRRF(sources, k)` method (see below).
- Add `graphMatches` count to the `ragLogger.logOperation('hybrid_search', ...)` metadata.

**`calculateWeightedRRF` — exact implementation:**

The current `calculateRRF(semanticMatches, textMatches, k = 60)` applies equal weight to
both sources: `rrfScore += 1/(k + rank)`. The weighted extension multiplies the per-rank
contribution by a per-source weight before accumulating — the formula used by Azure AI
Search's production weighted RRF (confirmed from Azure hybrid search ranking docs):

```
final_score(doc) = Σ over sources: weight_i × (1 / (k + rank_i(doc)))
```

**Implementation approach** — add a new method, keep the old one as a backward-compatible
wrapper (no callers broken):

```js
// New: accepts an array of { matches, weight } sources
calculateWeightedRRF(sources, k = 60) {
    if (!sources || sources.length === 0) return [];
    if (typeof k !== 'number' || k < 0) k = 60;

    const combined = new Map();

    sources.forEach(({ matches, weight = 1.0 }) => {
        if (!matches || matches.length === 0) return;
        matches.forEach((match, index) => {
            if (!match.classificationId) return;
            const contribution = weight * (1 / (k + index + 1));
            if (combined.has(match.classificationId)) {
                combined.get(match.classificationId).rrfScore += contribution;
            } else {
                combined.set(match.classificationId, { ...match, rrfScore: contribution });
            }
        });
    });

    return Array.from(combined.values())
        .sort((a, b) => b.rrfScore - a.rrfScore);
}

// Keep old signature as a wrapper — no existing callers broken:
calculateRRF(semanticMatches, textMatches, k = 60) {
    return this.calculateWeightedRRF(
        [{ matches: semanticMatches, weight: 1.0 },
         { matches: textMatches,    weight: 1.0 }],
        k
    );
}
```

Call site in `hybridSearch()` after adding graph:
```js
results = this.calculateWeightedRRF([
    { matches: semanticMatches, weight: 1.0 },
    { matches: textMatches,     weight: 1.0 },
    { matches: graphMatches,    weight: ragConfig.rag_graph_weight ?? 0.20 },
], rrfK);
```

**Why this formula works for graph specifically:**
- With default `rag_graph_weight = 0.20` and `k = 60`, a graph hit at rank 1 contributes
  `0.20 × (1/61) ≈ 0.0033` — versus a vector hit at rank 1 contributing `1.0 × (1/61) ≈ 0.0164`.
- A document that appears as the top vector hit AND the top graph hit scores
  `0.0164 + 0.0033 = 0.0197`, reliably beating a document that is only the top vector hit
  (`0.0164`). This is the desired behavior: graph is a supplementary signal, not a veto.
- At `rag_graph_weight = 1.0`, graph and vector/text contribute equally — max graph influence.
- At `rag_graph_weight = 0.0`, graph is suppressed entirely without disabling the code path.

Acceptance criteria:
- `graphSearch()` returns an empty array (not a throw) when:
  - All relationship fields are null (nothing to query on).
  - `rag_graph_enabled` is false.
  - The SQL query returns zero rows.
  - Abort signal fires.
- `graphSearch()` does not return the item being classified (exclude by `classificationId`).
- 3-way RRF fusion produces a deterministic ranked list; items in all three sources rank higher
  than items in two, which rank higher than items in one.
- `hybridSearch()` result shape is unchanged (backward-compatible with all callers).
- Unit tests cover: graph-only result when vector+text return nothing; no duplicate entries
  in fused output; graph disabled path returns same output as pre-286 hybrid.

### Phase 4 — Observability and Configuration

Extend RAG loop tracing:
- In `rag_loop_trace` (or equivalent observability structure), add fields for graph retrieval:
  - `graph_enabled`: boolean — was graph retrieval attempted?
  - `graph_hits`: integer — number of candidates returned by graph query.
  - `graph_dimensions_matched`: string[] — which dimensions returned hits for this item.
  - `graph_contributed`: boolean — did any graph-only hit survive into the final fused result?
- Emit these fields via `ragLogger` in the same operation log entry as `hybrid_search`.

Backend API:
- Extend the existing RAG settings endpoint (whatever serves/saves `embedding_config`) to
  expose and accept the new `rag_graph_*` config fields.
- No new routes required; the shape of the existing settings save/load should absorb the
  new columns naturally if the route does a generic config upsert.

Admin UI (minimal):
- The existing RAG settings page is `client/src/views/RAGSettings.vue`. It uses a tab
  component pattern; each tab is a separate `.vue` file in `client/src/views/rag/`.
  Current tabs: Overview, Text Embeddings, Image Embeddings, Backfill, Advanced.
- Phase 4 adds a new **Graph** tab:
  - Create `client/src/views/rag/GraphTab.vue` with toggle controls for all `rag_graph_*`
    config fields.
  - Register it in `RAGSettings.vue` (`tabs` array and `import`).
- Add toggle controls for `rag_graph_enabled` and dimension toggles
  (`rag_graph_collection_enabled`, `rag_graph_director_enabled`, etc.).
- Add `rag_graph_weight` numeric input (0.00–1.00, step 0.01).
- Add `rag_graph_candidates_limit` integer input (1–100, default 20) — controls how many
  graph candidates enter RRF per query.
- No new top-level views required; extend the existing settings panel with the new tab.

Acceptance criteria:
- When `rag_graph_enabled = false` (default), no graph queries run and performance is
  identical to pre-286.
- Graph observability fields appear in RAG operation logs for every `hybrid_search` where
  graph was attempted.
- Settings UI accepts and saves all graph config fields without a page reload.

### Phase 5 — Backfill and Data Quality

Backfill execution plan:

**Three principles for safe production backfills** (from strong_migrations / Stripe online
migrations best practices): **batching, throttling, and running outside a transaction**.

- **Batching**: process rows in chunks of 500 — avoids single-statement lock escalation
  and keeps individual transaction durations short.
- **Throttling**: sleep 50ms between batches to allow normal writes to proceed and avoid
  I/O saturation. Adjust if the database shows sustained high CPU/IO during backfill.
- **Outside a transaction**: `backfillGraphRelationships.mjs` is a standalone script that
  issues `UPDATE` statements in small separate transactions — **never in one long transaction**.
  This is critical: running a full-table UPDATE inside a single transaction holds row locks
  on every updated row for the entire duration, blocking concurrent reads/writes on a
  production table. Additionally, the script must NOT be embedded as a `DO $$ ... $$`
  block inside a migration `.sql` file — the migration runner wraps it in `BEGIN`/`COMMIT`,
  causing the same problem. The backfill script is invoked separately from migrations.

- Run `backfillGraphRelationships.mjs` against the production database before enabling
  `rag_graph_enabled`.
- Log start row count, end row count, and fill rate for each column after completion.
- Target: populate relationship columns for at least 80% of existing rows that have
  non-null `metadata`.

**Lazy migration bonus:** Any classification row that is re-processed (re-classified or
updated) after the Phase 2 enrichment fix is deployed will have its relationship columns
set automatically by the updated INSERT path. High-traffic rows get populated without
the backfill script touching them, reducing effective Pass 2 API call volume.

Fill-rate monitoring:
- Add a diagnostic query to the existing RAG health check or a one-time script:
  ```sql
  SELECT
    COUNT(*) as total,
    COUNT(director_name) as has_director,
    COUNT(primary_studio_name) as has_studio,
    COUNT(genre_names) FILTER (WHERE array_length(genre_names,1) > 0) as has_genres,
    COUNT(cast_ids) FILTER (WHERE array_length(cast_ids,1) > 0) as has_cast,
    COUNT(collection_id) as has_collection
  FROM classification_history
  WHERE metadata IS NOT NULL;
  ```
- Document fill-rate results before enabling graph retrieval for validation.

Acceptance criteria:
- Backfill runs to completion without errors on a test copy of the database.
- Fill rates are documented for director, studio, genre_names, cast_ids, collection_id.
- Any row with `metadata IS NULL` or `tmdb_id IS NULL` is left with `director_name = null`
  (no null-dereference errors, no unnecessary TMDB calls).
- TMDB API calls for director backfill are rate-limited at ≤20 req/second (conservative;
  current TMDB undocumented ceiling is ~40 req/s; legacy "40 req/10s" limit was disabled
  December 2019). HTTP 429 responses trigger exponential backoff, not a hard failure.
- Backfill is idempotent: re-running does not overwrite already-populated rows.

### Phase 6 — Testing and Rollout

Unit tests:
- `ragGraphExtractor.extract()` — shape correctness, null safety, normalization rules.
- `graphSearch()` — empty metadata, disabled config, abort signal, bitmask scoring.
- `calculateRRF()` / 3-way fusion — deterministic output, no duplicates, items in all
  three sources rank above items in fewer.
- `hybridSearch()` integration — graph-disabled path matches pre-286 behavior exactly.

Integration tests:
- Create a test fixture with known classification_history rows representing a franchise
  (e.g., items sharing the same collection_id and director_name).
- Assert that `graphSearch()` returns those items when queried with a new item from
  the same franchise.
- Assert that the franchise items appear in the final fused result.

Rollout:
- `rag_graph_enabled` defaults to `false`. No behavior change on upgrade.
- Operators who want to enable must explicitly toggle it in settings after running the backfill.
- Recommend enabling `collection` and `director` dimensions first (highest precision, lowest
  noise). Studio and cast are higher-noise and should be validated before enabling.
- Monitor: classification result distribution, changes in library hit rates for franchise
  content, and any increase in retrieval latency (graph query adds ~1–5ms on indexed columns).

Acceptance criteria:
- All new unit and integration tests pass in CI.
- No regression in existing `hybridSearch` behavior when `rag_graph_enabled = false`.
- End-to-end test: classify a sequel/franchise item; with graph enabled, results include
  earlier franchise entries; without graph, they appear only if above vector threshold.
- Latency regression guard: `graphSearch()` p95 latency must be under 20ms on indexed columns.

## API and Data Contract

### New `graphSearch()` return item shape

```json
{
  "classificationId": 1234,
  "title": "Harry Potter and the Philosopher's Stone",
  "mediaType": "movie",
  "libraryId": 5,
  "libraryName": "Kids Movies",
  "method": "ai_analysis",
  "confidence": 92.5,
  "similarity": null,
  "graphMatchScore": 12,
  "graphMatchDimensions": ["collection", "director"]
}
```

### Config fields (added to `embedding_config`)

| Field | Type | Default | Description |
|---|---|---|---|
| `rag_graph_enabled` | boolean | false | Master toggle for graph retrieval |
| `rag_graph_weight` | numeric(4,2) | 0.20 | RRF weight contribution of graph results |
| `rag_graph_collection_enabled` | boolean | true | Enable franchise/collection dimension |
| `rag_graph_director_enabled` | boolean | true | Enable director dimension |
| `rag_graph_studio_enabled` | boolean | false | Enable studio dimension (higher noise) |
| `rag_graph_cast_enabled` | boolean | false | Enable cast dimension (high noise) |
| `rag_graph_genre_enabled` | boolean | false | Enable genre-only dimension |
| `rag_graph_min_matches_to_apply` | integer | 1 | Min hits before graph contributes to fusion |
| `rag_graph_candidates_limit` | integer | 20 | Max graph candidates returned to RRF per query |

### Schema changes summary

**`classification_history`** (new nullable columns):

| Column | Type | Index |
|---|---|---|
| `director_name` | `varchar(255)` | B-tree (partial WHERE IS NOT NULL) |
| `primary_studio_name` | `varchar(255)` | B-tree (partial WHERE IS NOT NULL) |
| `genre_names` | `text[]` | GIN (`array_ops`) |
| `cast_ids` | `integer[]` | GIN (`gin__int_ops`, requires `intarray`) |
| `cast_names` | `text[]` | None (display only) |

**`embedding_config`** (new columns, all with safe defaults).

## Section-to-Implementation Binding

Status legend:
- `New`: does not exist yet; this issue creates it.
- `Extend`: exists; this issue modifies or augments it.

| Component | Status | Notes |
|---|---|---|
| `ragGraphExtractor.mjs` | New | Phase 2 |
| `ragRetriever.graphSearch()` | New | Phase 3 |
| `ragRetriever.hybridSearch()` — 3-way RRF | Extend | Phase 3 |
| `ragRetriever.calculateRRF()` — third input | Extend | Phase 3 |
| `classification_history` columns | Extend | Phase 1 migration |
| `embedding_config` graph fields | Extend | Phase 1 migration |
| Classification write paths | Extend | Phase 2 — populate new columns on save |
| `backfillGraphRelationships.mjs` | New | Phase 2 backfill |
| RAG observability / rag_loop_trace | Extend | Phase 4 |
| Settings API (graph config r/w) | Extend | Phase 4 |
| Settings UI (graph config controls) | Extend | Phase 4 |

## Implementation Backlog Extract (Action-Critical)

1. Run Phase 0 audit: enumerate all `classification_history` write paths and sample
   `metadata jsonb` fill rates from the running database.
2. Write and test both migrations (Phase 1) in a local Postgres dev instance before
   shipping. Confirm `IF NOT EXISTS` guards on every ADD COLUMN.
3. Build `ragGraphExtractor.mjs` with full test coverage before wiring into write paths.
4. Update all `classification_history` INSERT paths to extract and store relationship columns.
5. Write and validate `backfillGraphRelationships.mjs` against a copy of production data.
   Director backfill uses TMDB API (rate-limited at ≤40 req/10s); cast/studio/genre are
   extracted from stored `metadata jsonb` without API calls.
6. Implement `graphSearch()` behind `rag_graph_enabled` flag (no behavior change when false).
7. Update `hybridSearch()` to call `graphSearch()` and apply 3-way RRF only when enabled.
8. Extend RAG observability to emit graph retrieval trace fields.
9. Extend settings API and UI to expose graph config flags.
10. Run backfill on production, document fill rates, then gate-check before enabling.
11. Enable `rag_graph_collection_enabled` + `rag_graph_director_enabled` first and monitor.

## Race Conditions, FK Violations, and Concurrency Analysis

### No new race conditions are introduced

**New columns written atomically at INSERT time.** The Phase 2 change adds `director_name`,
`primary_studio_name`, `genre_names`, `cast_ids`, `cast_names` to the existing INSERT
statement in `classification.mjs:3242` and `routes/queue.mjs:442`. Because all five columns
are part of the same `INSERT ... VALUES (...)` statement, they are committed atomically
with the rest of the row — there is no window between "row exists" and "relationship
columns populated". No second UPDATE is needed.

**Backfill has no write contention with new INSERTs.** Pass 1 uses
`WHERE cast_ids IS NULL` (and similar per-column guards) — newly inserted rows with
relationship columns already set are invisible to the backfill. No conflict.

**`graphSearch()` is read-only.** It issues only `SELECT` queries. No write lock
contention with concurrent classifications.

**Config snapshot at call time.** `hybridSearch()` reads `ragConfig` once at the top of
each call. If `rag_graph_enabled` is toggled mid-flight, the worst case is one
classification that runs with stale config — no data corruption.

### Pre-existing race condition in source_library path (unchanged by Issue 286)

`queueService.mjs` around line 940–951 uses a SELECT-then-INSERT pattern to deduplicate
`source_library` entries:
```js
const existingEntry = await db.query('SELECT 1 FROM classification_history WHERE ...');
if (existingEntry.rows.length === 0) {
    await db.query('INSERT INTO classification_history ...');
}
```
This is a TOCTOU (time-of-check, time-of-use) pattern with no unique constraint guard.
If two queue workers process the same item concurrently, both could read 0 rows and both
insert. **This is pre-existing — Issue 286 does not make it worse.** The Phase 2 change
simply preserves the existing pattern, extending the INSERT to include the new columns.
Fixing this TOCTOU is out of scope for Issue 286 (it would require a unique index on
`(tmdb_id, library_id, method)` or a database-level `ON CONFLICT DO NOTHING` guard).

### No FK violations possible from new columns

The five new relationship columns (`director_name`, `primary_studio_name`, `genre_names`,
`cast_ids`, `cast_names`) carry **no foreign key constraints** — they are denormalized
strings and integer arrays. No other table references these columns. Zero FK violation risk.

**Existing FK constraints on `classification_history.id` are unaffected.** Nine tables hold
`classification_id REFERENCES classification_history(id)` (confirmed in migration
`20260305_200700_bigint_classification_history_pk.sql`). The Phase 1 migration only adds
columns — it does not touch the primary key, its type, or any existing FK constraints.
The `ON DELETE CASCADE` semantics on all child tables are fully preserved.

**`graphSearch()` results are never written to FK-constrained tables.** Graph candidates
are returned as a JS array, consumed by `calculateWeightedRRF`, and delivered as RAG
context to the policy/AI layer. No INSERT into `rag_embeddings`, `rag_text_matches`, or
`rag_loop_traces` occurs from within `graphSearch()`. No FK violation path.

### Migrations needed

**Exactly two new migration files** are required — both already documented in Phase 1:
1. `20260309_120000_add_rag_graph_relationship_columns.sql` — adds 5 columns + 4 indexes
   to `classification_history`, activates `intarray` extension.
2. `20260309_120100_add_rag_graph_config_columns.sql` — adds 9 `rag_graph_*` config
   columns to `embedding_config`.

No other schema changes are needed for the full Issue 286 implementation.

### How the system works end-to-end

```
1. Media item arrives (webhook from Sonarr/Radarr/Plex, manual queue resolve,
   or "already in source library" path)
   │
2. TMDB enrichment → enrichedMetadata (classification.mjs ~line 409)
   Now includes: director_name (after Phase 2 fix), production_companies, cast, genres
   │
3. ragGraphExtractor.extract(enrichedMetadata) → { director_name, primary_studio_name,
   genre_names, cast_ids, cast_names }
   │
4. INSERT INTO classification_history (..., director_name, primary_studio_name,
   genre_names, cast_ids, cast_names) VALUES (...) — all columns in one atomic INSERT
   │
   ┌──────── If rag_graph_enabled = false (default): ────────────────────────────────┐
   │  hybridSearch() calls calculateRRF(semanticMatches, textMatches, rrfK)          │
   │  Identical to pre-286 behavior                                                  │
   └─────────────────────────────────────────────────────────────────────────────────┘
   │
   ┌──────── If rag_graph_enabled = true: ───────────────────────────────────────────┐
5. │  hybridSearch() calls three retrieval paths in parallel:                        │
   │    semanticSearch(queryVector, topK)      → vector matches                      │
   │    fullTextSearch(queryText, limit)        → BM25 text matches                  │
   │    graphSearch(metadata, id, limit, opts)  → SQL relationship matches            │
   │                                            (dynamic WHERE on indexed columns)    │
   │                                                                                  │
6. │  calculateWeightedRRF([                                                          │
   │    { matches: semanticMatches, weight: 1.0  },                                  │
   │    { matches: textMatches,     weight: 1.0  },                                  │
   │    { matches: graphMatches,    weight: ragConfig.rag_graph_weight }  // 0.20    │
   │  ], rrfK)  →  ranked candidates list                                            │
   └─────────────────────────────────────────────────────────────────────────────────┘
   │
7. Top-k candidates → AI context prompt (same format as today — no prompt changes)
   │
8. AI (Claude/OpenAI/Ollama) classifies the item → library assignment
   No new AI integration needed; AI consumes the fused context identically.
```

### No new AI implementation required

Graph retrieval is entirely within the **retrieval layer**. The AI sees only the final
fused candidate list and the classification prompt — both unchanged by Issue 286. Specifically:

- `graphSearch()` returns items with the same JS shape as `semanticSearch()` results
  (`classificationId`, `title`, `mediaType`, `libraryId`, `libraryName`, `method`,
  `confidence`, `similarity: null`). The extra fields (`graphMatchScore`,
  `graphMatchDimensions`) are metadata for observability, not passed to the AI prompt.
- No change to any Claude/OpenAI/Ollama API call parameters.
- No new prompts, prompt templates, or system messages.
- No new AI providers, models, fine-tuning, or embedding models.
- `formulaEngine.scoreRAG()` (which calls `semanticSearch()` directly) is intentionally
  excluded from graph scope — no change to formula-based scoring.

## Operational Risk and Mitigations

| Risk | Mitigation |
|---|---|
| Relationship column backfill takes too long on large history tables | Batch with sleep; run during low-activity window; set statement_timeout per batch |
| Director backfill requires TMDB API calls (~40 req/s current; target ≤20 req/s conservatively); 5k rows ≈ 4 min | Rate-limit the backfill loop; implement HTTP 429 exponential backoff; run as a scheduled background task rather than blocking startup |
| Graph hits add noise (low-precision cast/studio matches) | Studio and cast toggles default to `false`; must be explicitly opted in |
| Jsonb field naming varies between TMDB movie vs TV shapes | Phase 0 audit confirms: movie uses `credits.crew` Director; TV uses `created_by[0]`; `ragGraphExtractor` and enrichment function both branch by media_type |
| graphSearch adds query latency | B-tree and GIN indexes are fast; expected p95 < 5ms; if over 20ms, index type must be reviewed |
| Graph results could skew AI context toward a franchise when query is ambiguous | Graph weight is a separate configurable dimension; lower `rag_graph_weight` or disable dimensions |
| `collection_id` may be NULL for many films (no TMDB collection) | Handled gracefully; collection dimension is skipped if NULL. TV shows always return NULL (TMDB collections are movie-only) |
| `formulaEngine.scoreRAG()` does not benefit from graph signal | Deliberate out-of-scope; formula scoring uses scalar similarity. Follow-on issue if formula RAG gaps are observed |
| Graph relationship columns go stale if TMDB data changes post-classification | Accepted limitation for v1. `director_name`, `cast_ids`, etc. are populated at INSERT time and are not auto-updated if TMDB credits change. Unlike the embedding `is_stale` flag, there is no graph-column staleness tracker. Mitigation: the backfill script can be re-run on targeted rows; a future issue can add `graph_columns_stale boolean` if needed. |
| Temporal decay not applied across RRF fusion | `ORDER BY match_score DESC, created_at DESC` uses recency as a tiebreaker within graphSearch results only. Older franchise hits rank identically to recent ones at the same bitmask level once RRF fuses across all three signals. This is acceptable for v1; temporal decay weighting can be added in a follow-on issue (Han et al. §3.3 Delile et al. approach). |

## Dependencies

### Deployment model

Classifarr runs PostgreSQL **embedded inside the application container** — there is no
separate database service, sidecar, or external connection. PostgreSQL 17 is installed
directly in the Dockerfile alongside Node.js and started by `docker-entrypoint.sh` via
`pg_ctl`. All data persists to the `./data/postgres` volume already mapped in every
`docker-compose*.yml`.

This means:
- Graph retrieval is implemented as new columns, indexes, and queries against the same
  embedded Postgres instance — identical to how `pgvector`, `pg_trgm`, and all existing
  migrations work. No new container, no new volume, no new service.
- New Postgres extensions are activated by adding `CREATE EXTENSION IF NOT EXISTS ...`
  to a migration file. The `intarray` shared library is already on disk inside the
  container (via `postgresql17-contrib`); enabling it requires only the SQL command,
  exactly like `pg_trgm` was enabled in migration `20260305_200100`.

### Package and infrastructure

- No new npm packages required.
- No new infrastructure services or containers required.
- `intarray` extension: ships with `postgresql17-contrib` (already in Dockerfile);
  will be activated by the Phase 1 migration via `CREATE EXTENSION IF NOT EXISTS intarray`.
  Required only for `cast_ids integer[]` GIN index (`gin__int_ops` operator class and
  the optimized `&&` / `@>` operators). The `genre_names text[]` column uses standard
  PostgreSQL `array_ops` GIN, which does **not** require `intarray`.

## Notes on Embedded PostgreSQL and Extension Availability

A key architectural fact not captured in the original issue proposal: PostgreSQL in
Classifarr is **not** a separate service — it runs embedded inside the application
container, co-located with Node.js. The entrypoint script initialises it from
`./data/postgres` and starts it with `pg_ctl` before Node starts. This is why:

1. There is no `postgres:` service in any `docker-compose*.yml` — Postgres and Node
   share one container and one image.
2. Extensions are activated once via migration SQL (`CREATE EXTENSION IF NOT EXISTS ...`)
   and are immediately available on the next and all subsequent container starts.
3. `intarray` has been confirmed as present on disk (`postgresql17-contrib` is installed
   in the Dockerfile) but not yet activated. It will be enabled in the Phase 1 migration
   and does not require any Dockerfile change.

## Notes on the Original Issue Proposal (Graph DB vs Postgres)

The original issue #286 proposes considering Neo4j or RedisGraph. This plan intentionally
defers that option because:
1. Postgres already stores all relationship data in `metadata jsonb`; extracting to indexed
   columns is sufficient for the queries needed.
2. An external graph DB would require a synchronization mechanism (keep-in-sync with every
   new classification) and adds operational complexity to Docker deployments.
3. The Postgres approach can be implemented, backfilled, tested, and rolled back entirely
   within the existing infrastructure.
4. If the Postgres-native approach proves insufficient (e.g., multi-hop queries across
   more than one relationship hop are needed in the future), a graph store can revisited
   with a dedicated hardening issue at that time.
