# pgvector Retrieval Recall Tuning

Date: 2026-06-06  
Status: Implemented for `Unreleased`

## Problem

Classifarr's RAG loop uses pgvector HNSW search to retrieve prior classification examples, then policy/profile/history evidence decides whether a candidate is viable. The bug pattern we investigated was not simply "RAG picked the wrong library"; the failure was that a narrow approximate retrieval window made the downstream decision layer depend too heavily on whichever candidates survived the first HNSW scan.

The Office Romance investigation showed this shape:

- RAG produced a high similarity candidate for `Family`.
- Profile evidence correctly applied a hard `R` rating exclusion against `Family`.
- Other candidates such as `Comedy and Standup` received profile compatibility from broad `Comedy` evidence, even though generic comedy is not deterministic stand-up evidence.
- The retrieval trace did not persist enough recall-tuning context to tell whether better candidates were never retrieved or retrieved and rejected.

The policy evidence hardening work blocks weak candidates from becoming final anchors. This document covers the retrieval side: make pgvector candidate recall harder to starve before the deterministic policy/profile layer can evaluate the alternatives.

## Official Source Research

- pgvector documents that exact nearest-neighbor search has perfect recall, while approximate indexes trade recall for speed. For HNSW, `hnsw.ef_search` controls the dynamic candidate list, defaults to `40`, and higher values improve recall at the cost of speed. Source: [pgvector README](https://github.com/pgvector/pgvector).
- pgvector 0.8+ supports iterative index scans. Iterative scans can scan more of the index until enough results are found or scan caps are reached. `relaxed_order` can improve recall while allowing slightly out-of-order distance results; strict ordering is available when exact distance ordering matters. Source: [pgvector README](https://github.com/pgvector/pgvector).
- PostgreSQL `EXPLAIN` is the official way to inspect whether a query uses an index scan, sequential scan, joins, and estimated costs. `EXPLAIN ANALYZE` executes the query and adds profiling overhead, so it should be used intentionally during diagnostics. Source: [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/sql-explain.html).
- PostgreSQL `ANALYZE` updates planner statistics used to select efficient execution plans. Source: [PostgreSQL ANALYZE](https://www.postgresql.org/docs/current/sql-analyze.html).
- PostgreSQL partial indexes can reduce index size and speed specific query shapes, but they require predicates that match query filters and are not a substitute for partitioning. Source: [PostgreSQL Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html).

## Recommendations Considered

### Raise `hnsw.ef_search` Globally

Pros:

- Simple.
- Directly matches pgvector's HNSW recall control.
- Helps all semantic searches.

Cons:

- Raises latency for every vector lookup.
- Does not distinguish user-facing search from candidate-gathering searches where recall matters more than latency.

### Candidate-Specific Recall Defaults

Pros:

- Targets the higher-risk path: RAG loop and policy re-check candidate gathering.
- Keeps normal semantic search less expensive.
- Preserves operator overrides through environment variables.

Cons:

- Adds one more tuning concept.
- Requires documentation so operators understand why candidate search uses a different default.

### Enable pgvector Iterative HNSW Scans

Pros:

- Official pgvector 0.8+ mechanism for improving recall when approximate scans do not return enough useful rows.
- `relaxed_order` is appropriate for Classifarr because the SQL query re-sorts the selected candidate set by combined similarity after the vector scan.

Cons:

- Requires pgvector 0.8+ for full effect.
- Can increase query work under low-selectivity searches.

### Add Partial or Partitioned Vector Indexes by Library

Pros:

- Can improve filtered search performance when the query has stable, selective predicates.
- Useful future lever if data volume grows substantially.

Cons:

- Current retrieval intentionally searches across libraries before policy/profile selection, so per-library partial indexes do not match the main query shape.
- PostgreSQL partial indexes require predicate alignment; a large family of per-library indexes would be hard to maintain and can be counterproductive.

### Exact Search Fallback

Pros:

- Provides perfect recall for diagnostics or low-row-count datasets.
- Useful as a future audit mode to compare approximate vs exact candidate sets.

Cons:

- Expensive for normal runtime.
- Needs careful operator controls so it cannot degrade embedded PostgreSQL under load.

## Final Recommendation Stack

Implemented:

- Centralize pgvector recall settings in `pgvectorRecallTuning.mjs`.
- Keep normal semantic search default `PGVECTOR_EF_SEARCH=80`.
- Raise candidate-gathering default `PGVECTOR_EF_SEARCH_CANDIDATES` from `40` to `100`.
- Expand the vector CTE candidate pool from `max(limit * 5, 25)` capped at `200` to bounded defaults of `max(limit * 10, 50)` capped at `200`.
- Enable `PGVECTOR_HNSW_ITERATIVE_SCAN=relaxed_order` by default.
- Expose advanced caps for `PGVECTOR_HNSW_MAX_SCAN_TUPLES` and `PGVECTOR_HNSW_SCAN_MEM_MULTIPLIER`.
- Clamp all env-provided values to bounded ranges before applying them to query-local pgvector settings.
- Log bounded pgvector recall settings and candidate limits with semantic search start/completion events.

Not implemented in this slice:

- Exact-search recall audit mode.
- Per-library partial/partitioned vector indexes.
- Automatic EXPLAIN collection.

Those should be separate work items because they change operational cost and database maintenance posture.

## Security And Operations Constraints

- Runtime tuning is controlled only by environment variables read server-side. No user request can directly set pgvector session parameters.
- Env values are parsed as integers or enum values and clamped before being passed as query parameters to `set_config`.
- Settings are applied inside the existing transaction with `set_config(..., true)`, keeping them local to the transaction.
- Logs include tuning numbers and candidate counts only; they do not include embedding vectors or raw private metadata.
- Defaults are bounded for embedded PostgreSQL. Operators with larger deployments can raise limits deliberately.

## Validation

Automated validation:

- Unit tests cover default tuning values, clamp behavior, query-local pgvector settings, disabled iterative scan behavior, candidate-specific `ef_search`, and broader vector candidate limits.
- Existing RAG retriever tests still verify `hnsw.ef_search` is applied before the vector CTE and that connection cleanup happens on query failure.

Manual diagnostic commands for operators:

```bash
docker exec Classifarr sh -lc '
export PGUSER="${POSTGRES_USER:-classifarr}"
export PGDATABASE="${POSTGRES_DB:-classifarr}"
psql -P pager=off -x -c "
SELECT name, setting, source
FROM pg_settings
WHERE name IN (
  '\''hnsw.ef_search'\'',
  '\''hnsw.iterative_scan'\'',
  '\''hnsw.max_scan_tuples'\'',
  '\''hnsw.scan_mem_multiplier'\''
)
ORDER BY name;
"
'
```

```bash
docker exec Classifarr sh -lc '
export PGUSER="${POSTGRES_USER:-classifarr}"
export PGDATABASE="${POSTGRES_DB:-classifarr}"
psql -P pager=off -x -c "
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename = '\''classification_embeddings'\''
ORDER BY indexname;
"
'
```

## Three High-Value Follow-Up Design Items

1. Exact-vs-approximate recall audit mode

   Intent: add an admin-only diagnostic that compares HNSW results against exact vector search for a bounded sample of classifications.

   Why it fits next: it turns "did retrieval miss better evidence?" into a measurable answer instead of relying on screenshots and manual SQL.

   Platform benefit: safer tuning, measurable recall drift, and concrete evidence before changing pgvector defaults again.

2. Candidate explanation API

   Intent: expose a structured API response that shows each candidate's retrieval source, profile score, policy viability, exclusion hits, and final acceptance/rejection reason.

   Why it fits next: we now persist richer evidence snapshots, but the UI and support workflow still need a canonical machine-readable explanation endpoint.

   Platform benefit: better operator trust, easier bug reports, and less need for direct PostgreSQL inspection.

3. Profile/policy replay harness

   Intent: create a deterministic replay command that re-evaluates saved classification metadata against current policy/profile logic without invoking AI providers.

   Why it fits next: we have repeatedly fixed policy/profile scoring rules. A replay harness would prove historical incidents stay fixed as logic evolves.

   Platform benefit: regression prevention, safer re-architecture, and faster validation before release.
