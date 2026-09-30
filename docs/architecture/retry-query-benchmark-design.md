# Retry query benchmark design

Research and implementation: September 29, 2026. Scope: the measurable follow-up
to [credential-scoped retry waits](credential-scoped-retry-wait-outcome.md).
This is an offline engineering tool, not another scheduled service.

## Decision

Measure the actual parameterized production page, readiness and claim queries
before adding an index. Compare existing indexes against one experimental partial
B-tree on `(enrichment_type, priority, created_at, id) WHERE status='pending'`.
Do not apply that index to the application database in this round.

## Evidence and official guidance

Sources were discovered and opened through web tools, not inferred URLs.

- PostgreSQL recommends current statistics and representative data when assessing
  indexes. Synthetic distributions expose pathological cases but cannot establish
  production latency. Run `ANALYZE` after seeding each populated table.
  [Examining Index Usage](https://www.postgresql.org/docs/18/indexes-examine.html).
- `EXPLAIN ANALYZE` executes the statement, including updates. Each claim
  measurement gets a savepoint that is rolled back even on query failure. JSON
  plans support machine-readable diagnostics; timing instrumentation is disabled
  to reduce per-node overhead, while total execution time remains descriptive.
  [EXPLAIN](https://www.postgresql.org/docs/18/sql-explain.html).
- An index matching ordering can help `ORDER BY ... LIMIT`, but the planner can
  still choose a different plan. A page-size bound alone is not a scan-work bound.
  [Indexes and ORDER BY](https://www.postgresql.org/docs/18/indexes-ordering.html).
- A partial index must match the query's predicate; adding indexes also costs
  storage and write maintenance. Avoid speculative indexes for every condition.
  [Partial Indexes](https://www.postgresql.org/docs/18/indexes-partial.html) and
  [Multicolumn Indexes](https://www.postgresql.org/docs/18/indexes-multicolumn.html).
- W3C recommends polite, contextual status announcements for dynamic status
  updates. This work adds no UI or polling. A future user-facing measurement
  should use the existing pausable status surface, accessible text and a relevant
  next action, not announce raw benchmark counters continuously.
  [W3C ARIA22](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22).

## Architecture and safety

The ESM CLI reuses the existing disposable PostgreSQL lifecycle. Its default
container has a 2-CPU quota and 1 GiB memory limit. Credentials are generated for
that container; there are no database URL, image or credential CLI overrides.
Application configuration, provider clients and workers are not loaded.

Small modules separate snapshot installation, fixtures/oracles, production-query
capture, measurement and orchestration. Production services are unchanged.

The schema installer:

- Refuses databases outside the existing disposable benchmark/integration names.
- Creates a new `retry_query_benchmark` namespace, without `IF NOT EXISTS`.
- Copies eight allowlisted table definitions, primary/unique keys, indexes and
  two real credential views from the checked-in schema snapshot.
- Sets a transaction-local search path excluding `public`; snapshot references
  are rewritten to the private namespace. No production table is altered.
- Does not install foreign keys, triggers, sequence defaults or application jobs.
  The measurements are selection/claim query evidence, not complete write-path
  throughput evidence. Schema and SQL hashes identify what was measured.

Every scenario rolls back its entire schema and fixtures. `EXPLAIN ANALYZE` and
result verification use separate rollback savepoints. A final query verifies no
processing claims or tokens remain; another verifies the namespace was removed.
Statement, lock, idle-transaction and transaction deadlines bound database work.
Existing lifecycle cleanup closes the client and removes only its owned container.

Output includes allowlisted plan nodes, approximate rows/loops, root-level buffer
totals, sort/JIT information, planner settings and index bytes. Child buffer totals
are not summed into their parents. No raw plans, SQL, parameters, secrets, media
titles or responses are emitted. A CLI failure exits nonzero with a safe message.

## Reproduction and acceptance

Run from the repository root with development dependencies and Docker available:

```sh
npm run benchmark:retry-queries
```

The default uses 100,000 rows per populated scenario, three warmed repetitions,
and an independent fixture oracle. Internal test sizes are restricted to
300–300,000; the CLI deliberately accepts no flags. It covers:

| Dimension | Cases |
|---|---|
| Setup/backlog | Empty and unconfigured; all waiting; last 1% due; mixed guards; rotated credentials; rejected credentials; legacy cooldown; 95% terminal history |
| Provider type | OMDb, web search, historical Tavily |
| Query | First page, cursor at 90% of synthetic IDs, 51-row readiness lookahead, untargeted fallback claim, ID-targeted claim |
| Strategy | Current indexes, experimental pending-order index |

Mixed data includes twelve libraries, a disabled library, music items, existing
metadata, exhausted attempts, recent identity conflicts and monthly waits. The
readiness oracle includes ineligible pending rows because the UI must explain
them; its candidate flags are verified separately against eligibility.

Tests assert exact returned IDs/order, policy preservation, cleanup and refusal
boundaries. They do not assert machine-specific millisecond thresholds. Three
warmed samples are not an SLO or a production capacity estimate. The ID-targeted
claim excludes prior candidate discovery, provider admission and HTTP time.

## Alternatives and recommendation stack

| Option | Pros | Cons / decision |
|---|---|---|
| Existing PostgreSQL + production SQL + isolated harness | Repeatable, no live data or API spend, measures current safeguards | Synthetic distributions; keep and extend |
| Add ordered partial index immediately | Can reduce unrelated-provider scans and sorting | Extra storage/writes; does not fix expensive deep pages; do not ship yet |
| Refactor candidate selection using measured plans | Addresses candidate scan and repeated guard costs | Must prove ordering, cursor and eligibility equivalence; next implementation |
| Materialized eligibility or another queue system | Potentially cheaper reads | New invalidation, recovery and operational complexity; not justified yet |
| Disable JIT globally | Might reduce compilation overhead for these plans | Broad tuning change; does not fix repeated scans; not selected |

Recommended stack: **ESM modules → disposable PostgreSQL 18 → real production SQL
→ JSON EXPLAIN evidence → exact-ID regression tests → existing scheduler and
claim/admission guards**. No new production service, dependency or migration.

See the separate [outcome](retry-query-benchmark-outcome.md) for measured results
and the next acceptance target.
