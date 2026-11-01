# Capture failure finalization stop outcome

Date: 2026-11-01 (America/New_York).
Design: [agreed scope, research and alternatives](capture-failure-finalization-stop-design.md).

## Result

The capture failure handler now passes its permanent stop signal as the fourth
argument to the existing budget.finish call, with a null publication fingerprint.
After the awaited attempt settles, including rejection, it rechecks stop and
returns the existing stopped result when shutdown arrived during finalization.

The change stays in the small existing worker. Repository SQL, write acquisition,
transaction handling, other finish callers and error classification are unchanged.
No read-only runner, timeout, detached write, new retry or general cancellation
framework is introduced. Local cooldown begins at the same point before the
await and retains its five-minute fallback if persistence fails. Workload/resource
refusal can still persist a cooldown through the live permanent worker signal.

Stopped describes capture's local lifecycle, not a rollback receipt. The parent
source-pair composite still returns the evaluator result. An already-dispatched
commit can complete or lose its acknowledgement; the existing transaction runner
discards uncertain clients and never replays the callback. Reservations, counters,
progress, rotation, checkpoints and publication remain unchanged.

Default-off setup and automatic schedules/status/UI are unchanged. No operator
CLI trigger, endpoint, setting, job, schema, routing, learning, release or
deployment is added.

## Verification

Two regression cases failed against the original handler: stop during a pending
failure finalizer returned unavailable after either successful or rejected
settlement. Both now return stopped and receive the original permanent signal.
Tests retain the existing behavior that a repeated run during failure cleanup
returns cooldown, without starting another finish. Additional cases verify the
exact local retry boundary, failed persistence and live-signal persistence after
workload cancellation. Stop already observed before cleanup still skips finish.

Focused worker, transaction ownership, composition and repository/code-health
checks passed five suites / 37,522 tests. The ownership gate required no manifest
change: the worker adds no SQL boundary or writer capability. Existing pins,
classifications, baseline and limits stay unchanged; productionCompatible: false
continues to mean unrelated writer debt is unresolved.

Five new PostgreSQL cases pass through the production database factory:

- A saturated pool keeps the finalizer awaited after stop; once acquired, it
  issues BEGIN/ROLLBACK with no repository SET/INSERT/UPDATE and preserves all
  budget/cache state. The fixture observes the actual finish invocation as well
  as the held client and queue, avoiding attribution from global counters alone.
- An UPDATE genuinely waiting on a row lock executes after the blocker releases,
  then rolls back through the repository's existing signal check before COMMIT.
  Counters, progress, cached responses and publication remain unchanged.
- A real COMMIT with delayed acknowledgement stays durable after stop. The worker
  returns stopped, retaining one charged request / 8,448 reserved tokens and the
  existing one-hour failure cooldown, with one finish attempt.
- A fault-injected lost acknowledgement after real COMMIT retains the same
  durable state, discards the uncertain client and performs no second UPDATE or
  COMMIT. This is acknowledgement fault injection, not a claim of a reproduced
  physical network outage.
- A stale-revision finish retains its existing zero-row result and changes no
  current state.

Existing budget and database recovery regressions passed two suites / nine tests.
All fixtures use isolated PostgreSQL and synthetic cached responses; no paid or
live provider is contacted. The fixture marks cooldown due using a database
timestamp because the column is non-null, and closes its pool on setup failure.

Backend lint/type checking, both dependency scans, static ESM import/mock shape
checks, copyright, four policy gates, Markdown, whitespace and staged secret
checks passed.

Full backend coverage passed 1,913 suites / 62,024 tests, with one existing skip,
in 910.956 seconds. Coverage was 89.22% statements/lines, 86.64% branches and
90.77% functions. The coverage ratchet passed without baseline changes. It reused
the October 30 client report because client source is unchanged; no fresh
frontend test/build is claimed.

Artifact maintenance reused the recent verified filesystem inventory and recorded
fresh image/container metadata. Classifarr retained its identity, image, start
time and healthy state, and isolated PostgreSQL containers are gone. No files or
images were removed; current evidence, backups and recovery/reference assets stay
protected. A separate transient fixture was observed in shared Docker state and
left untouched; its cause is unassessed. No image build, deployment or restart
occurred.

## Limits and next item

This adds cooperative stop handling, not bounded write acquisition, active SQL,
commit/rollback or whole-worker shutdown. A late acquired client can issue BEGIN
before callback entry checks observe stop. Active DML can run before rollback, and
stop after COMMIT dispatch cannot guarantee rollback. No uncertain operation is
refunded or replayed. Existing ownership health checks still apply; the catch's
cleanup remains outside the discovery admission lease.

Same-revision finalizers can still overwrite newer status or shorten a longer
cooldown. Zero-row revision mismatches remain normal query results, and the
shared transaction wrapper can recreate a default singleton after deletion.
These are documented gaps, not silently repaired by stop propagation.

The next batch is specified in the
[cooldown preservation design](capture-finalization-cooldown-preservation-design.md):
prevent a later five-minute finish from shortening a recognized longer cooldown,
with explicit serialization, future-clock, stale/no-op and restore boundaries.
Status ownership and broader write cancellation remain separate; do not infer
retry authority from a stopped result.

GitHub MCP found no open PRs, including Dependabot, so no random PR implementation
or stale dependency rebase was applicable. No PR was merged. Unreleased records
the change; the design contains the recommendation stack and pros/cons.
