# Capture failure admission ownership design

Date: 2026-11-01 (America/New_York). Status: agreed first batch; implemented and verified.
Predecessor: [finalization acknowledgement outcome](capture-finalization-acknowledgement-outcome.md).
Outcome: [validation and limits](capture-failure-admission-ownership-outcome.md).

## Observed overlap

Primary capture finalizers already run inside discovery admission. Failure
finalization runs in the worker's outer catch, after admission has released its
resource permit and database advisory lock. Attempt A can therefore wait for its
failure write while attempt B acquires admission and saves a newer status under
the same configuration revision. A's delayed finish can overwrite B afterward.

An admission-rejected tick also retains its preliminary budget state and attempts
an unadmitted failure finish. The previous zero-row helper protects revision
mismatches, not these matching-revision writes.

## Recommended first batch

Make admitted failure finalization part of the existing callback's awaited
lifetime. Catch its exception before the callback unwinds, await its existing
best-effort finish there, and rethrow so discovery admission still observes a
failed callback. Keep the permit, session lock and inherited database lock-scope
checks through settlement. A later cooperating worker cannot acquire discovery
admission while this callback and cleanup remain active.

Preliminary-read failures, rejected admission and failures after callback
completion use the existing observed result and process-local fallback only;
they must not call failure finish. In particular, a captured finish followed by a
final memory-check or advisory-unlock failure does not authorize another durable
status write. The captured cache/status can remain saved while the worker reports
its later observed failure. Do not imply rollback or replay.

Extract a small per-flight failure coordinator and fixed classifier as appropriate,
keeping the existing finalization helper and worker composition modular. Retain
only a fixed classified result and local retry state; no raw errors, new public
result fields or durable attempt framework is needed for this batch.

## Exact failure precedence

At the first admitted failure-handling entry:

1. Permanent worker stop prevents failure finish and keeps the stopped override.
2. A primary acknowledged zero-row finish remains deferred, with no second finish.
3. Otherwise, if the admission signal is already aborted, classify its reason
   using the existing fixed mapping; else classify the caught error as today.
4. Record that classification and start the existing five-minute local fallback
   once, before awaiting cleanup. A later pressure/unlock error must not restart
   the timer or replace this recorded outcome.
5. Await the existing best-effort finish with the permanent stop signal, inside
   the admitted callback. A cleanup zero-row result or rejection preserves the
   recorded original failure. Rethrow through admission after settlement.

The outer catch gives permanent stop precedence, then returns an already-recorded
failure without reinterpreting the helper's later cleanup-set notApplied flag.
If no admitted failure was recorded, classify the boundary/pre-admission failure
and set the local fallback once, without a failure finish.

Rethrowing matters: the session-lock wrapper suppresses an unlock error when its
callback already failed. Swallowing the callback exception would change that
precedence. Recording the fixed outcome also preserves it if discovery admission
replaces the thrown exception with an aborted-signal reason during cleanup.

## Authority and resource limits

This is a cooperative lifecycle guarantee for the updated worker path. Existing
AsyncLocalStorage lock-scope checks run before BEGIN and COMMIT and reject writes
after lease loss is observed. Already-dispatched row updates serialize conflicting
budget writes through transaction settlement. These are not a durable database
attempt fence against an advisory-session loss that is not yet observed,
arbitrary direct SQL or nonparticipating older binaries.

Normal runtime admission uses a shared maintenance lock, so do not claim it
universally excludes mixed binaries. External/supervised readiness checks and
legacy default migration startup have different compatibility behavior. No live
activation or deployment procedure is changed by this local batch.

Cleanup now holds the discovery permit, advisory lock and existing 250 ms memory
monitor until it settles. Preserve the fifteen-second statement/one-second lock
settings, pool and transaction handling, cancellation, ownership fail-stop and
uncertain-client discard. Those settings do not bound acquisition, COMMIT reply
or whole-worker shutdown. Add no detached work, SQL cancellation or new deadline.

Keep preliminary budget reads and their existing retention work unchanged. Keep
revision predicates, raw finish results, bootstrap, cooldown preservation,
reservations, progress, cache publication, retention and charged attempts. Preserve
automatic schedules, first-owner coalescing, permanent stop and the evaluator-only
composite result. Fresh installs remain off, and restart loses local fallback as
before. No restore or historical evidence semantics change.

Add no schema, claim token, endpoint, UI, operator CLI trigger, setting, job,
provider capability, routing, learning, release, deployment or restart.

## Official research and tradeoffs

Research is current to 2026-11-01. Official URLs were discovered through search
MCP and opened on that date; no later-November behavior is assumed.

- [PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  distinguishes session advisory locks from transaction/row locks. Inference:
  cleanup must settle before the application releases its existing session lock
  for that lock to serialize the complete cooperating writer lifetime.
- [Node asynchronous context](https://nodejs.org/api/async_context.html) documents
  run-scoped context propagation. This design uses the application's existing
  AsyncLocalStorage.run checks on Node 24; no API from the documentation's newer
  Node version is introduced. Context health checks are not remote fencing proof.
- [node-postgres transactions](https://node-postgres.com/features/transactions)
  require one checked-out client through transaction settlement. Preserve awaited
  BEGIN/callback/COMMIT-or-ROLLBACK and existing client release/discard behavior.
- [PostgreSQL protocol flow](https://www.postgresql.org/docs/18/protocol-flow.html)
  distinguishes query responses, disconnection and cancellation. Inference: local
  failure, stop or lost acknowledgement cannot prove rollback or safe replay.
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), a May 2025
  Statement, supports minimizing diagnostic data. Retain fixed results without
  new raw errors, identifiers or disclosure surfaces. There is no new web
  interaction or accessibility contract in this batch.

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Await failure finish inside existing admission | Closes the demonstrated cooperating-worker overlap; no schema or claim lifecycle | Retains resources during cleanup; depends on observed lease health | First batch |
| Durable UUID claim and guarded finish | Can reject superseded updated writers even before lease loss is observed | Adds schema, claim acknowledgement, legacy callers, restore and token-lifecycle decisions | Separate follow-up |
| Increment configuration revision per attempt | Reuses an existing field | Changes administrator CAS, workload, reservation, checkpoint and rotation semantics | Reject |
| Reacquire admission or detach cleanup | Could shorten the original callback | Cleanup can race newer outcomes or outlive its owner; reacquisition changes scheduling authority | Reject |

Recommended stack: existing discovery/resource admission, awaited owned cleanup,
existing lock-scope and transaction health checks, one fixed per-flight failure
outcome/local fallback, unchanged zero-row interpretation and permanent-stop
precedence. Keep operator execution automatic and current UI/status surfaces quiet.

## Verification and delivery

First reproduce a pending failure finish allowing a second cooperating worker
into discovery admission. Use the production database factory and isolated
PostgreSQL to prove that the complete cleanup keeps advisory ownership and the
resource permit, including queued acquisition and delayed COMMIT acknowledgement.
No live database or paid provider may be contacted.

Verify busy/pre-admission failures never finish; post-success memory/unlock
failures never finish again; callback plus unlock failure retains the recorded
outcome; already-aborted admission retains precedence; cleanup-time cancellation
does not reset fallback; permanent stop still overrides. Cover primary zero,
cleanup zero and unknown COMMIT separately. Prove observed lease loss prevents
late queued finalizer DML and keeps existing client discard/no replay.

Retain cache/progress/charged-reservation, cooldown, restore and fixed-result
regressions. Run focused checks before broader backend coverage and relevant
quality/ownership gates. Review exact ownership drift before changing any pin;
retain unresolved classifications and baseline. Record the implementation and
validation in a separate outcome document, update Unreleased, then commit and
push on main after the agreed batch passes. No release is created.

GitHub MCP currently reports no open PRs, including Dependabot. Recheck at
delivery; if still empty, random-PR implementation and stale dependency rebasing
do not apply. Use artifact maintenance before substantial tests and at handoff,
preserving recovery assets, changed-metadata exclusions and other projects.

Next: assess durable finalization fencing for lease loss not yet observed, with
explicit claim/restore/legacy semantics. Keep bounded write acquisition and
whole-worker shutdown separately scoped; do not add replay authority implicitly.
