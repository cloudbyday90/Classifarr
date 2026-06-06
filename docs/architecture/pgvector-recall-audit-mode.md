# pgvector Recall Audit Mode

Date: 2026-06-06
Status: Implemented for `Unreleased`

## Intent

Add an admin-only diagnostic that compares pgvector HNSW approximate nearest-neighbor results against an exact nearest-neighbor baseline for a bounded sample of existing classification embeddings.

This is not a classification feature and it does not change policy outcomes directly. It is an operator diagnostic for answering one concrete question: did approximate retrieval miss neighbors that exact vector search would have returned?

## Official Source Research

- pgvector documents that exact nearest-neighbor search provides perfect recall, while approximate indexes trade recall for speed and may return different results after an approximate index is added. Source: [pgvector README](https://github.com/pgvector/pgvector).
- pgvector recommends monitoring recall by comparing approximate search with exact search, and shows using `SET LOCAL enable_indexscan = off` inside a transaction to force exact search for the comparison query. Source: [pgvector README](https://github.com/pgvector/pgvector).
- pgvector's HNSW query option `hnsw.ef_search` controls the dynamic candidate list for search. Higher values improve recall at the cost of speed, and pgvector recommends `SET LOCAL` for query-scoped changes. Source: [pgvector README](https://github.com/pgvector/pgvector).
- pgvector notes that filtered approximate searches apply filters after the index scan, so low-selectivity filters can return fewer useful rows unless iterative scans or other indexing strategies are used. Source: [pgvector README](https://github.com/pgvector/pgvector).
- PostgreSQL `EXPLAIN` and `EXPLAIN ANALYZE` are the official tools for plan and runtime diagnostics, but `EXPLAIN ANALYZE` executes the statement and adds profiling overhead. Source: [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/sql-explain.html).
- PostgreSQL `ANALYZE` updates planner statistics used to choose efficient query plans. Source: [PostgreSQL ANALYZE](https://www.postgresql.org/docs/current/sql-analyze.html).

## Options Considered

### API-Only Audit Endpoint

Pros:

- Easy for the existing web UI and support workflow to consume.
- Inherits the `/api/rag` admin-only route gate.
- Can validate and bound all inputs centrally.

Cons:

- Long-running diagnostics compete with normal server traffic if left unbounded.
- Requires careful response shaping to avoid leaking vectors or raw metadata.

### CLI Script Only

Pros:

- Keeps expensive diagnostics out of the web API.
- Useful for container support sessions.

Cons:

- Requires shell access to the host/container.
- Does not support future UI observability without duplicating logic.

### Persist Audit Results

Pros:

- Historical trend tracking.
- Useful for release validation dashboards.

Cons:

- Requires a new table and retention policy.
- Adds storage and privacy considerations before we know which fields are operationally useful.

### On-Demand Bounded Audit

Pros:

- Minimal schema impact.
- Safe default for embedded PostgreSQL.
- Provides immediate diagnostic value.
- Can become the backing service for future persisted reports or UI charts.

Cons:

- Results are point-in-time only.
- Operators need to rerun audits after tuning changes.

## Final Recommendation Stack

Implemented:

- Add `pgvectorRecallAuditService.mjs` as the deterministic audit primitive.
- Add `GET /api/rag/retrieval/recall-audit`.
- Sample only existing non-stale classification embeddings with final library assignments.
- Support an explicit `classification_id` audit or a bounded recent sample.
- Bound `sample_size` to `1..10` and `limit` to `1..25`.
- Run approximate search with the same query-local pgvector recall tuning used for candidate search.
- Run exact baseline search inside a transaction with `SET LOCAL enable_indexscan = off`.
- Compare result IDs and return recall, overlap, missed exact neighbors, and approximate-only neighbors.
- Return only bounded classification metadata and scores. Do not return vectors, prompts, overviews, provider payloads, or raw metadata.
- Adjust the normal semantic retrieval CTE to order by the pgvector distance operator directly, preserving HNSW index eligibility.

Deferred:

- Persisted audit history.
- UI charting.
- Automatic scheduled recall audits.
- EXPLAIN plan collection.

## API Shape

Endpoint:

```http
GET /api/rag/retrieval/recall-audit?sample_size=3&limit=10
GET /api/rag/retrieval/recall-audit?classification_id=12345&limit=10
```

Response:

```json
{
  "mode": "exact_vs_approximate",
  "checked_at": "2026-06-06T00:00:00.000Z",
  "options": {
    "classification_id": null,
    "sample_size": 3,
    "limit": 10
  },
  "approximate_settings": {
    "ef_search": 100,
    "iterative_scan": "relaxed_order",
    "max_scan_tuples": null,
    "scan_mem_multiplier": null
  },
  "summary": {
    "sample_count": 3,
    "average_recall": 0.9,
    "min_recall": 0.8,
    "samples_with_misses": 1
  },
  "samples": []
}
```

## Security And Operational Constraints

- The route is mounted under `/api/rag`, which is already protected by `authenticateToken` and `requireAdmin`.
- Query parameters are parsed as integers and rejected outside hard bounds.
- Vectors never leave PostgreSQL.
- Exact search is transaction-local and uses `SET LOCAL enable_indexscan = off`, so it does not alter global planner settings.
- Approximate search settings are transaction-local through the existing pgvector recall tuning helper.
- The endpoint is read-only and does not persist audit results.
- Output is bounded by `sample_size * limit`.

## Validation

Automated validation:

- Unit tests cover recall math, missed/extra neighbor reporting, input bounds, exact-mode `enable_indexscan` behavior, and no-source behavior.
- Integration tests cover the RAG route returning a safe empty audit and rejecting unbounded limits.
- RAG retriever tests now assert the semantic CTE orders by `ce.embedding <=> $1::vector` directly so the HNSW index remains eligible.

Manual operator usage:

```bash
curl -s "http://<host>:21324/api/rag/retrieval/recall-audit?sample_size=3&limit=10" \
  -H "Authorization: Bearer <admin-token>"
```

## Three High-Value Follow-Up Design Items

1. Candidate explanation API

   Intent: expose one canonical explanation payload per candidate, including retrieval rank, profile score, policy viability, exclusion hits, and final accept/reject reason.

   Why it fits next: recall audit tells us whether retrieval found the right neighbors; candidate explanation tells us why the decision layer did or did not use them.

   Platform benefit: fewer PostgreSQL support sessions and clearer operator trust in automated outcomes.

2. Profile/policy replay harness

   Intent: replay saved classification incidents through deterministic profile and policy logic without AI calls.

   Why it fits next: we have hardened retrieval and evidence anchoring; replay proves those rules stay fixed across future refactors.

   Platform benefit: release safety, regression prevention, and faster validation of incident-specific fixes.

3. Preset semantics audit and migration assistant

   Intent: detect presets that rely on broad compatibility terms as if they were identity evidence, then recommend explicit `identity` or `compatibility` semantics.

   Why it fits next: our Office Romance investigation showed broad genre signals can over-influence specialized destinations. Preset semantics are the durable data-side complement to scoring hardening.

   Platform benefit: cleaner policy configuration, fewer false positives, and better explainability for niche libraries.

