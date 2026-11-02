# Automatic capture advance fence design

Date: 2026-11-02 (America/New_York). Status: implemented and verified.
Observed result: [advance fence outcome](capture-advance-fence-outcome.md).
Base: 7285cbb6a782e12970af04827b8812018054051a on main.
Predecessor: [checkpoint fence outcome](capture-checkpoint-fence-outcome.md).

## Observed gap and completion condition

Automatic capture already claims a private revision/UUID on its discovery-lock
session. Reservations, finalization and all three checkpoint transactions require
that acknowledged authority. The sole production advance caller still supplies
only revision, eligible count and signal after completed policy replay matches
the saved publication fingerprint.

The current UPDATE increments selection_offset by 25 or wraps to zero, then
clears published_fingerprint, progress_key, progress, captured_at and expires_at.
It checks singleton/revision only and does not modify the shared cache table.
An older worker can therefore rotate and clear a replacement worker's progress
after a new claim commits at the same revision. Its later checkpoint refusal
does not undo that earlier mutation. This scenario is established statically;
freeze a failing real PostgreSQL regression before claiming a fix.

Completion: an old claim cannot commit a new advance transaction serialized
after a replacement claim commits. An earlier advance may commit first, and its
acknowledgement may arrive after replacement. Response delivery does not prove
current ownership. Advance is not idempotent; never replay an uncertain commit.

## Narrow implementation contract

Append required private attemptId authority to advance(revision, eligible,
signal, attemptId). Bind the worker through the existing per-flight claim helper;
do not recover persisted authority, accept a missing UUID or expose it through
provider inputs, logs, public result fields or status projections.

Use a small advance leaf and the existing budget SQL module rather than expanding
a general mutation framework. Reuse the repository's transaction/bootstrap
wrapper, checked-out client and existing owned-row prelock.

1. Validate the UUID before SQL. Preserve integer eligible limits of 0 through
   300 and the existing transaction boundary for payload validation.
2. Lock the exact singleton/revision/UUID row. Exact numeric rowCount 1 admits
   the operation; exact zero alone creates a private advance refusal. Throw
   inside the transaction so a refused default-singleton bootstrap rolls back.
3. Recheck cooperative stop after the awaited lock, then dispatch a separate
   UUID-guarded UPDATE. Keep the lock through transaction settlement.
4. Preserve the exact +25/wrap and progress-clear semantics. Keep the current
   UUID for the same flight's subsequent checkpoint/reserve/finish work. Do not
   change charges, quotas, cooldown, status, fingerprint ownership or cache data.
5. Treat exact DML zero as ordinary budget-changed, not ownership proof. Tighten
   missing/malformed/non-numeric counts to a fixed contract failure: the legacy
   generic requireWrite currently maps every non-1 result to budget-changed.
   Document that deliberate distinction; do not claim it is unchanged behavior.

After repository settlement, the claim helper latches only the private advance
refusal. Reuse existing deferral/five-minute local fallback and suppression of
stale durable cleanup, including admission error replacement. A matching error
message or code cannot mint that evidence. Permanent worker stop keeps precedence.

Generic errors, stronger-isolation serialization refusal, malformed responses
and rejected/lost COMMIT acknowledgements remain failures with existing cleanup
authority. Do not replay advance, recover a claim, refund a charge or infer that
a rejected response rolled a committed update back. Preserve primary failure
recording and existing cleanup/unlock error handling.

## Existing resource and authority boundaries

Keep inherited isolation, 15-second statement/one-second lock limits, acquisition
policy, cooperative checks before setup/commit and current discovery/resource
admission. No transaction spans provider HTTP. Queued cancellation may still
wait for acquisition; there is no new SQL cancellation or whole-worker deadline.

Fresh/disabled setups stay disabled, and current schedules, coalescing, worker
stop paths, workload checks, reservation and replay admission remain unchanged.
Successful evaluation or rotation does not grant provider permission.

The independent manual cache writer, read-time quota reset/retention pruning,
older binaries and physical rollback remain separate boundaries. This is not a
global cache fence or a new durable dispatch protocol. Configuration/revision
changes and restores retain existing claim invalidation.

Review the complete changed ownership paths and actual inventory report. Update
affected source/analysis pins explicitly, retaining unresolved classification,
baseline 882cfa1ab4a8ca735039bc4123aaef221019710d and the server parser pin. Reuse
the applicable review rationale rather than adding an unnecessary 101st review;
the existing manifest limit is 100. Do not weaken the gate or refresh a baseline.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limitation | Recommendation |
| --- | --- | --- | --- |
| Leave revision-only advance | No edit | Old worker can erase replacement progress | Reject |
| UUID on UPDATE alone | Small guard | Does not separately prove owner refusal or fence stop after a lock wait | Prefer prelock too |
| Owned prelock plus guarded advance | Matches the existing automatic authority boundary | One additional short query and focused tests | Recommend |
| Redesign manual cache and maintenance authority together | Wider reach | Mixes independent contracts and failure attribution | Defer |

Final stack: acknowledged private claim, owned prelock and guarded UPDATE,
settled private refusal, existing lifecycle/fallback, no uncertain replay, then
real database and HTTP verification. Keep the process automatic and the UI quiet.

After this batch, review remaining read-time budget maintenance as its own
authority boundary. Those reads can reset quota/prune retention before a claim,
so they must not be mechanically converted into claimed-flight writes. Any
follow-up implementation requires separate findings and scope agreement.

## Verification and delivery

Reuse production-factory isolated PostgreSQL, owner-session claim and loopback
capture fixtures. Cover replacement before advance and during its lock wait,
both serialization orders, valid retained progress preservation, missing-singleton
rollback, configuration/restore invalidation, queued/locked/updated stop, current
UUID continuity, eligible 0/25/60/300 and shrinking-population rotation controls.

Verify inherited stronger isolation and current timeouts. Delay or lose the
acknowledgement after a real COMMIT, permit replacement before that reply and
assert one advance without replay. Malformed driver outcomes need adapter
controls, not claims of SQL concurrency proof. Test forged error text, admission
replacement, ordinary zero and permanent stop separately.

The loopback regression must assert unchanged progress/rotation as well as zero
generation: the existing later checkpoint fence can already prevent generation
after an unfenced advance has erased progress. Preserve existing charged attempts.

Run focused unit/database checks before fresh backend coverage and affected
quality gates. The independent [selected compiler assessment](client-compiler-pr-581-design.md)
requires fresh client evidence. Use both current reports for the joint ratchet.
Inspect artifacts through the maintenance skill, preserving recovery assets.

Create a separate observed outcome, update relevant follow-ups and Unreleased,
perform final diff/secret checks, then commit/push all changes on main. Add no
schema, API/UI, CLI trigger, setting, job, provider permission, routing/learning
change, release, deployment or service restart.

## Official research

Sources discovered and read through MCP on November 2, 2026:

- [PostgreSQL 18 row locks](https://www.postgresql.org/docs/18/explicit-locking.html)
  and [isolation](https://www.postgresql.org/docs/18/transaction-iso.html): serialize
  the row and preserve stronger-isolation errors as errors, not exact-zero proof.
- [node-postgres transactions](https://node-postgres.com/features/transactions):
  keep transaction statements on the same checked-out client.
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/): apply
  minimization by keeping coordination identifiers private. This informs exposure
  choices; it does not prescribe a database fencing protocol or require new UI.
