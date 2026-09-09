# Passive database health summary outcome

## Decision

Classifarr now provides `GET /api/stats/database-health-summary`: a passive,
administrator-authorized observation of PostgreSQL's existing cumulative
statistics. It is intentionally separate from the public liveness and
readiness probes. The endpoint reads no application data, accepts no
parameters, and cannot execute maintenance or alter configuration.

The implementation returns the observation directly rather than storing a new
history. PostgreSQL already retains these cumulative counters. Avoiding a new
receipt table keeps the first implementation library- and
configuration-agnostic and avoids creating a second source of operational
truth.

## Contract

The versioned response is limited to:

```json
{
  "version": "database.health_summary.v1",
  "observedAt": "2026-09-09T12:00:00.000Z",
  "statisticsResetAt": "2026-09-08T00:00:00.000Z",
  "io": {
    "readOperations": "none | low | moderate | high",
    "writeOperations": "none | low | moderate | high",
    "cacheHits": "none | low | moderate | high"
  },
  "tableStatistics": {
    "estimatedDeadTuples": "none | low | moderate | high",
    "tablesWithDeadTuples": "none | low | moderate | high"
  }
}
```

`observedAt` states when the server read the aggregate. `statisticsResetAt`
states the start of the PostgreSQL cumulative-counter period; a consumer must
not compare values across a reset as if they were a continuous trend. Every
numeric source value is converted server-side to one of the fixed buckets:
`none` for zero, `low` through 999, `moderate` through 99,999, and `high`
thereafter. Invalid source values fail closed to `none`, while invalid
timestamps are `null`.

No SQL, query ID, table name, schema, database name, account identity, media,
library, provider, configuration, policy, AI, semantic evidence, label, or
routing field crosses the service boundary.

## Design and security boundary

The modular path is deliberately narrow:

1. `databaseHealthSummaryRepository.mjs` runs one fixed aggregate over
   `pg_stat_io` for relation I/O and `pg_stat_user_tables` for aggregate dead
   tuple information.
2. `databaseHealthSummary.mjs` accepts only the six selected fields and builds
   the versioned bucket contract.
3. `databaseHealthSummaryService.mjs` supplies the server-owned observation
   time and has no write, maintenance, provider, policy, or routing dependency.
4. `statsRouteDatabaseHealthSummary.mjs` requires an administrator before the
   limiter, sets `Cache-Control: no-store`, rejects every query parameter, and
   exposes the result through the existing authenticated stats API.

The route accepts administrator API keys and administrator sessions through the
existing stats-router authorization middleware. It is rate-limited to 30 reads
per IP per 15 minutes. Neither non-administrators nor requests with a caller
dimension reach the database aggregate.

This follows the W3C guidance to publish a stable, documented, versioned API
with provenance while protecting sensitive operational information through
authorization. The endpoint supplies its observation and reset provenance,
but does not publish the detailed statistics that PostgreSQL makes available to
privileged database roles.

## Research and recommendations

| Candidate | Advantages | Costs and limits | Recommendation |
| --- | --- | --- | --- |
| Fixed aggregate summary | Gives future automation a consistent signal without learning media, library, policy, or provider identity. | Cumulative counters lag, reset, and do not provide a complete operating-system view. | Implemented. Preserve the version and bucket vocabulary. |
| Direct `pg_stat_*` or `pg_stat_statements` API | Could support detailed diagnosis. | Exposes table, query, user, database, and configuration-adjacent detail; creates an operational console. | Do not expose it through Classifarr. |
| Automatic vacuum, tuning, or index work from this signal | Could reduce manual intervention. | A coarse cumulative observation cannot establish a safe root cause and automatic maintenance can affect availability. | Do not add a control path. |
| Server-owned multi-observation receipt | Identifies a two-observation, current-reset-period bucket transition without raw measurements or operator input. | It deliberately trades immediate detection for trend confirmation and remains advisory. | Implemented; see [Database Health Transition Receipt Outcome](database-health-transition-receipt-outcome.md). |

### Final recommendation stack

1. Retain the parameter-free, administrator-only, `no-store` endpoint as an
   observation contract for future automation.
2. Treat `statisticsResetAt` as a mandatory comparison boundary and never
   interpret the buckets as per-library, per-query, or per-policy data.
3. Keep PostgreSQL's normal automatic maintenance and current configuration;
   do not enable query-level observation or automate maintenance from a single
   bucketed read.
4. The server-owned, fixed bucket-transition receipt now records only a
   two-observation, current-reset-period change. It remains library- and
   configuration-agnostic, retains no raw counts, and has no action, policy,
   AI, semantic-selection, label, or routing authority. See
   [Database Health Transition Receipt Outcome](database-health-transition-receipt-outcome.md).

## Verification

- The pure projection, fixed-query repository, service-owned timestamp, route
  authorization, rate-limit registration, no-store response, and
  parameter-rejection tests pass: 8 backend tests.
- The client API leaf calls only the parameter-free endpoint: 24 tests pass in
  the focused API suite.
- Server and client type checks and server lint pass. Client lint has only the
  existing warnings in `PolicyPurposeDeclarationWorklist.vue`.

## Research basis

- [PostgreSQL 18 cumulative statistics](https://www.postgresql.org/docs/current/monitoring-stats.html)
  documents the scope, visibility, flush timing, caching, and reset behavior of
  `pg_stat_io` and `pg_stat_user_tables`.
- [PostgreSQL predefined roles](https://www.postgresql.org/docs/current/predefined-roles.html)
  documents the extra visibility granted by `pg_read_all_stats`, supporting a
  narrow application response instead of forwarding database statistics.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) recommends
  stable, documented APIs, provenance, versioning, explanations for unavailable
  data, and access controls appropriate to sensitive data.

## Next item

The passive receipt is implemented in
[Database Health Transition Receipt Outcome](database-health-transition-receipt-outcome.md).
Let it collect ordinary observations for one current statistics period before
considering a further, bounded readiness projection. No future endpoint should
add raw values, source dimensions, maintenance, or routing authority.
