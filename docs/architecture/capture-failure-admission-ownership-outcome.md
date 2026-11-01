# Capture failure admission ownership outcome

Date: 2026-11-01 (America/New_York). Status: implemented and verified.
Design, official November research and tradeoffs:
[failure admission ownership design](capture-failure-admission-ownership-design.md).

## Change and evidence

The admitted capture callback now catches its failure, awaits best-effort failure
finalization before returning to discovery admission, and rethrows. The discovery
permit, database advisory lock and inherited lock-scope checks therefore cover
the cleanup's awaited lifetime. A later cooperating capture cannot acquire that
admission while cleanup remains active.

A small per-flight failure coordinator owns fixed classification and the local
five-minute fallback. It honors an admission reason already aborted at failure
entry and primary acknowledged zero-row deferral, records once before cleanup,
and preserves that result through later pressure/unlock errors. Cleanup zero or
rejection cannot replace the recorded primary failure or trigger another attempt.
Permanent stop still overrides the returned result.

Pre-admission failures and errors after callback completion use the existing
observed result/local cooldown only. They no longer issue a failure finish. A
captured status/cache can remain saved when a later memory checkpoint or unlock
acknowledgement fails. This is an intentional ownership boundary, not a rollback
or persistence receipt for the later local failure.

The outer catch reads the recorded result instead of persisting after release.
Rethrowing from the admitted callback preserves the session-lock wrapper's
callback-failure/unlock-error precedence. Existing repository SQL, raw results,
cooldown validity, quotas, progress and cache contracts are unchanged.

## Verification

Before implementation, six of nine new service regressions failed against the
old worker. They reproduced cleanup outside admission, unadmitted failure writes,
post-callback status refinement and loss of an admitted outcome to a later error.
The focused service run passed four suites / fifty-four tests after the fix.

The corrected full run below includes service, code-health, database ownership
and inventory-ownership checks. They retain primary-zero versus cleanup-zero
semantics, error-text non-authority, stop override, coalescing and exact fallback
boundaries.

The focused isolated PostgreSQL run passed five suites / twenty-eight tests.
The production database factory, real advisory locks and resource policy with
deterministic memory telemetry demonstrate:

- Queued failure cleanup holds its advisory lock and discovery permit until
  settlement. A busy admission performs no failure finish, and resources become
  available after the owner settles.
- After real advisory-session termination is observed, late pool acquisition
  performs only the existing ROLLBACK cleanup, without BEGIN or finalizer DML.
  A newer owner's already-saved status survives unchanged.
- Delayed/lost acknowledgement after real cleanup COMMIT retains admission until
  settlement. The durable result, cache/progress and charged reservation survive;
  there is one finish, no replay, and permanent stop does not claim rollback.
- Callback failure followed by real unlock acknowledgement failure preserves the
  callback's outcome. Post-success unlock and memory-check failures remain local
  and do not rewrite captured status.

Existing stop fixtures now inject failure within the admitted callback so they
still exercise authorized queued/active cleanup. Pre-callback rejection has
separate local-only coverage. Prior acknowledgement and publication tests also
retain revision, bootstrap, cache, charged-attempt and unknown-COMMIT evidence.
All database/provider fixtures are isolated or in-process; no live service is used.

Adjacent PostgreSQL checks passed eight suites / eighty-nine tests. That run
includes a repeat of the six settlement cases after making their checkpoint
timing deterministic; it is not counted as new independent cases. Together the
two runs cover twelve distinct PostgreSQL suites / 111 tests. The new test
helper uses its own adjudication-specific filename, and the pre-existing capture
fixture is unchanged. The initial full coverage run was interrupted after that
naming collision was found; only the corrected final run is eligible evidence.

Backend lint/type checking and both dependency scans passed. The inventory
ownership gate retains its original baseline/classifications and no pin changes.
Its productionCompatible false result and unresolved writer debt remain; this is
not live-writer authorization. Final broader validation is recorded below.

## Limits and next item

This coordinates cooperating updated worker paths through the existing lease
and observed health checks. It is not a database attempt fence against advisory
loss that has not yet been observed, arbitrary SQL or nonparticipating older
binaries. Normal runtime maintenance admission is shared, and startup modes have
different schema compatibility checks; no universal mixed-binary exclusion is
claimed.

Cleanup retains the permit, advisory session and 250 ms memory monitor while
pool acquisition, SQL and transaction settlement are awaited. Existing statement
and lock limits do not bound the entire write or shutdown. Stop cannot undo an
already-dispatched COMMIT. No detached work or uncertainty-based replay was added.

Preliminary budget reads retain their existing retention work; local-only failure
handling does not mean those reads never write. Reservations, charged attempts,
progress/cache publication, restore, singleton lifecycle, automatic schedules and
the evaluator-only composite result remain unchanged. Fresh installs remain off.

The design contains the recommendation stack and pros/cons. No schema, token
protocol, UI, operator CLI trigger, endpoint, job, setting, provider capability,
routing or learning change was added. No release, deployment or restart occurred.

Next: assess a durable finalization fence for lease loss not yet observed, with
explicit claim, legacy-writer and restore semantics. Keep bounded write acquisition
and whole-worker shutdown separately scoped; do not implicitly add replay authority.

## Validation handoff

The corrected full backend coverage run passed 1,915 suites / 62,089 tests, with
one existing skip, in 868.319 seconds. Coverage was 89.22% statements/lines, 86.65%
branches and 90.78% functions. The coverage ratchet passed without baseline
changes. Client source is unchanged; the ratchet reused the October 30 07:37
client coverage-final report. No fresh frontend test/build is claimed.

Static ESM import/mock-shape checks, copyright and four policy gates passed.
Markdown passed 2,422 files; whitespace and staged secret checks passed.
Unreleased records the change, and the predecessor outcome links to this batch.
Work and delivery use main, with no version bump or release.

The final GitHub MCP intake found no open PRs, including Dependabot. Random
open-PR implementation and stale dependency rebasing were therefore inapplicable.
No PR was merged.

Artifact maintenance reused the verified recent filesystem inventory and its
changed-metadata/unreviewed-file exclusions. Fresh context/daemon, all-container
and image metadata confirms the same Classifarr container, image, start time and
healthy state. No Testcontainers remain. No files or images were removed; current
evidence, recovery assets and shared resources remain protected. Private receipts
stay under .tmp. No image build, deployment or restart occurred.
