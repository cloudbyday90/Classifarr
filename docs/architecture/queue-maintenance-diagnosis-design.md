# On-demand queue maintenance diagnosis design

## Decision

We will explain unsuccessful automatic queue recovery with bounded, read-only
evidence and one suggested next step. This extends the
[conditional recovery service](queue-vacuum-maintenance-outcome.md), not its repair
authority. Baseline inspected: `c34ebf062f8cf68ab0c8dbb071fe8d5f5f7825ad`.

The existing service correctly limits attempts, but its failure log discards the
failure category and cannot distinguish possible lock or retention-horizon
interference. That is an observed diagnostic gap; no production blocker has been
established. A successful vacuum also does not prove pressure has cleared.

## Options and recommendation stack

| Option | Benefits | Costs and limits | Decision |
| --- | --- | --- | --- |
| Keep generic warnings | Smallest implementation | Operator must reconstruct each failure | Replace |
| Poll all database activity continuously | More historical context | Unnecessary work, retained data and alert noise | Not needed for this component |
| Capture aggregates only on recovery trouble | Focused evidence, no new daemon or privilege grant | Point-in-time evidence can miss a transient blocker | Selected |

Recommended stack: PostgreSQL autovacuum, existing bounded recovery, then this
on-demand diagnosis. We do not turn possible interference into permission to
kill sessions, drop replication slots, extend limits or grant privileges.

## Contract

Capture occurs after a reserved automatic attempt fails, on the first transition
to the attempt limit, or when a later check observes an interrupted reserved
attempt during deferral. Healthy, fresh, ordinarily busy and successful recovery
paths do not collect diagnostics. Existing database locks serialize transition
admission across cooperating instances; there is no new timer or retry loop.

The same pinned maintenance session executes one fixed catalog SELECT, limited
to three seconds and the existing sixty-second overall session budget. A lost
connection or exhausted budget produces an unavailable diagnosis without opening
another connection. Diagnostics must never turn a failed repair into success.

Only counts of current-database transaction horizons, hour-old retaining
transactions/prepared transactions, queue relation locks, relevant replication
`xmin` horizons and queue vacuum activity leave PostgreSQL. Physical slots are
cluster-wide; logical slots are filtered to this database. `catalog_xmin` alone
is not reported as retaining task-queue tuples. No query text, PID, username,
application name, address, slot name or media/configuration content is collected.
The one-hour transaction threshold is a product heuristic, not proof of blockage.

The projection validates every count and emits fixed reason/action text. Missing
activity visibility, disabled tracking, malformed results and failed queries are
explicitly incomplete/unavailable, never evidence of no blockers. Positive lock
or horizon evidence is described as possible interference; it cannot establish
which historic statement caused an unsuccessful attempt. SQLSTATE `57014` means
query cancellation, not necessarily a timeout. PostgreSQL error messages are
never parsed or persisted by this diagnostic.

Failure categories and snapshots use existing structured logs/retention; repeated
categories can be reviewed there. This is not a new historical metrics store.
Transition markers use the existing recovery ledger. Recording a transition
before collecting its diagnostic means a crash can lose that snapshot; later
repair failures/limit transitions can produce new evidence, but no exactly-once
log-delivery claim is made. No schema, API, UI or Compose/Unraid template change.

## Validation and rollback

Test all fixed categories and action priorities, visibility and malformed-data
handling, projection redaction, healthy/busy no-work paths, budget/lost-session
behavior, interrupted attempts and transition deduplication. Real PostgreSQL
tests exercise read-only execution, actual locks, live transaction horizons and
restricted-role visibility. Run full regressions and repository quality gates.
Rollback reverts these modules/wiring; existing recovery state needs no conversion.

## Official sources

URLs were discovered with online search and reviewed October 1, 2026 using the
platform's September PostgreSQL 18 baseline. Live pages are not archived
September snapshots.

- [Routine vacuuming](https://www.postgresql.org/docs/18/routine-vacuuming.html):
  old transactions, prepared transactions and replication horizons can obstruct
  maintenance; diagnosis does not authorize destructive remediation.
- [Statistics visibility](https://www.postgresql.org/docs/18/monitoring-stats.html):
  ordinary roles see only part of other sessions' information.
- [Replication slots](https://www.postgresql.org/docs/18/view-pg-replication-slots.html):
  tuple retention by `xmin` differs from catalog retention by `catalog_xmin`.
- [Lock monitoring](https://www.postgresql.org/docs/current/view-pg-locks.html) and
  [lock conflicts](https://www.postgresql.org/docs/current/explicit-locking.html):
  relation lock counts indicate possible interference, not proven causality or
  the exact order of waiting sessions; avoid continuous catalog polling.
- [SQLSTATE error codes](https://www.postgresql.org/docs/18/errcodes-appendix.html):
  use stable codes instead of interpreting localized error messages.
- [Activity tracking](https://www.postgresql.org/docs/current/runtime-config-statistics.html):
  tracking and access permissions affect observable evidence; the service does
  not enable tracking or grant itself more access.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  status should have meaningful text and programmatic semantics. This backend-only
  work supplies fixed human-readable messages, without asserting new UI conformance.
