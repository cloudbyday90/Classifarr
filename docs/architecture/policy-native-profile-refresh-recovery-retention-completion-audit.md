# Native Profile Refresh Recovery-Retention Completion Audit

## Decision

Native profile recovery and its bounded runtime-history retention are complete
as one server-owned path for persisted native policies. Application bootstrap
starts an advisory-lock-protected scheduler. Each run plans current recovery,
persists durable work, and compacts only expired inactive native recovery
history within planning. It then runs the lease-protected outbox worker.
Persisted policy views
can read a bounded recovery status but cannot request, retry, reset, inspect,
or delete recovery work.

The audit found one separate migration cutline: the initial native-policy
creation workflow still has a browser-triggered library-profile refresh path.
That path is not used by persisted-policy recovery or retention, and this
audit does not hide or duplicate it. Phase 6R.6 must explicitly decide whether
to replace or delete it as part of the legacy workflow migration.

## Research

Research was retrieved from official sources on 29 July 2026 and corroborates
the requested June 2026 baseline. Microsoft's [background job
guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/background-jobs)
identifies retention cleanup as schedule-driven work and calls for idempotency
when schedulers can overlap. Its [Well-Architected background-job design
guidance](https://learn.microsoft.com/en-us/azure/well-architected/design-guides/background-jobs)
recommends durable state, retryable execution, and independently recoverable
work. PostgreSQL's [transaction isolation
documentation](https://www.postgresql.org/docs/current/transaction-iso.html)
explains that a competing `DELETE` waits for a conflicting row operation and
then ignores a row already deleted by the committed transaction.

## Options Considered

### Browser-Owned Recovery and Retention

Pros: provides an immediate manual control.

Cons: exposes runtime failure state, duplicates scheduler authority, requires
operator availability, and conflicts with durable retry and retention. Rejected.

### Separate Planner, Worker, and Cleanup Schedulers

Pros: isolates responsibilities.

Cons: creates ordering, startup, and recovery coordination surfaces without
improving the durable outbox contract. Rejected.

### One Scheduled Automation Pipeline With a Dedicated Compactor

Pros: bootstrap starts one lock-protected task; planning precedes delivery;
the worker owns lease/retry behavior; the planner owns compaction; persisted
views remain read-only. Selected.

Cons: one scheduler interval can delay a newly eligible operation, and an
individual run can fail. Durable outbox state, retries, the next interval, and
fixed scheduler logging mitigate those conditions without user action.

## Production Inventory

| Boundary | Owner | Verified contract |
| --- | --- | --- |
| Startup | `initializeServices.mjs` | Starts `startPolicyProfileRefreshOutboxWorker` only after runtime wiring succeeds. |
| Scheduling | `scheduler.mjs` | Runs every minute after a 90-second initial delay, with `noOverlap` and the `2011` database advisory lock. |
| Automation | `policyProfileRefreshAutomationService.mjs` | Runs the native planner before the durable outbox worker; a planning failure cannot suppress delivery of already committed work. |
| Recovery | `policyNativeProfileRefreshPlanner.mjs` and `policyProfileRefreshOutboxWorker.mjs` | Persists/coalesces work, performs lease-safe delivery, classifies failures, and clears circuits only after successful completion. |
| Retention | `policyNativeProfileRefreshCircuitCompactionRepository.mjs` | The planner is the only production caller. One materialized retained set atomically removes eligible closed circuits and terminal native-readiness outbox rows. |
| Projection | Native readiness route and `PolicyNativeProfileRecoveryStatus.vue` | Returns or renders bounded automatic status only; the persisted status component contains no button. |
| Replace restore | `backupRestore.mjs` | Deletes outbox and circuit runtime work instead of importing operational state. |

The compactor receives every ready request's server-derived library and source
revision as protected input. It retains active circuits, active outbox work,
recent closed history, and protected revisions. A compaction error produces a
fixed planner result and warning; it cannot roll back already persisted current
recovery work.

## Coverage Reconciliation

| Concern | Coverage |
| --- | --- |
| Bootstrap, periodic scheduling, initial scheduling, and advisory locking | `initializeServices.test.mjs`, `scheduler.test.mjs` |
| Planner then worker, including planner-failure delivery | `policyProfileRefreshAutomationService.test.mjs` |
| Circuit lifecycle, source isolation, concurrent planners/workers, leases, post-generation loss, exhaustion, and repeated probes | Native profile-refresh circuit lifecycle integration suite and its focused design records |
| Atomic retention, planner/compaction interleaving, cleanup failure isolation, and concurrent compaction | `policy-native-profile-refresh-circuit-compaction.test.mjs` |
| Read-only persisted recovery status | `PolicyNativeProfileRecoveryStatus.test.js` |
| Replace-restore runtime cleanup | backup-restore and migration coverage |

The audit adds the normal planner-then-worker orchestration assertion. Existing
tests already cover the complementary condition where planning fails but the
worker still delivers durable work.

## Concrete Follow-On Cutline

`PolicyNativeEvidenceRecovery.vue` and its browser-side refresh/reload path
were retired in Phase 6R.6.11.1. Native creation now consumes current
server-projected evidence only; persisted profile recovery and retention remain
the scheduler-owned lifecycle. The retirement outcome is documented in
[Policy Library-Rebuild Native Evidence Recovery Retirement](policy-library-rebuild-native-evidence-recovery-retirement.md).

## Final Recommendation Stack

1. Keep persisted native profile recovery and retention entirely scheduler-owned.
2. Keep one automation run that plans before worker delivery; continue delivery
   when planning alone fails.
3. Keep compaction only in the planner and protect current revisions on every
   invocation.
4. Treat overlapping compaction zero-results as successful idempotency.
5. Preserve read-only persisted recovery status with no operator controls.
6. Keep creation-only evidence recovery retired; future browser paths must not
   bypass the scheduler-owned recovery lifecycle.

## Security Outcome

- Browser inputs cannot select a retention target, bypass a circuit, reset a
  cooldown, or expose outbox and failure details.
- Scheduler ownership is protected across processes by the existing database
  advisory lock; concurrent lower-level workers and compaction callers remain
  safe by durable claims and PostgreSQL row concurrency.
- Replace restore starts with clean runtime state rather than importing stale
  leases, claims, or recovery history from another installation.
- The migration cutline is explicitly documented so a future deletion cannot
  accidentally reintroduce a browser-owned persisted-policy recovery control.

## Verification

Run the focused orchestration test with:

```powershell
cd server
npx jest --testPathPatterns="policyProfileRefreshAutomationService.test.mjs" --no-coverage
```

Run the retention integration suite with:

```powershell
cd server
node ./scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage --runTestsByPath src/__tests__/integration/policy-native-profile-refresh-circuit-compaction.test.mjs
```

## Next Task

Start **Phase 6R.6, Task 6R.6.1: Migration Preview Contract**. Define one
server-owned, bounded comparison of legacy behavior and generated native
intent for representative classifications. Its artifact inventory must classify
the creation-only browser evidence-refresh path as replace or delete, preserve
the rollback snapshot and window, and expose none of the verifier machinery in
the normal policy workflow.
