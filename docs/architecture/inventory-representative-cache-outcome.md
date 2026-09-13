# Automatic inventory representative cache: outcome

Date: 2026-09-13.

## Delivered behavior

Classifarr now prepares library representative profiles automatically after
startup and reconciles them in the background. It learns from cached descriptions
across active movie and TV libraries, without using library names as features.
No operator declarations, extra settings or new UI panels were added.

The profile is a private, source-versioned full-inventory model, not a held-out
evaluation model. It does not change live destinations, confidence thresholds,
policy authority or automatic routing. No model fine-tuning is performed.

The implementation follows the separate
[design and trade-off decision](inventory-representative-cache-design.md).

## Reconciliation with the previous commit

Reviewed `fe92821d` before changing it. Its multi-start study remains intact,
including the legacy control and mandatory held-out-fold checks. The new runtime
uses the same three starts and fit selection but omits the unused legacy control.
Tests verify the selected and per-start geometry remains identical.

Reuse includes existing current-inventory SQL/projection, source-conflict
exclusions, cached vectors, provider inspection, refresh signals, bounded model
cache and scheduler. A new optional cache `clear` operation supports lifecycle
invalidation. Fitting has its own ESM worker; orchestration, data access and
training are separate modules. No schema, dependency or version change is needed.

## Local Compose observations

The rebuilt service became healthy with a read-only root filesystem. Its actual
scheduler automatically published a profile at 21:17:33 UTC, without a manual
refresh request. The scheduled run took approximately 11.3 seconds.

A separate read-only database probe exercised the same repository, coordinator
and real worker thread, then advanced the reconciliation clock by five minutes:

| Measurement | Observed |
| --- | ---: |
| Active movie/TV libraries | 10 |
| Distinct eligible training descriptions | 6,650 |
| Shared description groups excluded | 2 |
| Selected representative groups | 64 |
| Libraries without groups | 0 |
| Descriptions discarded by support/geometry rules | 2 |
| Unconverged initializations | 1 |
| Fits across initial, immediate and periodic checks | 1 |
| Embedding-generation calls | 0 |
| Provider metadata inspections | 4 |
| Entire three-check probe | 15.373 seconds |

Results were `published`, `not_due`, then `up_to_date`. The periodic run verified
source/model inputs again and reused the completed fit. No new title-level
benchmark samples or accuracy gains are claimed. One of the 30 starts did not
converge; that condition remains in the model and must be respected by a future
shadow scorer. Publication is not permission to route.

A repeat probe after the final input-bounding adjustment encountered concurrent
foreground work: its candidate was `invalidated`, followed by `yielded` checks,
with no published cache and zero generation calls. This is not a successful fit
reuse result; it verifies that the service does not publish through changing
admission conditions. Existing foreground workers were left running.
The final rebuilt application's scheduler then recovered automatically and
published the same aggregate profile at 21:24:39 UTC, without a manual retry.

## Verification

- Focused regression: 13 suites / 173 tests passed, including the earlier
  representative learner, held-out ranking and scheduler behavior.
- Profile-module coverage: 96.71% statements/lines, 96.53% branches. Every parent
  module has 100% line coverage. The nine-line worker entry is exercised through
  real worker success/failure/cancellation tests but is not instrumented by the
  parent Jest coverage process; no coverage exclusion was added.
- PostgreSQL integration: 1 suite / 3 tests passed against the existing disposable
  test database. Tests cover coherent scoped reads, source conflicts, automatic
  visibility after conflict removal, expired vectors and inactive libraries.
- Source/config/vector/membership changes during fitting reject publication.
  Tests also cover missing-vector backfill, periodic discovery without sync hints,
  unchanged-hint reuse, TTL, cache budget, concurrency, shutdown, cancellation,
  provider failure/backoff and error-data redaction.

Full backend regression passed **1,282 suites / 37,060 tests** in 494.580 seconds.
Coverage is 90.11% statements/lines, 82.44% branches and 92.11% functions. The final
focused pass also covers the last worker-input and scheduler-receipt adjustments.
Dependency/copyright preflight, backend typecheck, test/security lint, Markdown
lint and ESM checks passed. The coverage ratchet passed using the current backend
report and the existing unchanged client report; no threshold was reduced.
The unchanged frontend was not rebuilt or retested
separately from the Compose image build. Private probe files remain under ignored
`.tmp/`; no media details, credentials or raw vectors are committed.

## PR and release scope

GitHub MCP returned zero open Classifarr PRs at both selection checks. No closed
PR or another repository was substituted, and no PR was merged. All six workflows
for `fe92821d` passed before this implementation. This is an Unreleased change:
no release, version bump or tag.

## Recommendation stack and limits

1. Keep this automatic background cache: it avoids request-time fitting and
   duplicate model generation. Trade-off: bounded CPU/memory use and rebuilding
   after process restart; the cache is not distributed or persistent.
2. Next, compare these cached profiles against existing decisions for genuinely
   unseen descriptions in shadow mode. Reject self-matches, source drift, sparse
   libraries and unstable initializations. Record disagreements and latency using
   compact aggregate status, not another operator checklist.
3. Evaluate routing promotion only after independent correctness checks. Existing
   inventory placement and cluster similarity are not calibrated confidence.

This version admits the existing trusted local Ollama embedding configuration.
It waits for existing vector backfill and yields to current sync/queue activity.
Remote providers and inventories beyond runtime budgets remain unavailable rather
than triggering paid calls or partial-library learning. Periodic reconciliation
is point-in-time validation, not instant notification of every database writer.
