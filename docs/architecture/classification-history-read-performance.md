# Classification History Read Performance

Status: implemented

Reviewed: 2026-08-09

## Scope

`GET /api/classification/history` presents one final outcome for each stable
media identity and includes the related lifecycle events for the requested
page. It must continue to return an exact filtered total and preserve history;
it does not delete, merge, or modify classification records.

## Problem

The former query ranked complete history rows, including large JSONB metadata,
then used a lateral query that read the ranked result again for every page item.
With a page of 50 outcomes, that could repeat lifecycle work up to 50 times and
exhaust the 30-second PostgreSQL statement timeout.

The previous Vite asset warning was a separate deployment-cache case. A retired
content-hashed asset now terminates at the `/assets` handler with a bounded 404
response, so it never falls through to the application shell or ErrorHandler.

## Options Considered

1. Keep the window-ranked CTE and lateral lifecycle query.
   - Pros: Existing single-query shape and exact lifecycle output.
   - Cons: A multi-reference CTE can materialize; the lateral read repeats the
     full ranked result for each page item.

2. Fetch lifecycle events with one additional application query per outcome.
   - Pros: Simple SQL per query.
   - Cons: Creates an N+1 request pattern, adds pool pressure, and becomes less
     reliable as page size grows.

3. Use indexed `DISTINCT ON` canonical selection and one set-based lifecycle
   aggregation for the page.
   - Pros: Ranks only identifiers, selects a single canonical row per identity,
     aggregates matching lifecycle events once, retains exact totals, and keeps
     the API response contract unchanged.
   - Cons: Maintains one additional expression B-tree index and still computes
     an exact count, which necessarily considers all filtered canonical rows.

## Final Recommendation

Adopt option 3.

- `DISTINCT ON` selects the current final outcome using the deterministic
  identity, outcome priority, `created_at DESC`, and `id DESC` ordering.
- `idx_classification_history_canonical_outcome` mirrors that ordering so
  PostgreSQL can use a B-tree access path as history grows.
- A page-identity CTE drives one lifecycle aggregation instead of a lateral
  scan per returned outcome.
- Pagination orders by `created_at DESC, id DESC`; the id tie-breaker prevents
  unstable pages when records share a timestamp.
- A genuine PostgreSQL statement timeout is logged with request context and
  returned as a bounded `503` with `Retry-After: 1`, rather than an opaque
  application `500`.

PostgreSQL documents that B-tree indexes can produce ordered output and are
particularly useful with `ORDER BY` plus `LIMIT`; it also documents the
materialization trade-off for CTEs referenced more than once. See
[Indexes and ORDER BY](https://www.postgresql.org/docs/current/indexes-ordering.html),
[WITH Queries](https://www.postgresql.org/docs/current/queries-with.html), and
[LIMIT and OFFSET](https://www.postgresql.org/docs/current/queries-limit.html).

## Security And Operational Boundaries

- The endpoint remains read-only and all values remain parameterized.
- No new media metadata, configuration, credentials, or AI-provider payloads
  are exposed; the existing history response shape is retained.
- The migration only creates an index. It does not rewrite or remove history.
- The migration runner is transactional, so the index intentionally uses a
  standard `CREATE INDEX`, not `CREATE INDEX CONCURRENTLY`.
- Static asset misses return a short JSON 404. Express static middleware normally
  falls through on a missing file, so this explicit terminal handler prevents
  stale asset URLs from reaching the SPA fallback.

## Acceptance Evidence

- Focused route, ErrorHandler, and static-delivery tests pass.
- The local persisted installation applied
  `20260809_010000_add_canonical_history_outcome_index.sql`.
- `EXPLAIN ANALYZE` on the live handler uses the canonical index for lifecycle
  lookup and completed within approximately 0.5 seconds for the local
  6,731-row history dataset.
