# Source-pair publication admission investigation design

Date: 2026-11-02 (America/New_York). Status: implemented and verified.
Observed results: [investigation outcome](source-pair-publication-admission-outcome.md).
Base: a85ec7eb76e80ba1ad86ef16fef35f999f281080 on main.
Predecessor: [outer-read stop outcome](capture-outer-read-stop-outcome.md).

## Investigation and present conclusion

The next investigation concerns sourcePairWindowProgressionRepository.mjs:
report publication can bootstrap the budget, run time-sensitive progress prune,
then perform a revision/offset compare-and-set. This composition has no separate
unconditional budget-row prelock before prune. That structure alone does not
establish a reachable current production defect.

The automatic evaluator holds its evaluator session lock and shared discovery
admission across snapshot, computation, freshness reread and repository.save.
Automatic capture uses that same database-scoped discovery advisory key,
0x49444d47, across acknowledged claim, checkpoint creation and generation.
The scheduler also awaits evaluation before capture in its own lifecycle.
Separate cooperating instances are serialized by the advisory lock.

Checkpoint open is the only current application producer of a non-null fresh
budget captured_at/expires_at lease. It runs under capture admission and an
owned budget prelock. Record does not renew the lease. The claimless outer budget
read can overlap evaluation, but only resets quota or clears invalid progress;
it cannot create the new lease needed for the hypothesized stale-time prune.
Configuration/workload edits invalidate the claim and preserve lease timestamps.
Restore does not renew this lease and has a separate maintenance exclusion.

No normal healthy cooperating interleaving proving the proposed race was found.
Retain the current runtime and lock order unless a reachable failure is shown.
Do not mechanically add a prelock, capture UUID requirement or global fence to
evaluator progression, whose scheduling authority is separate from generation.

## Concrete evidence batch

Add focused isolated PostgreSQL regression coverage using the production database
factory, real evaluator/discovery admission and real report/checkpoint writes.
Use deterministic memory telemetry through the real resource policy and bounded
synthetic evaluation inputs; no provider, routing or learning capability.

Verify both ownership directions with independently constructed database owners:

1. Capture owns discovery admission while a genuine checkpoint open settles.
   Evaluator cannot enter computation/publication. After release, a normal due
   evaluator can publish while retaining valid unpublished progress and quotas.
2. Evaluator owns admission through its real report-save transaction, including
   queued/paused publication and delayed successful acknowledgement. Capture
   cannot enter its callback or claim/open progress during those phases.
3. Exercise transactional rollback and a lost acknowledgement after actual
   PostgreSQL COMMIT. Inspect durability independently and retain the existing
   lifecycle/failure handling. Do not mistake a failed acknowledgement for proof
   that a write was rolled back. Do not add save replay or new retry authority.

Keep report/history/sweep/budget transaction ordering and ordinary CAS-zero
semantics unchanged. Existing tests cover genuine expired/future retention,
duplicate progression, stale revision/offset and atomic rollback; run those
alongside the new production-factory ownership evidence.

The tests protect current orchestration. Do not add a permanent assertion that
requires an uncoordinated pruning defect to persist, or present a direct leaf
fixture bypassing discovery admission as proof of a healthy production race.

## Limits and official research

Observed lock-session loss propagates through the production AsyncLocal scope;
child transactions check enclosing ownership before commit. These are cooperative
checks, not a durable global fence against delayed loss observation, older or
nonparticipating writers, privileged SQL or physical rollback. Any such broader
recovery contract needs separate evidence and design.

Official sources were discovered and read through MCP on November 2, 2026:

- [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  describes application-managed advisory locks, session ownership and row-lock
  behavior. Our conclusion depends on current producers consistently using the
  shared admission; an advisory key alone is not enforcement for every writer.
- [PostgreSQL date/time functions](https://www.postgresql.org/docs/current/functions-datetime.html)
  distinguishes statement start time from wall-clock time. A waiting statement's
  timestamp is not refreshed just because a row becomes available later.
- [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  concerns user-visible markup changes and unobtrusive assistive announcements.
  This evidence batch adds no status content or UI and makes no accessibility
  conformance claim. Existing automatic operator workflows stay unchanged.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limit | Recommendation |
| --- | --- | --- | --- |
| Preserve runtime and verify production admission | Protects the actual healthy boundary without extra coordination | Conditional lost/older ownership remains outside the proof | First batch |
| Add an unconditional progression prelock | Could defend the leaf under uncoordinated contention | Changes report/history/sweep/budget ordering without a demonstrated healthy failure | Defer |
| Add a global durable fence/protocol | Could cover more loss scenarios | Larger authority/schema/compatibility design; not justified by this investigation | Separate evidence required |

Recommended stack: source producer/admission trace, production-factory PostgreSQL
ownership regressions, explicit conditional limitations, then a separately scoped
next item based on what testing actually establishes.

## Selected PR and verification

One uniform random selection from open PRs 580 and 581 chose
[PR 581](https://github.com/cloudbyday90/Classifarr/pull/581), unchanged head
15b66950a5739e6fdb5290f2cf4c0120d4259015. Its candidate, baseline compiler graph
and client inputs match the [settled assessment](client-compiler-pr-581-outcome.md).
The official 3.3.14 release and issues 6322/6328 show no changed fixed candidate.
Retain the previous deferral; do not reinstall a known failing identical compiler
or select another PR to force a dependency change. PR 580 is already adopted.
Both heads remain open, unmerged and mergeable; rebase only a genuinely stale
applicable branch if delivery facts change.

Run the new and related isolated PostgreSQL suites, affected existing unit and
compiler controls, lint/types, ownership and repository quality gates. Reuse
coverage only after proving production/unit/dependency inputs and report hashes
unchanged; new integration tests are outside the unit coverage configuration.
If those inputs change, obtain the appropriate fresh coverage instead.

Update a separate outcome MD, the relevant predecessor/PR records and Unreleased,
perform scoped artifact maintenance, then commit/push all assessed changes on main.
No runtime SQL/lock change, schema, job, endpoint, UI, operator CLI trigger,
provider permission, routing/learning change, release or deployment is proposed.
