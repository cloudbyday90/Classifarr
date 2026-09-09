# PostgreSQL 18 platform enhancement recommendations

## Decision

Do not perform a PostgreSQL major-version upgrade in this change. The local
compose service already runs PostgreSQL 18.6, which is the supported current
major for this repository. It uses the PostgreSQL 18 asynchronous I/O worker
method with both I/O concurrency settings at their default value of 16.

The passive, fixed aggregate database-health summary is now implemented. It
reads only server counters that already exist, buckets them server-side,
requires administrator authorization, and never returns SQL, query IDs, media,
library, provider, configuration, policy, AI, or routing data. Its companion
server-owned transition observer now establishes a baseline, resets it whenever
PostgreSQL counters reset, and retains an append-only receipt only after two
matching changed bucket observations. Neither path changes application behavior
or runs maintenance work.

## Local evidence

| Setting or facility | Observed value | Interpretation |
| --- | --- | --- |
| Server version | PostgreSQL 18.6 | No major upgrade is pending. |
| `io_method` | `worker` | PostgreSQL 18 asynchronous I/O is active. |
| `effective_io_concurrency` | `16` | Current PostgreSQL 18 default. |
| `maintenance_io_concurrency` | `16` | Current PostgreSQL 18 default. |
| `autovacuum` | `on` | Routine maintenance is automatic. |
| `track_io_timing` | `off` | Avoids timing overhead until a measured need exists. |
| `pg_stat_statements` | preloaded, version 1.12 | Useful for database administrators, but its query-level data must remain private. |
| `vector` | 0.8.6 | Existing vector capability remains available. |

## Candidate enhancements

| Candidate | Advantages | Costs and limits | Recommendation |
| --- | --- | --- | --- |
| Keep PostgreSQL 18 AIO defaults | Already improves eligible reads and maintenance without new application work. | Raising concurrency without evidence can increase contention. | Retain `worker` and both values at 16; benchmark a configuration change only after a passive signal persists. |
| Aggregate `pg_stat_io` health summary | Shows database I/O direction without collecting application content or SQL. | Counters reset and need a documented observation window. | Implemented with a parameter-free, administrator-only fixed-bucket endpoint. |
| Server-owned bucket-transition receipt | Identifies a two-observation, current-reset-period bucket transition without raw measurements or operator input. | It deliberately delays recognition and remains advisory rather than a diagnosis. | Implemented; see [Database Health Transition Receipt Outcome](database-health-transition-receipt-outcome.md). |
| Preserve autovacuum | Reclaims dead tuples, refreshes planner statistics, and prevents transaction-ID wraparound automatically. | High-write tables might eventually need measured, table-specific tuning. | Retain defaults. Add a bounded aggregate warning only when a measured threshold persists. Do not schedule `VACUUM FULL`. |
| Use B-tree skip scans | PostgreSQL can automatically use qualifying multicolumn indexes in more plans. | The planner decides; creating speculative indexes adds write cost. | Make no schema change. Evaluate an index only from a safe maintenance-time plan review after receipt evidence shows a bottleneck. |
| Expose `pg_stat_statements` | Gives database administrators query execution aggregates. | The extension tracks per-statement information and can reveal operational structure. It is currently configured to track all statements and save stats across restarts. | Keep it out of application APIs and automation. Keep planning tracking disabled. If a future privileged tool uses it, call the function with query text suppressed and return only a fixed aggregate projection. |
| Enable `track_io_timing` | Adds exact I/O timing to some database diagnostics. | PostgreSQL documents clock-read overhead, so it changes runtime cost. | Leave off. Evaluate only in a controlled benchmark after `pg_stat_io` and receipt buckets establish a persistent I/O concern. |

## Security boundary

PostgreSQL monitoring roles can expose database-wide settings and statistics.
Any future collector therefore needs a narrowly scoped database role and a
server-owned allow-list query. It must not return `pg_stat_statements.query`,
query IDs, user IDs, database IDs, raw errors, or configuration values. The
application should expose only coarse counters and a freshness bucket, and it
must treat the result as observation rather than input to policy, AI, semantic
selection, labels, or routing.

## Research basis

- [PostgreSQL 18 release notes](https://www.postgresql.org/docs/18/release-18.html)
  document asynchronous I/O, `pg_aios`, skip scans, and the PostgreSQL 18
  default I/O concurrency values.
- [PostgreSQL resource-consumption settings](https://www.postgresql.org/docs/18/runtime-config-resource.html)
  explain the `worker`, `io_uring`, and `sync` I/O methods and caution that
  unnecessarily high concurrency can increase overall I/O latency.
- [PostgreSQL monitoring](https://www.postgresql.org/docs/18/monitoring.html)
  documents `pg_stat_io` and related cumulative statistics.
- [PostgreSQL routine vacuuming](https://www.postgresql.org/docs/18/routine-vacuuming.html)
  recommends automatic vacuuming and explains why routine `VACUUM FULL` is
  unsuitable for normal operations.
- [PostgreSQL `pg_stat_statements`](https://www.postgresql.org/docs/18/pgstatstatements.html)
  documents query-statistics collection, its memory and restart behavior, and
  the text-suppression function.
- [PostgreSQL `EXPLAIN`](https://www.postgresql.org/docs/18/sql-explain.html)
  documents timing overhead and buffer reporting.

## Next item

The transition receipt is implemented in
[Database Health Transition Receipt Outcome](database-health-transition-receipt-outcome.md).
Allow one current PostgreSQL statistics period of ordinary observations before
considering a bounded readiness projection. It must remain advisory and must
not add raw values, source dimensions, query execution, maintenance, policy,
AI, semantic evidence, labels, or routing authority.
