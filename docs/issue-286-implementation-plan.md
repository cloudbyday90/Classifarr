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
  complement vector search (references used in issue #286: LogRocket RAG Techniques,
  MDPI Systematic RAG SOTA Review 2025).

## Out of Scope

- External graph database (Neo4j, RedisGraph, or similar). Postgres is sufficient and no
  new stateful service dependency will be introduced.
- Semantic re-ranking models (cross-encoders). Not needed; RRF fusion is adequate.
- User-facing graph visualizations or relationship explorer UI.
- Restructuring or replacing the existing vector or full-text retrieval paths.
- Any change to how classification decisions are made after retrieval (that is the policy
  engine and AI prompt responsibility, not the retriever).

## Relationship to Existing Architecture

The current `hybridSearch()` pipeline in `server/src/services/ragRetriever.js`:

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
| Director | `metadata->>'crew'` or `metadata->>'directory'` (jsonb) | No |
| Primary studio | `metadata->'production_companies'->>0` (jsonb) | No |
| Cast | `metadata->'cast'` (jsonb array) | No |
| Genres | `metadata->'genres'` (jsonb array) | No |

### What is needed

Denormalize and index the following relationship attributes as first-class columns so that
graph queries run on B-tree or GIN indexes rather than jsonb expression scans across the
full history table:

| New column | Type | Source in metadata jsonb | Notes |
|---|---|---|---|
| `director_name` | `varchar(255)` | `crew` array, `job = 'Director'`, or `director` field | First director only; normalized to lowercase for case-insensitive match |
| `primary_studio_name` | `varchar(255)` | `production_companies[0].name` | First company only; normalized |
| `genre_ids` | `integer[]` | `genres[*].id` | TMDB genre IDs; array overlap for similarity |
| `cast_ids` | `integer[]` | `cast[0..4].id` | Top-5 cast TMDB person IDs; array overlap |
| `cast_names` | `text[]` | `cast[0..4].name` | Top-5 cast names; kept for display without join |

`collection_id` already exists and is indexed — graph queries will reuse it as-is.

## Phase Plan

### Phase 0 — Codebase Audit and Schema Freeze

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

Acceptance criteria:
- Fill-rate audit is documented (what percentage of existing rows have each relationship
  field in metadata jsonb).
- Normalization rules for director/studio name are locked (lowercase trim, first value only).
- All write paths to `classification_history` are enumerated and their metadata shape is known.

### Phase 1 — Schema: Relationship Columns and Indexes

Migration file: `20260309_120000_add_rag_graph_relationship_columns.sql`

Changes:
- Add `director_name varchar(255)`, `primary_studio_name varchar(255)`,
  `genre_ids integer[]`, `cast_ids integer[]`, `cast_names text[]` to `classification_history`.
- Add B-tree index on `director_name` (partial: `WHERE director_name IS NOT NULL`).
- Add B-tree index on `primary_studio_name` (partial: `WHERE primary_studio_name IS NOT NULL`).
- Add GIN index on `genre_ids` using `gin__int_ops` or standard array ops.
- Add GIN index on `cast_ids` using array ops.
- All columns nullable; no constraints that would break existing rows.

Migration file: `20260309_120100_add_rag_graph_config_columns.sql`

Changes:
- Add to `embedding_config`:
  - `rag_graph_enabled boolean DEFAULT false` — master toggle for graph retrieval.
  - `rag_graph_weight numeric(4,2) DEFAULT 0.20` — RRF contribution of graph results in 3-way fusion.
  - `rag_graph_collection_enabled boolean DEFAULT true` — include franchise/collection hits.
  - `rag_graph_director_enabled boolean DEFAULT true` — include director hits.
  - `rag_graph_studio_enabled boolean DEFAULT false` — include studio hits (higher noise; off by default).
  - `rag_graph_cast_enabled boolean DEFAULT false` — include cast hits (high noise; off by default).
  - `rag_graph_genre_enabled boolean DEFAULT false` — genre-only hits rarely useful; off by default.
  - `rag_graph_min_matches_to_apply integer DEFAULT 1` — minimum graph hits required before including
    graph signal in fusion (avoids injecting a single weak hit).

Acceptance criteria:
- Migrations are idempotent (use `IF NOT EXISTS` / `IF NOT EXISTS column` patterns throughout).
- No existing rows are modified; all new columns are NULL by default.
- Schema change is backward-compatible: old code paths do not break if columns are NULL.
- Indexes are created `CONCURRENTLY` where practical to avoid locking production table.

### Phase 2 — Relationship Extraction Service

New file: `server/src/services/ragGraphExtractor.js`

Responsibilities:
- Accept a `metadata` object (the same shape stored in `classification_history.metadata`).
- Return a structured `relationships` object:
  ```js
  {
    director_name: string|null,
    primary_studio_name: string|null,
    genre_ids: number[],
    cast_ids: number[],
    cast_names: string[]
  }
  ```
- Extraction rules (locked):
  - `director_name`: find first entry in `metadata.crew` where `job === 'Director'`, fall back
    to `metadata.director` string. Normalize: lowercase trim, max 255 chars.
  - `primary_studio_name`: `metadata.production_companies?.[0]?.name`. Normalize: lowercase trim.
  - `genre_ids`: `metadata.genres?.map(g => g.id)` — integers only, max 10.
  - `cast_ids`: `metadata.cast?.slice(0, 5).map(c => c.id)` — integers only.
  - `cast_names`: `metadata.cast?.slice(0, 5).map(c => c.name)` — strings, max 255 each.

Wire extraction into classification write path:
- All INSERT/UPDATE paths that write `classification_history` rows with `metadata jsonb`
  must also extract and write the new relationship columns. Identify all callers in Phase 0
  and update them (or add a shared helper that wraps the INSERT).
- Prefer a single shared `buildClassificationHistoryFields(record)` helper that handles
  both existing and new fields, so future columns are added in one place.

Backfill script:
- New script `server/src/scripts/backfillGraphRelationships.js` (or extend an existing
  backfill script if one exists in `scripts/`).
- Reads rows where `director_name IS NULL AND metadata IS NOT NULL` in batches of 500.
- Runs `ragGraphExtractor.extract(row.metadata)` and UPDATEs the relationship columns.
- Safe to re-run; uses `WHERE director_name IS NULL` guard.
- Designed to run as a one-time startup migration job or manually from CLI.

Acceptance criteria:
- `ragGraphExtractor.extract()` has unit tests covering:
  - TMDB movie metadata shape (crew array + production_companies + cast + genres).
  - TMDB TV metadata shape (may differ; `created_by` field, no crew array).
  - Empty/null metadata returns `{ director_name: null, ... }` with empty arrays, no throw.
  - Malformed cast/crew arrays (missing id, missing name) degrade gracefully.
- Backfill script logs row count, batch progress, and any extraction errors without crashing.
- Forward path: new classification rows written after migration populate all five columns.

### Phase 3 — Graph Retrieval Implementation

File: `server/src/services/ragRetriever.js` — add `graphSearch()` method.

```
async graphSearch(metadata, classificationId, limit, options)
```

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

Scoring: `match_score` is a bitmask (collection=8, director=4, studio=2, cast=1). This
ranks items that match on multiple dimensions above those that match on only one.

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
- Pass graph results as a third input to `calculateRRF()` (or a new `calculateThreeWayRRF()`).
- Apply `rag_graph_weight` to scale graph RRF contribution relative to vector and text.
- Add `graphMatches` count to the `ragLogger.logOperation('hybrid_search', ...)` metadata.

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
- Audit the existing RAG/embedding settings page in `client/src/views` or equivalent.
- Add toggle controls for `rag_graph_enabled` and dimension toggles
  (`rag_graph_collection_enabled`, `rag_graph_director_enabled`, etc.).
- Add `rag_graph_weight` numeric input (0.00–1.00, step 0.01).
- No new views required; extend the existing settings panel.

Acceptance criteria:
- When `rag_graph_enabled = false` (default), no graph queries run and performance is
  identical to pre-286.
- Graph observability fields appear in RAG operation logs for every `hybrid_search` where
  graph was attempted.
- Settings UI accepts and saves all graph config fields without a page reload.

### Phase 5 — Backfill and Data Quality

Backfill execution plan:
- Run `backfillGraphRelationships.js` against the production database before enabling
  `rag_graph_enabled`.
- Batch size: 500 rows. Sleep 50ms between batches to avoid lock contention.
- Log start row count, end row count, and fill rate for each column after completion.
- Target: populate relationship columns for at least 80% of existing rows that have
  non-null `metadata`.

Fill-rate monitoring:
- Add a diagnostic query to the existing RAG health check or a one-time script:
  ```sql
  SELECT
    COUNT(*) as total,
    COUNT(director_name) as has_director,
    COUNT(primary_studio_name) as has_studio,
    COUNT(genre_ids) FILTER (WHERE array_length(genre_ids,1) > 0) as has_genres,
    COUNT(cast_ids) FILTER (WHERE array_length(cast_ids,1) > 0) as has_cast,
    COUNT(collection_id) as has_collection
  FROM classification_history
  WHERE metadata IS NOT NULL;
  ```
- Document fill-rate results before enabling graph retrieval for validation.

Acceptance criteria:
- Backfill runs to completion without errors on a test copy of the database.
- Fill rates are documented for director, studio, genre_ids, cast_ids, collection_id.
- Any row with `metadata IS NULL` is left unchanged (no null-dereference errors).
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

### Schema changes summary

**`classification_history`** (new nullable columns):

| Column | Type | Index |
|---|---|---|
| `director_name` | `varchar(255)` | B-tree (partial WHERE IS NOT NULL) |
| `primary_studio_name` | `varchar(255)` | B-tree (partial WHERE IS NOT NULL) |
| `genre_ids` | `integer[]` | GIN |
| `cast_ids` | `integer[]` | GIN |
| `cast_names` | `text[]` | None (display only) |

**`embedding_config`** (new columns, all with safe defaults).

## Section-to-Implementation Binding

Status legend:
- `New`: does not exist yet; this issue creates it.
- `Extend`: exists; this issue modifies or augments it.

| Component | Status | Notes |
|---|---|---|
| `ragGraphExtractor.js` | New | Phase 2 |
| `ragRetriever.graphSearch()` | New | Phase 3 |
| `ragRetriever.hybridSearch()` — 3-way RRF | Extend | Phase 3 |
| `ragRetriever.calculateRRF()` — third input | Extend | Phase 3 |
| `classification_history` columns | Extend | Phase 1 migration |
| `embedding_config` graph fields | Extend | Phase 1 migration |
| Classification write paths | Extend | Phase 2 — populate new columns on save |
| `backfillGraphRelationships.js` | New | Phase 2 backfill |
| RAG observability / rag_loop_trace | Extend | Phase 4 |
| Settings API (graph config r/w) | Extend | Phase 4 |
| Settings UI (graph config controls) | Extend | Phase 4 |

## Implementation Backlog Extract (Action-Critical)

1. Run Phase 0 audit: enumerate all `classification_history` write paths and sample
   `metadata jsonb` fill rates from the running database.
2. Write and test both migrations (Phase 1) in a local Postgres dev instance before
   shipping. Confirm `IF NOT EXISTS` guards on every ADD COLUMN.
3. Build `ragGraphExtractor.js` with full test coverage before wiring into write paths.
4. Update all `classification_history` INSERT paths to extract and store relationship columns.
5. Write and validate `backfillGraphRelationships.js` against a copy of production data.
6. Implement `graphSearch()` behind `rag_graph_enabled` flag (no behavior change when false).
7. Update `hybridSearch()` to call `graphSearch()` and apply 3-way RRF only when enabled.
8. Extend RAG observability to emit graph retrieval trace fields.
9. Extend settings API and UI to expose graph config flags.
10. Run backfill on production, document fill rates, then gate-check before enabling.
11. Enable `rag_graph_collection_enabled` + `rag_graph_director_enabled` first and monitor.

## Operational Risk and Mitigations

| Risk | Mitigation |
|---|---|
| Relationship column backfill takes too long on large history tables | Batch with sleep; run during low-activity window; set statement_timeout per batch |
| Graph hits add noise (low-precision cast/studio matches) | Studio and cast toggles default to `false`; must be explicitly opted in |
| Jsonb field naming varies between TMDB movie vs TV vs OMDB shapes | Phase 0 audit enumerates all shapes; `ragGraphExtractor` handles all variants with fallbacks |
| graphSearch adds query latency | B-tree and GIN indexes are fast; expected p95 < 5ms; if over 20ms, index type must be reviewed |
| Graph results could skew AI context toward a franchise when query is ambiguous | Graph weight is a separate configurable dimension; lower `rag_graph_weight` or disable dimensions |
| `collection_id` may be NULL for many films (no TMDB collection) | Handled gracefully; collection dimension is skipped if NULL |

## Dependencies

- No new npm packages required.
- No new infrastructure services required.
- Postgres array operators (`&&`) require no additional extension; they are built-in.
- If `intarray` extension is available, `gin__int_ops` can be used for more efficient
  integer array GIN indexes. Fall back to standard array GIN if extension is not loaded.
  Check with `SELECT * FROM pg_extension WHERE extname = 'intarray'`.

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
