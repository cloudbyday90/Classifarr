# Capture failure finalization stop design

Date: 2026-11-01 (America/New_York). Status: agreed first batch; implemented.
Predecessor: [inner workload check outcome](capture-workload-check-cancellation-outcome.md).

## Observed problem and smallest fix

The capture worker's failure handler checks its permanent stop controller before
setting a five-minute local retry deadline. It then awaits budget.finish without
a signal. A stop during that await cannot reach the repository's existing
cooperative checks, and the eventual result still reports the earlier failure
status. This is distinct from the already-bounded inner read checks.

Pass the permanent worker-stop signal as the existing finish method's fourth
argument, with a null publication fingerprint. After that attempt settles,
including a rejected attempt, recheck stop before returning the original status.
Return the existing stopped result if shutdown arrived meanwhile. Do not change
error classification or expose native errors.

Keep this small change in the existing worker. Its repository and transaction
runner already separate SQL and client lifetime; a new wrapper/framework would
add no needed capability. No large singleton grows and no new public interface
is introduced.

## Cooperative contract and authority

The repository already checks its optional signal at callback entry and after
its work, before the callback returns to the transaction runner. Ordinary write
acquisition, SQL and commit remain awaited. Do not pass this signal as a database
transaction option: the signaled runner is explicitly read-only and is not a
write-cancellation mechanism.

If stop arrives while acquiring a client, the normal runner can still issue
BEGIN before the repository entry check rejects. ROLLBACK follows without the
repository's SET/INSERT/UPDATE statements. Do not claim that a late write grant
executes no SQL, as the read-only cancellation path does.

If an UPDATE is already dispatched, it may execute before the repository's final
signal check throws and rolls back. Stop does not cancel active SQL. If COMMIT
has already been dispatched, it may commit despite stop or loss of its reply.
The stopped result describes the local worker lifecycle; it is not a durable
rollback receipt. Keep the existing transaction runner's uncertain-client discard,
single callback attempt and no uncertain-commit replay.

Use only the permanent stop controller for this cleanup write. Do not substitute
an already-aborted workload/resource/deadline signal: existing failure handling
can still need to persist its cooldown after resource admission unwinds. Existing
database ownership health checks remain authoritative; this change supplies no
new discovery lease or write permission.

Preserve local retryAfter timing before finalization, the five-minute local
fallback when persistence fails, existing five-/sixty-minute persisted cooldown
assignments, status mapping, single-flight lifetime and permanent stop semantics.
No additional attempt, timer, retry queue, detached write, refund or provider
request is introduced. The worker continues to await the finalizer's settlement.

Leave all repository SQL and other finish callers unchanged: revision predicate,
zero-row results, singleton insertion, publication COALESCE, reservations, quota
day, progress, rotation, checkpoint and publication behavior remain as before.
No source data, historical evidence, routing or learning behavior changes.

## Limits and separately observed gaps

This is cooperative stop handling, not a bounded write or whole-worker shutdown.
Existing connection-acquisition retries, statement/lock settings, transaction
runner and rollback/commit waits stay unchanged. No proof of immediate remote
termination or rolled-back provider work is added. Fresh installs remain off;
normal automatic schedules and current status/UI need no operator command.

Further review is needed for same-revision finalizers overwriting newer status
or shortening a longer cooldown. finish's zero-row revision mismatch is currently
a normal result, and its shared wrapper can recreate a default singleton after
deletion. These are separate ordering, retention/restore and outcome semantics;
do not silently change them as part of stop propagation.

Add no endpoint, setting, job, schema, acquisition scope, read/write runner option,
CLI trigger, logging stream, provider capability, release, deployment, restart or
production cleanup. Cancellation of other writes and admitted caller lifetimes
remain separate.

## Official research and tradeoffs

Research targets practices available through October 2026; official sources were
discovered and read through MCP on 2026-11-01. No post-October feature is required.

- [Node 24 AbortSignal](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html)
  supplies cooperative signalling and throwIfAborted; it does not itself define
  database rollback. Apply the existing repository checks at their actual boundary.
- [node-postgres transactions](https://node-postgres.com/features/transactions)
  require one checked-out client for the transaction. Preserve the existing
  BEGIN/callback/COMMIT-or-ROLLBACK lifecycle and release/discard rules.
- [node-postgres pool API](https://node-postgres.com/apis/pool) documents FIFO
  acquisition and release/destructive release. Inference: an awaiting finalizer
  can remain queued after local stop; a cooperative callback check can prevent
  its DML once acquired, but supplies no acquisition deadline.
- [PostgreSQL protocol and termination](https://www.postgresql.org/docs/18/protocol-flow.html)
  distinguishes cancellation, connection closure and transaction completion.
  Cancellation is not a direct success receipt. Preserve unknown commit handling
  and never infer safe replay merely from a missing response.
- [PostgreSQL timeout settings](https://www.postgresql.org/docs/18/runtime-config-client.html)
  distinguish statement, lock and transaction timeouts from pool acquisition.
  Keep the existing settings and avoid presenting them as a whole-worker bound.
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), a May 2025
  Statement, supports minimizing retained diagnostics. Preserve fixed returned
  statuses and existing sanitized logs; this adds no raw error data or UI surface.

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Existing stop signal plus post-settlement result check | Small, uses existing transaction checks, preserves all write semantics | Still awaits acquisition/SQL/commit; cannot undo dispatched commit | First batch |
| Detach or race the write against a timer | Faster local return | Write can continue after its owner returns; unknown commit and resource lifetime need a separate contract | Reject for this batch |
| Use the read-only cancellation runner | Reuses bounded read machinery | Writes are outside its explicit contract | Reject |
| New general write-cancellation runner | Could bound a wider lifecycle | Needs commit/rollback, client discard, admission and uncertainty design | Separate design |
| Change finish ordering, cooldown monotonicity and no-op semantics now | Addresses other observed gaps | Changes shared SQL and status/restore contracts beyond stop propagation | Next review |

Recommended stack: permanent worker-stop signal, existing repository cooperative
checks, existing single-attempt write transaction, awaited settlement, final stop
recheck and unchanged local cooldown. Preserve the automatic process and current
UI. Add no abstraction unless implementation reveals a separate responsibility.

## Verification and delivery

First reproduce stop during a pending failure finalizer: the original handler
passes no signal and returns its earlier failure status. Verify stop before
catch, during pending finish success/rejection, settled results and local retry
timing when finalization fails. Statuses and stopped results must remain fixed.

Use the production database factory against isolated PostgreSQL. A saturated pool
must demonstrate that stop prevents finalizer DML after acquisition while allowing
the existing BEGIN/ROLLBACK. Block a dispatched UPDATE, stop, release the blocker
and prove rollback with counters/progress unchanged. Pause acknowledgement after
a real COMMIT, then stop: the worker must return stopped without claiming rollback,
refunding reservations or attempting a second finish. Fault-inject a lost commit
reply after real commit to prove discard/no replay while preserving durable state.
Characterize stale-revision/no-op behavior without changing it. No live or paid
provider is contacted.

Run focused worker/repository/transaction and ownership checks before full
coverage and quality gates. Review exact source drift without resetting baseline,
classifications or bounds. Keep separate design/outcome documents, update
Unreleased and the predecessor's next item, recheck PRs, and commit/push all
reviewed changes on main. No release or deployment. The user confirmed this
complete first-batch contract before implementation. Verification is recorded in
the separate [outcome](capture-failure-finalization-stop-outcome.md).
