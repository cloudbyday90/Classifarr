# Embedded database probe diagnostics

Date: 2026-10-09. Baseline: `bce87b3e`. Scope: explain slow liveness checks,
not alter shutdown, ownership, memory protection or production deployment.

## Evidence and contract

The [Unraid investigation](unraid-stop-investigation-outcome.md) established that
a probe timeout exhausted the supervisor's 15-second uncertainty period. PostgreSQL
then shut down cleanly. Existing logs cannot distinguish filesystem latency,
child startup/status latency and supervisor scheduling delay.

Keep the current single-flight check, two-second helper deadline, three-second
whole-check deadline, one-second cancellation join and 15-second grace period.
No SQL, additional child, network request, recovery loop or database write is added.
Adoption/identity checks and fail-closed handling are unchanged.

Add a small ESM diagnostic collector with a fixed set of stage names and numeric
fields. Record identity-before, status-child spawn/wait and identity-after timing;
capture the stage at helper/whole-check timeout, deadline overshoot and final join
outcome. Correlate a failure episode with an opaque ID, probe sequence and the last
healthy reference. Keep only the last healthy, first failed and latest samples.
Emit the first uncertainty and its recovery, cancellation or stop outcome, not a
log on every successful/retried probe. No unbounded history or extra timer.

Resource context describes the **supervisor**, not the application or PostgreSQL:
CPU-time delta, event-loop utilization and RSS. Include available/constrained
memory when sampling a diagnostic event; zero/unsupported values are unknown,
not proof of unlimited capacity. ELU is not CPU utilization. Missing telemetry
must never affect the probe result, cancel/join, ownership or shutdown path.

Only fixed enums, bounded numeric fields, generated IDs and timestamps are logged.
Never include PID-file contents, command lines, paths, environment, credentials,
SQL, raw errors or provider data. Existing container logs retain the trail across
ordinary restarts; recreation/log rotation can remove it. This is not a durable
incident database. Operators should preserve the bounded records when reporting.

## Options and recommendation stack

| Option | Benefit | Limitation |
| --- | --- | --- |
| Stage timing and bounded failure context | Identifies where a timeout occurred with little new work | Does not prove host I/O or CPU cause alone |
| Increase grace/deadlines now | May reduce stops | Conceals evidence and delays response to real database loss; deferred |
| Continuous tracing/heap snapshots | Detailed profiling | More overhead, sensitive data and storage; not justified here |
| Restart-policy correction | Recovers an exited container | Does not fix probe latency; production setting requires separate approval |

Recommend bounded diagnostics first, isolated slow-stage/cancellation tests,
then an approved deployed observation before selecting a behavioral fix. Preserve
security and resource safeguards. No fresh-install migration or backfill needed.

## Official sources

Discovered and retrieved on 2026-10-09:

- [Node 24 performance hooks](https://r2.nodejs.org/docs/latest-v24.x/api/perf_hooks.html):
  monotonic timing and event-loop utilization; utilization is not CPU usage.
- [Node process metrics](https://nodejs.org/download/release/v24.20.0/docs/api/process.html):
  CPU deltas, faster RSS-only sampling and constrained/available memory semantics.
- [PostgreSQL pg_ctl](https://www.postgresql.org/docs/current/app-pg-ctl.html):
  status examines process identity; a timeout is not exit status 3 (not running).

Completion requires stage attribution for synthetic slow checks, correct unchanged
failure decisions, safe output, real child cancellation coverage, and local image
verification. The outcome document records results and limits separately.
