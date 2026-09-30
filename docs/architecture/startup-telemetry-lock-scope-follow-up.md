# Follow-up: optional startup telemetry and closed ingestion context

Date: 2026-09-30. Evaluated runtime/source: `1e068cfaea8dc7b68f520898c2c085798a1ea9af`.
Status: reproduced locally; implementation is the next bounded follow-up.

## Observed outcome

After the no-cache rebuild, the application was healthy but emitted
`Queue startup performance receipt persistence failed` at 16:32:19 UTC. Its
`reasonCode` was `queue_startup_performance_receipt_persistence_failed`.
The service deliberately discards the originating error, so that live event alone
does not establish the exact exception. No PostgreSQL error was found in the
inspected recent log tail.

Source inspection and a no-database reproduction identify a concrete defect:

- `queueRefillCoordination.mjs` runs refill within a session advisory-lock scope.
- `queueRefillCandidates.mjs` records optional performance observations inside it.
- `queueStartupPerformanceReceiptService.mjs` creates a delayed flush timer while
  recording. That timer inherits the current asynchronous context.
- `databaseLockScope.mjs` correctly marks that context closed after the owning
  callback settles. `database.mjs` rejects subsequent wrapper queries from it.
- The later optional receipt write therefore fails before it reaches PostgreSQL.

The reproduction used the real receipt service/repository and lock-scope helper,
a fake database whose query calls the same scope assertion, a healthy fake lease,
and a 5 ms flush delay. It recorded inside `scope.run`, let the scope close, then
awaited 50 ms. Assertions passed for exactly one
`database_lock_scope_closed` error, zero simulated SQL writes and one warning.
No live database or provider was used. This is a strong source/reproduction basis
for the observed warning, not a recovered live exception stack.

## Recommended design

Give the optional telemetry flush an explicitly owned, neutral asynchronous
lifecycle. Keep `record()` cheap and coalesced, and expose a narrowly scoped
receipt writer rather than a general bypass for database ownership checks.
Only fixed anonymous receipt dimensions may cross this boundary.

Node documents that asynchronous operations created inside `AsyncLocalStorage.run`
retain that store. `AsyncResource` can establish a deliberate execution context;
the resource must be created outside the ingestion scope and have an explicit
shutdown lifecycle. Simply capturing a snapshot inside `record()` would preserve
the unwanted scope. See the official
[asynchronous context documentation](https://nodejs.org/api/async_context.html),
discovered and read September 30, 2026. Select APIs supported by Node 24.18.1;
do not adopt a newer-version API merely because the current docs expose it.

| Option | Benefit | Cost / risk |
| --- | --- | --- |
| Write receipt inline under ingestion lock | Simple context ownership | Adds observability latency/failure coupling to the import |
| Neutral, bounded optional writer (recommended) | Keeps measurements independent and fail-safe | Requires lifecycle, shutdown and overlapping-flush tests |
| Remove the database scope guard | Makes the warning disappear | Also permits late ingestion writes; unacceptable |

## Acceptance criteria

1. Reproduce the closed-context failure as a regression test, then show a delayed
   receipt persists after normal ingestion completion without retaining that scope.
2. Lost/closed ingestion callbacks must still reject every inventory write.
   Do not change the general database wrapper to ignore closed scopes.
3. Concurrent records/flushes, shutdown and temporary persistence failures must
   remain bounded and must not create retry storms or keep an otherwise idle
   process alive. Decide whether failed anonymous counts are dropped or retried
   with an explicit duplicate-count policy.
4. Log only a safe error category/SQLSTATE allowlist, never raw query text, media,
   credentials or arbitrary exception payloads. Do not turn optional metrics into
   an application-health dependency.
5. Verify real PostgreSQL persistence and counts, then rebuild and observe the
   delayed flush after an actual refill. Run the existing ownership and startup
   safety suites and retain the closed-context negative test.

## Boundaries and next step

This warning is separate from `legacy_owner_unknown`; fixing telemetry does not
establish stopped-writer proof or permit automatic adoption. The existing receipt
and lock-scope modules were not modified during this evaluation. Keep the larger
[credential/OS isolation work](schema-maintenance-boundary-design.md) next in the
architecture sequence, including clean PostgreSQL shutdown and restore/indexing
feature parity. No unrelated runtime limits or live ownership records were changed.
