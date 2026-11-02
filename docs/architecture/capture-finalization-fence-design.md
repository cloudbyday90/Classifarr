# Capture finalization fence design

Date: 2026-11-02 (America/New_York). Status: agreed; implemented and verified.
Predecessor: [admitted failure cleanup outcome](capture-failure-admission-ownership-outcome.md).
Outcome: [implementation and validation](capture-finalization-fence-outcome.md).

## Problem and completion condition

The current worker awaits failure finalization within discovery admission. Local
lease-health checks prevent new transactions after observed session loss. They
cannot prove that a worker has noticed the loss before another worker acquires
the discovery lock under the same configuration revision.

The proposed completion condition is narrower than fencing every capture write:
after a newer admitted attempt commits its claim, an older attempt cannot finish
the same revision. A rejected claim cannot authorize a finish. A queued old claim
must not arrive on a separate connection after the replacement's claim.

## Proposed claim and finish contract

Add one nullable UUID column to the existing singleton capture budget and its
fresh schema. NULL carries no authority; do not backfill old rows. PostgreSQL
generates a fresh random UUID for each accepted claim. The UUID is private
coordination state, not an HTTP credential or provider permission.

A capture-specific admission adapter exposes one fixed claim operation. It uses
the scoped query function from the exact backend holding the discovery advisory
lock. Do not give the worker a raw client, generic transaction capability or
replacement pooled connection. Other discovery callers retain their interface
and effective database/resource concurrency. The evaluator receives no claim
operation, and capture/provider dependencies receive no claim capability.

After the worker's second enabled/window/cooldown checks and before evaluation
reads, invoke the claim once. Latch that operation before its first asynchronous
step; rejection does not permit another invocation. Use a short transaction on
the owning backend with the existing 15-second statement and one-second lock
limits and inherited isolation. No provider or HTTP work belongs in it.

First lock the revision-bound budget row. Dispatch a separate UPDATE after the
lock settles, using its fresh statement-time anchor to recheck enabled state,
window and the reader's existing sixty-minute cooldown horizon. Require that the
current backend holds the granted exclusive discovery lock for this database;
check its precise bigint key representation in pg_locks. The claim changes only
the UUID. Exhausted quota does not prevent claiming authority to record the
existing budget_exhausted status. Missing rows remain missing; existing reads
retain responsibility for singleton bootstrap.

Accept an exact one-row, revision-bound UUID only after COMMIT acknowledgement
and scoped health checks. An exact zero-row claim produces existing deferred
handling and a five-minute local fallback, without a durable finish. Missing or
invalid results and rejected/lost acknowledgements confer no authority. Never
read a persisted UUID back to recover authority or replay an uncertain claim.

Keep acknowledged claim context private to the per-flight finalization helper.
Both the finish row lock and finish UPDATE must require revision plus exact UUID;
there is no legacy unfenced fallback. Preserve raw repository results and exact
one/zero/unknown handling. Failure cleanup may finish only with an acknowledged
claim, inside its existing admission lifetime. Permanent stop keeps precedence.

Retain the UUID after a finish so same-attempt error refinement and existing
uncertain-primary cleanup semantics remain available. This does not make the
first finish immutable. A replacement claim invalidates every older UUID, and a
new same-attempt cleanup cannot replace the current claim.

## Lifecycle and authority boundaries

Configuration changes and revision-changing evaluator rotation clear the UUID
alongside their existing writes. Same-revision capture advance, pruning and daily
quota rollover retain it. Merge and replace configuration restores clear only
this operational authority within the existing restore transaction; they do not
reset quotas, caches, status or cooldowns. A rolled-back restore preserves the
old state atomically. The UUID stays outside portable backups, status projections,
fingerprints, application logs and provider inputs.

Fresh UUIDs avoid reusing authority when a budget row is deleted and recreated
at the same revision. Resuming old writers across a physical database rollback
is outside this contract. A process restart creates no authority from an old
UUID. An unsuccessful or unnecessary run does not acquire additional permission.

This protects finalization among updated participating writers after a newer
claim commits. It does not instantly detect a lost lease, block older binaries
whose SQL ignores the UUID, or fence reservations, checkpoints and publication.
Those writes retain their current independent revision, quota, workload and
ownership checks. No cache rollback, provider replay, new inference permission,
automatic retry or immediate server termination is implied.

Pool acquisition and whole-worker shutdown are not newly bounded. Existing
write timeouts, cancellation, observed lease fencing, local fallback, cooldown
preservation and uncertain-commit semantics continue. A database error remains
an error; a lost COMMIT reply is not acknowledged non-application.

## Options and recommendation stack

| Option | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Local lease checks alone | No schema change | Cannot reject a matching-revision stale finish after unobserved loss | Insufficient |
| UUID claim on a pooled connection | Small equality predicate | Old queued claim can replace a newer owner's claim | Reject |
| Ordered epoch on the owner backend | Explicit ordering | Requires durable high-water lifecycle, reset and overflow rules | Defer |
| UUID claim on the owner backend | Small durable equality fence without a counter reset protocol | Adds one column and short transaction; finalization only | Recommend |
| Fence every capture side effect now | Broader attempt protection | Couples charged requests, checkpoints and uncertain provider outcomes | Separate follow-up |

Implement owner-backend claim, mandatory finish equality, then lifecycle
invalidation and regression proof. Keep the existing automatic scheduler and
status surfaces. Add no operator CLI trigger, UI, endpoint, setting, job,
routing/learning change, release or deployment.

## Verification required before delivery

Prove successful capture and every early/failure finish path, absent/invalid
claims, exact zero-row acknowledgement and no replay. Cover disabled/fresh
installs, cooldown/window changes during row waits, configuration rotation,
daily rollover, delete/recreate and both restore modes with rollback.

Use the production database factory against isolated PostgreSQL to exercise
owner-session loss before/after claim commit, an old blocked claim, replacement
claims, delayed old finishes and lost/delayed COMMIT replies. Artificially delay
the old worker's observation of lease loss; ordinary local abort tests alone do
not prove the new property. Test wrong-backend lock proof, precommit stop,
inherited isolation and unchanged resource/inference gates. Run focused tests,
affected quality/schema/ownership checks and coverage gates. Review changed
ownership pins individually. Record observed outcomes separately after testing.

## Official sources and application

Sources discovered and opened through the search MCP on 2026-11-02:

- [PostgreSQL advisory and row locks](https://www.postgresql.org/docs/18/explicit-locking.html):
  session locks end on explicit release or session termination; advisory
  cooperation alone does not force application writers to use a fence.
- [PostgreSQL pg_locks](https://www.postgresql.org/docs/current/view-pg-locks.html):
  verify database, backend PID, granted mode and the documented bigint key
  halves with objsubid 1 for claim admission.
- [PostgreSQL UUID generation](https://www.postgresql.org/docs/18/functions-uuid.html):
  gen_random_uuid provides a native random UUID without adding an application
  dependency or a monotonically increasing identifier lifecycle.
- [node-postgres transactions](https://node-postgres.com/features/transactions):
  every statement in the claim transaction must use the same checked-out client.
- [W3C Privacy Principles, data minimization](https://www.w3.org/TR/privacy-principles/):
  apply minimization to the design by retaining only private operational
  authority and exposing no new identifier, report or user interaction. This is
  an architectural application, not a claim that W3C defines database fencing.

Next after this batch: assess attempt ownership for charged reservations and
checkpoint/cache publication without adding replay authority. Bound write
acquisition and whole-worker shutdown separately.
