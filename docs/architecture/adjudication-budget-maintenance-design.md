# Adjudication budget maintenance serialization design

Date: 2026-11-02 (America/New_York). Status: implemented and verified.
Observed result: [maintenance outcome](adjudication-budget-maintenance-outcome.md).
Base: 1abeb78f35a109e8b0e76dc669a0c0972bc940f5 on main.
Predecessor: [advance fence outcome](capture-advance-fence-outcome.md).

## Reproduced failure and completion condition

Budget read() is an ordinary write transaction: default-singleton bootstrap,
UTC quota reset, progress pruning and state SELECT. The automatic capture worker
calls it before discovery admission and again before claiming. On a current
quota day reset can affect zero rows, so it does not necessarily lock the row
before prune begins. Prune clears progress for future capture time or expiry,
using statement_timestamp().

The isolated production-factory PostgreSQL regression reproduces this schedule:

1. Seed expired progress, current quota day and an empty shared cache.
2. Pause reader A after its existing bootstrap command.
3. Let current owner B acquire checkpoint open's owned row lock; pause B there.
4. Release A: reset affects zero rows, then prune waits on B's row lock.
5. Observe A's actual database lock wait; release B to write fresh capture times
   in a subsequent command and commit.
6. A rechecks the updated row against its older prune statement timestamp and
   clears the new capture. Both transactions succeed; saved progress is null.

The permanent test gates A after bootstrap, not reset, so the same desired
assertions can pass with a prelock fix. The proof uses actual row contention,
not elapsed-time assumptions or mocked SQL execution.

Completion: after waiting for the singleton row, maintenance evaluates the
existing reset/prune predicates with statement anchors acquired after the lock.
Fresh valid progress survives; genuinely expired/future progress is still pruned.
No historical capture is recovered and no payload lease is renewed.

## Small maintenance leaf and explicit result boundary

Extract read-time maintenance into a small ESM leaf using the current common
transaction/bootstrap wrapper. Add one fixed SQL constant to the existing budget
SQL module: SELECT singleton WHERE singleton=true FOR UPDATE. It must not depend
on revision, UUID, enabled state or quota; this maintenance intentionally runs
before a flight claim and while capture is disabled.

After bootstrap:

1. Await that singleton prelock on the same checked-out client.
2. Exact numeric rowCount 1 continues. Exact zero throws ordinary
   adjudication_budget_changed and rolls back, using existing caller deferral.
   This is an explicit new lock-result boundary: current read can otherwise
   return undefined after a concurrent deletion. It is not ownership evidence.
3. Missing, malformed or non-numeric counts fail with a fixed maintenance
   contract error. Do not mint private refusal identity or a notApplied latch.
4. Recheck cooperative stop after the awaited prelock.
5. Dispatch the unchanged reset, prune and state SELECT as separate subsequent
   commands. Preserve their result handling/projection, lease rules and returned
   fields. Hold the row lock through transaction settlement.

Do not tighten all read/DML payload contracts in this batch. Do not add a flight
UUID requirement, recover authority or turn a preliminary maintenance result into
permission for provider inference. The private status CLI already uses a direct
SELECT and bypasses maintenance; it remains unchanged.

## Preserved lifecycle and resources

Retain default-disabled bootstrap, the ordinary write transaction, inherited
isolation, existing 15-second statement/one-second lock limits and acquisition
policy. Preserve cooperative checks before setup/after the callback; add only
the explicit postlock check. Cancellation observed after DML still rolls back
through the current transaction runner. Already-dispatched commits may succeed.

Keep current UTC reset predicates, charges, UUID/revision continuity, status,
cooldown, publication/cache authority, schedules, coalescing and discovery/
workload/provider gates. Do not introduce another retry, cooldown or queue.
No transaction spans HTTP. Pool acquisition and whole-worker shutdown are not
newly bounded, and no targeted SQL cancellation is added.

A rejected/lost COMMIT reply remains uncertain even if reset/prune was durable.
Do not replay maintenance, refund a charge, infer rollback or claim recovery.
Stronger-isolation serialization errors remain errors; do not force READ COMMITTED
to hide them. Independent manual/shared-cache maintenance is outside this proof.

Review actual ownership inventory drift for the parent and new indirect-query
leaf. Retain baseline 882cfa1ab4a8ca735039bc4123aaef221019710d, unresolved
classifications, server ESLint 10.13.0 and the 100-review cap. Compress/rewrite the
applicable rationale explicitly if necessary; do not silently refresh baselines
or broadly relax the gate.

## Alternatives and final recommendation stack

| Option | Benefit | Cost or limitation | Recommendation |
| --- | --- | --- | --- |
| Keep current sequence | No new query | Reproduced fresh-progress loss | Reject |
| Replace timestamps globally with wall-clock calls | Avoids one old anchor | Broadens time semantics and intra-command behavior | Defer |
| Remove future/expiry checks | Avoids clearing this capture | Weakens existing retention/invalid-time handling | Reject |
| Singleton prelock, then existing commands | Serializes the decision with fresh anchors and preserves predicates | One short extra query and contention within existing limits | Recommend |

Final stack: unclaimed maintenance authority, singleton prelock, exact result
boundary and postlock stop check, unchanged time-based commands, one transaction
without uncertain replay, then real database/worker proof. Operation stays
automatic and the UI stays unchanged.

## Verification and delivery

Keep the failing two-pool regression and verify both serialization orders. Cover
legitimate expired/future cleanup, fresh/disabled bootstrap, UTC rollover once,
concurrent current-day charges, claim/status/cooldown/cache preservation, missing
row and malformed lock results. Prove queued/postlock/post-DML stop rollback,
inherited isolation/current timeouts and genuine serialization refusal. Delay or
lose acknowledgement after a real COMMIT and assert one attempt with no replay.
Use existing worker fixtures to preserve disabled/refusal/provider admission and
failure semantics. Use only isolated PostgreSQL and synthetic test data.

Run focused checks before fresh backend coverage and affected quality gates.
Client code/dependencies are unchanged: reuse client coverage only after tracked
tree, installed lock and current report hashes are verified unchanged. Do not
present reused coverage or old compiler receipts as newly executed evidence.

Random selection again chose [PR 581](https://github.com/cloudbyday90/Classifarr/pull/581)
at unchanged head 15b66950a5739e6fdb5290f2cf4c0120d4259015. Its published 3.3.14
artifact and unresolved reports are unchanged. Reuse the settled
[compiler deferral](client-compiler-pr-581-outcome.md); no reinstall, version
change or second random selection is warranted. Recheck current Dependabot
branches and rebase only genuinely stale applicable heads; leave PRs unmerged.

Create a separate observed outcome, update relevant follow-ups and Unreleased,
perform scoped artifact maintenance and staged diff/secret checks, then commit/
push all changes on main. Add no schema, UI/API, operator CLI trigger, setting,
job, provider permission, routing/learning change, release, deployment or restart.

## Official research

Sources discovered/read through MCP on November 2, 2026:

- [PostgreSQL statement time](https://www.postgresql.org/docs/current/functions-datetime.html):
  statement time is fixed at command receipt; a command after lock acquisition
  receives a fresh anchor without changing intra-command semantics.
- [PostgreSQL 18 isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
  and [row locking](https://www.postgresql.org/docs/18/explicit-locking.html):
  READ COMMITTED can requalify an updated row after waiting; serialize first and
  preserve stronger-isolation errors rather than mislabel them as missing rows.
- [node-postgres transactions](https://node-postgres.com/features/transactions):
  use one checked-out client for every transaction command.
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/): retain data
  minimization and existing disclosure boundaries. This internal fix adds no
  identifiers, telemetry or operator controls; W3C does not prescribe its SQL.
