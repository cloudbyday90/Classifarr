# Native Profile Refresh Circuit Concurrent Retention-Compaction Integration

## Decision

Expired inactive native recovery history is compacted with one atomic SQL
statement that deletes both the closed circuit and its eligible terminal outbox
row. Independent scheduler callers may invoke that statement concurrently.
Exactly one caller owns the effective deletion; the competing caller waits on
the conflicting PostgreSQL row operation and completes with zero deleted rows.

Protected current revisions remain retained for every caller. The compactor
does not need a global scheduler lock, browser coordination, or an operator
cleanup control. The result is idempotent: repeated or overlapping calls reach
the same retained state without leaving an orphaned circuit or terminal outbox
row.

## Research

Research was retrieved from official sources on 29 July 2026. The sources used
were available by the requested June 2026 baseline. Microsoft's [background
job guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/background-jobs)
identifies retention cleanup as schedule-driven work and requires idempotency
because scheduler instances can overlap. PostgreSQL's [transaction isolation
documentation](https://www.postgresql.org/docs/current/transaction-iso.html)
states that `DELETE` waits for a concurrent updater or deleter; after the first
transaction commits its deletion, the competing command ignores that row.
PostgreSQL's [explicit locking documentation](https://www.postgresql.org/docs/current/explicit-locking.html)
also confirms conflicting row operations block until the current transaction
ends.

## Options Considered

### Serialize Every Compaction Call With a Global Scheduler Lock

Pros: only one caller can run cleanup at a time.

Cons: unnecessary global coordination reduces availability and turns one
slow cleanup caller into a scheduling dependency. Rejected.

### Delete Circuit and Outbox History in Separate Calls

Pros: superficially simple operations.

Cons: a concurrent caller or process interruption can separate circuit and
outbox deletion, leaving inconsistent retained history. Rejected.

### One Atomic, Idempotent Cleanup Statement Per Caller

Pros: one caller performs the effective deletion, concurrent callers safely
become no-ops, protected revisions remain intact, and no global lock or UI
workflow is required. Selected.

Cons: concurrent callers can briefly wait on the same expired row, and a
zero-result caller must be interpreted as an expected idempotent outcome rather
than a failed cleanup.

## Final Recommendation Stack

1. Keep retention cleanup server-owned and independent of browser activity.
2. Delete expired circuit and terminal outbox history in the same atomic SQL
   statement.
3. Pass protected current revisions to every cleanup caller.
4. Accept a zero-result overlapping invocation as successful idempotency, not
   as a retry or operator-action condition.
5. Avoid a global compaction lock while PostgreSQL's row concurrency already
   provides the necessary per-row coordination.
6. Test the real query against concurrent PostgreSQL connections with an
   explicit test-only overlap barrier.

## Implementation Outcome

`policy-native-profile-refresh-circuit-compaction.test.mjs` now invokes the
production compactor twice in parallel. Its test-only client injects a
materialized `pg_sleep` barrier into the query and fails loudly if a future SQL
refactor prevents the barrier from being applied. Both calls therefore obtain a
pre-cleanup snapshot before either can delete the expired revision.

The integration test proves one result is `1` circuit and `1` outbox row while
the other is `0` and `0`; their combined counts are exactly one atomic cleanup.
The expired revision has neither circuit nor terminal outbox row afterward,
while an equally expired protected revision retains both. No production code
changed because the existing materialized retained-set query already provides
the selected concurrency contract.

## Security Outcome

- Retention cannot be invoked or overridden from a browser or operator surface.
- Current revisions remain protected by server-derived library and source-event
  identifiers for every concurrent caller.
- A competing cleanup pass cannot create duplicate deletion effects or orphan
  terminal history.
- The test barrier exists only in integration coverage and cannot affect the
  production SQL path or deployment timing.

## Verification

Run the focused integration suite with:

```powershell
cd server
node ./scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage --runTestsByPath src/__tests__/integration/policy-native-profile-refresh-circuit-compaction.test.mjs
```

## Next Step

The completed [Native Profile Refresh Recovery-Retention Completion
Audit](policy-native-profile-refresh-recovery-retention-completion-audit.md)
confirms the scheduler, planner, worker, compactor, read-only status, and
replace-restore boundaries. Next, start Phase 6R.6 Task 6R.6.1: the
server-owned migration preview contract and its replace-or-delete cutline for
the creation-only browser evidence-refresh path.
