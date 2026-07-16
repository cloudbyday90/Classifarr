# Native Intent Reconciliation Failure-Injection And Lifecycle Matrix

## Status

In progress as Task 8R.3.2.7 of the policy-builder intent model roadmap.

The first two matrix slices, implemented on 2026-07-16, prove that a recurring
native-intent reconciliation run and the delayed startup run cannot execute the
same conversion concurrently, and that a fresh scheduler and reconciliation
state service recover safely after process reinitialization. The remaining
matrix work is deliberately kept as separate, focused test slices rather than
one broad mock-heavy test.

## Decision

Automatic native-intent reconciliation must be verified at the boundaries that
protect its lifecycle: scheduler ownership, advisory-lock contention,
transactional authority, retry-state selection, restore suppression, and
sanitized support evidence. Normal conversion remains server-owned; no test may
restore a client preview, selection, confirmation, or apply path.

## Official-Source Research

- [PostgreSQL advisory lock functions](https://www.postgresql.org/docs/current/functions-admin.html)
  defines `pg_try_advisory_lock` as an immediate, non-waiting acquisition that
  returns `false` when another session holds a conflicting lock. The scheduler
  must therefore skip the competing run rather than queue or duplicate it.
- [PostgreSQL transaction characteristics](https://www.postgresql.org/docs/current/sql-set-transaction.html)
  explains that concurrent serializable work can be rolled back with a
  serialization failure. Transaction tests must distinguish bounded retryable
  database failure from successful conversion and preserve rollback evidence.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends outcome-based secure development practices that reduce both
  vulnerabilities and the impact of undiscovered defects. Focused,
  reproducible boundary tests provide that evidence better than manual dialog
  checks.
- [OWASP Testing for Improper Error Handling](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/08-Testing_for_Error_Handling/01-Testing_For_Improper_Error_Handling)
  calls for testing failure paths without disclosing infrastructure details.
  Reconciliation assertions must use stable status, reason, and category IDs,
  never raw errors, credentials, SQL, or policy payloads.

## Recommendations

1. **Test the actual scheduler collision boundary.** Simulate a held native
   reconciliation lock while the delayed startup callback fires; assert that
   the second invocation is skipped and the reconciler executes exactly once.
2. **Keep retry and candidate-state checks deterministic.** Use the existing
   state-contract tests for expired retry delays, changed fingerprints, mixed
   ready and blocked candidates, and execution-budget exhaustion.
3. **Use transaction-level tests for write races.** Exercise authority locks,
   concurrent serialization failure, reversion guards, and failure after
   rollback-snapshot creation through the apply gate rather than the client or
   scheduler layer.
4. **Run one real-database scheduler integration test.** Once the Docker test
   engine is reachable, create a ready legacy policy, trigger the scheduler,
   and prove conversion occurs without any client conversion request.
5. **Keep support evidence safe.** Assert only fixed failure IDs, safe ledger
   status, and correlation IDs. Never assert or persist a raw exception stack.

## Pros And Cons

### Pros

- Verifies the real duplicate-execution risk without relying on timing luck.
- Preserves the non-blocking scheduler contract under replica or startup
  overlap.
- Keeps policy writes, lifecycle control, and client behavior independently
  testable.
- Prevents test fixtures from normalizing sensitive error output.

### Cons

- Scheduler collision tests use a deterministic lock double; they do not
  replace a PostgreSQL integration test.
- The full matrix spans multiple modules and must stay split to avoid turning a
  focused lifecycle guarantee into an opaque end-to-end fixture.
- The real-database integration slice cannot be executed while Docker is
  unavailable to the test process.

## Final Recommendation Stack

1. Scheduler ownership and duplicate protection:
   `scheduler.mjs` and `scheduler.test.mjs`.
2. Database advisory-lock implementation:
   `database.mjs`.
3. Retry, fingerprint, and budget outcomes:
   `nativeIntentReconciliationStateContract.mjs` and its tests.
4. Authority, transaction, and reversion safety:
   `policyPostUpgradeApplyGate.mjs` and its tests.
5. Lifecycle control, restore suppression, status, and alert behavior:
   the native-intent reconciliation lifecycle, control, status, and alert
   services and their focused tests.
6. Final real-database scheduler integration coverage:
   a Docker-backed test that exercises only the scheduler-owned path.

## Implementation Outcome

- Added a scheduler failure-injection test where the recurring task acquires
  the native reconciliation advisory lock, the delayed startup task fires
  while it is held, and the delayed task is skipped. The reconciliation service
  runs exactly once and the lock skip is logged.
- Added restart-continuity tests proving scheduler reset cancels the old initial
  timer and a reinitialized scheduler creates exactly one fresh, lock-protected
  run. A freshly constructed state service reloads persisted retry state from
  the database, defers the candidate until its retry time, and selects it once
  that time has expired.
- Confirmed existing focused tests already cover candidate fingerprint changes,
  retry backoff, mixed candidate batches, execution-budget deferral, authority
  locking, serialization failure, rollback guards, control disablement,
  circuit recovery, restore suppression, status sanitization, and alert
  deduplication.
- Removed a duplicate serializable-database-failure test from the apply-gate
  suite so each matrix assertion has one clear owner.

## Remaining Matrix Slices

- Database failure after rollback-snapshot creation using a transaction-aware
  failure injection that proves rollback evidence remains truthful.
- Docker-backed integration proving a ready legacy policy converts through the
  scheduler without a client dialog or apply request.
