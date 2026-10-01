# Autovacuum-first queue maintenance design

## Decision and evidence

We will keep retention cleanup, but let PostgreSQL own routine physical queue
maintenance. A conditional backend service can self-heal sustained pressure;
a fixed offline command remains available for operator recovery. This follows
the user's preference for logged, criteria-based automation rather than manual-only
recovery and continues the [image-index maintenance work](bounded-image-index-maintenance-outcome.md).
It does not activate database identity separation or require Compose/Unraid edits.

I inspected revision `d2090dfec1b4e98165fcc11746f741b31603635e`: both
`queueMaintenanceService.mjs` cleanup paths issue pooled `VACUUM ANALYZE`
and assume a resolved query means success. That is an observed implementation
pattern; the risk of misleading success after privilege separation is an
inference, not an observed production security exploit.

The existing March migrations already tune `task_queue`: vacuum threshold 50
plus scale factor 0.01, insertion threshold 500 plus factor 0.02, analyze factor
0.05 and autovacuum cost delay 2ms. A read-only October 1 inspection found
PostgreSQL 18.6, `autovacuum` and `track_counts` enabled, about 26,224 live rows
and 6 dead rows. Manual vacuum at 03:15:00 EDT was followed by autovacuum at
03:15:25. This supports removing redundant automatic manual work; a single
statistics snapshot cannot establish long-term capacity or absence of bloat.

## Alternatives and recommendation stack

| Option | Advantages | Costs and residual risks | Decision |
| --- | --- | --- | --- |
| Retain manual vacuum after deletion | Immediate attempt after a large drain | Extra I/O, duplicate work, runtime maintenance authority and warning-based false success | Replace |
| Autovacuum only, no supplemental tool | Smallest application boundary | Limited recovery tooling when ordinary maintenance cannot keep up | Useful baseline, insufficient operational flexibility |
| Autovacuum first, conditional bounded recovery and optional command | Autonomous recovery only after evidence; no new daemon or privilege grant | Durable admission state and conservative thresholds; statistics and activity observations have limits | Selected |

I recommend the third option under the measured configuration. We should change
table tuning only if repeated observations establish starvation or excessive
queue latency. Six estimated dead rows do not justify manual vacuum. The existing
scheduler can cheaply observe pressure every 15 minutes without creating another
daemon or container. Autovacuum remains essential for other tables and
transaction-ID protection; this tool never substitutes for it.

| Dimension | Expected effect and validation |
| --- | --- |
| Security | Remove unconditional vacuum from retention; fixed table and executable, no new role grants, no caller SQL. Test restricted roles and warning skips. |
| Performance | Replace unconditional scans with cheap observations and evidence-gated work; actual workload improvement is unmeasured. |
| Memory | No new process on normal cleanup; manual operation uses 64MiB maintenance memory, zero parallel workers and a 2MiB buffer ring. These are not whole-process RSS caps. |
| Reliability | Retention remains independent of maintenance inspection; apply refuses restore quarantine/contention and unverified completion. |
| Operability | Explicit inspection/apply results with redacted errors; disabled autovacuum warrants operator review, not silent application repair. |
| Migration | One additive recovery-state table, applied by normal migrations. No image version, deployment template or credential change. Revert code and leave the table inert to roll back. |

## Implementation contract

The backend recovery service checks every 15 minutes, with a delayed startup
check. It requires at least 10,000 estimated dead rows and 20% of estimated total
rows dead, observed for an hour without vacuum progress; gaps over 30 minutes
restart observation. These are conservative initial product thresholds, not
PostgreSQL guarantees or workload-tuned benchmarks. Healthy/new installations
do no manual vacuum. The service also waits for inventory ingestion/backfill,
checks for a running vacuum, and refuses restore quarantine or missing authority.

A singleton ledger persists a six-hour cooldown before work begins, including
failed/interrupted attempts. Three attempts under unresolved pressure stop
automation for review. The service's own vacuum counter advancing does not erase
the attempt budget; observed healthy pressure or a changed statistics epoch can
reset it. It logs the trigger, start and result; expected idle observations do
not produce recovery warnings. It never changes autovacuum configuration, kills
transactions, grants itself privileges or upgrades to `VACUUM FULL`.

Automatic recovery holds shared runtime/restore admission plus exclusive
queue-vacuum and retention-cleanup locks. Offline apply holds exclusive runtime admission. Readiness is
a point-in-time observation, not a promise that new work cannot start; normal
vacuum permits DML and its strict lock/deadline bounds limit that race. The current
database role supports maintenance already. When restricted runtime identity is
activated, a trusted fixed-capability executor will be needed; missing privilege
currently results in an explicit deferral, not self-elevation.

Normal cleanup reads one fixed catalog projection and reports whether routine
autovacuum is configured, not whether it has completed. Missing statistics are
unknown, and null last-run timestamps on a new installation are not failures.
Existing age/count retention, status priority, history and serialization remain.

The supplemental command targets only the permanent, ordinary, non-inherited
`public.task_queue` relation. It accepts `--inspect`, `--apply` or help, never a
table name, SQL, force flag or request payload. Offline apply acquires the exclusive
runtime/restore admission lock and requires a ready restore gate. It checks
maintenance privilege, captures warnings, and verifies manual vacuum/analyze
counters increased for the same relation without a database statistics reset.
Counter lag or a reset gives an unverified result, not a success or immediate retry.

Apply uses one pinned connection, destroys it on every exit, and sets a 60-second
session deadline, 5-second control query limit and 2-second lock timeout. Standard
vacuum uses no parallel workers, no truncation and no `FULL`; truncation is disabled
to avoid its stronger tail-page lock. Cost throttling is advisory: PostgreSQL's
wraparound failsafe can override it. No application-row deletion is performed by
the supplemental command.

The existing trusted embedded launcher gains a fixed `vacuum` child for rehearsals;
normal runtime cannot launch that privileged child, and production startup does not automatically
activate it. Offline locks exclude cooperating modern runtimes, not arbitrary
external administrators or old software. Operators must stop other writers.
The legacy production database role remains unchanged in this component.

## Validation and rollout

Before delivery, test cleanup contracts, fresh/disabled/unknown observations,
permission failures, advisory contention, quarantine, warning skips, counter
verification, timeouts and disconnect cleanup. Exercise real PostgreSQL 18 and
the existing separate-identity embedded rehearsal. Run repository validation and
current coverage checks. Do not execute manual vacuum on the live database.
Record results separately in the outcome document.

Completed results and operator guidance are in the
[queue maintenance outcome](queue-vacuum-maintenance-outcome.md).

## Official research basis

Research reviewed October 1, 2026 against the PostgreSQL 18 baseline used by the
platform in September; sources are live documentation, not archived September
snapshots. URLs were discovered with the online search service and opened.

- [Routine vacuuming](https://www.postgresql.org/docs/18/routine-vacuuming.html)
  supports routine autovacuum and per-table tuning. Enabled configuration does
  not establish timely completion.
- [VACUUM](https://www.postgresql.org/docs/current/sql-vacuum.htm) documents
  warning-based permission skips, transaction restrictions and resource/locking
  options; resolved SQL alone is not completion evidence.
- [Statistics](https://www.postgresql.org/docs/18/monitoring-stats.html) describes
  estimated tuples and manual/automatic maintenance counters. We do not interpret
  them as exact bloat or recovered disk space.
- [Predefined roles](https://www.postgresql.org/docs/18/predefined-roles.html)
  shows why granting `pg_maintain` would be broader than this fixed-table operation.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  informs any future UI: readable text and programmatic status, not color alone.
  This backend/CLI change adds no UI and makes no new WCAG-conformance claim.
- [PostgreSQL progress reporting](https://www.postgresql.org/docs/current/progress-reporting.html)
  supplies the fixed active-vacuum check. A hidden relation identifier is treated
  conservatively as potentially conflicting; no query text is collected.
- [AWS bounded retries](https://docs.aws.amazon.com/wellarchitected/2022-03-31/framework/rel_mitigate_interaction_failure_limit_retries.html)
  supports explicit deadlines and attempt limits. Here one database-wide owner
  and a durable six-hour cooldown avoid per-replica retry bursts; there is no
  inner retry loop. We do not claim to implement AWS's full distributed backoff
  strategy or to derive our thresholds from that guidance.

Long-running transactions, replication horizons or prepared transactions can
prevent reclamation even when vacuum completes. We do not kill those sessions
or change replication automatically. Persistent pressure after three bounded
interventions needs diagnosis, not an ever-more-aggressive repair loop.
