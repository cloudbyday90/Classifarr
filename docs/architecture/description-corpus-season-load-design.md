# Description corpus season-mapping load study

Reviewed November 24, 2026. PostgreSQL confirmed that the November 23
description corpus cancellation hit the existing 15-second statement
deadline. The same incident reference appeared in the refresh's caught-up
message two minutes later. The retained evidence cannot establish which part
of the workload consumed the deadline.

| Option | Benefit | Cost |
| --- | --- | --- |
| Reuse the existing warmed fixtures alone | Direct comparison with the October baseline | No season-mapping expansion |
| Add a bounded synthetic season workload to the existing profiler | Exercises the same SELECT and adds join and expansion evidence under controlled overlap | Synthetic, warmed reads cannot recreate the historical workload |
| Change the query or raise its deadline | Could address a proven bottleneck | The observed cancellation alone cannot justify a specific change |

Keep the existing sparse and all-history baselines. Add a fixed synthetic
season-mapping arm using the checked-in schema, distinct typed season documents
and controls for excluded mappings and evidence-only documents. Compare single
and paired reads, ordinary query and preparation elapsed time, sanitized plan
statistics and wait samples. Require exact output fingerprints for repeats of
each fixture. Keep the current lock control and confirm after-lock recovery.

Use the existing disposable loopback PostgreSQL runner and measured resource
limits. Keep the production statement, lock, admission, retry and cache
contracts. Use no live data, provider requests or production writes in the
study. The earlier recovery is evidence of completed refresh, and timing from
a subsequent synthetic run remains evidence about that run alone.

PostgreSQL distinguishes SQLSTATE `57014` from the specific reason a query
was cancelled. The server log establishes the statement timeout here.
`EXPLAIN ANALYZE` executes the query with instrumentation, and text
serialization measurement excludes network transfer. Wait samples describe
the observed sessions and do not measure continuous time in a wait.
Sources verified using MCP for the deployed PostgreSQL 18 major.
[PostgreSQL error codes](https://www.postgresql.org/docs/18/errcodes-appendix.html)
[Statement and lock timeouts](https://www.postgresql.org/docs/18/runtime-config-client.html)
[EXPLAIN](https://www.postgresql.org/docs/18/sql-explain.html)
[Wait events](https://www.postgresql.org/docs/18/monitoring-stats.html)
