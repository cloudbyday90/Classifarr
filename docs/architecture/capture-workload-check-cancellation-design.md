# Capture workload check cancellation design

Date: 2026-10-31 (America/New_York). Status: agreed first batch; implemented.
Predecessor: [source-pair readiness outcome](automatic-source-pair-readiness-outcome.md).

## Problem and observed boundary

The automatic capture workload guard checks budget/revision/window and inventory
readiness before capture, every two seconds and immediately before a reservation.
Its SQL timeout begins after acquisition. Readiness acquires a second connection,
neither read forwards cancellation, and callback finalization waits for the current
monitor without aborting it. A saturated pool can therefore delay an otherwise
completed or cancelled invocation.

Production has one caller through automaticSourcePairWorkers and
adjudicationBudgetWorker. Capture awaits generation calls sequentially. The client
awaits a fresh reservation hook and checks its signal before dispatch. At most one
reservation check overlaps one serial monitor check; initial admission completes
before either. Preserve those separate meanings. An older poll result must never
replace a fresh reservation check.

## Recommended first batch

Extract a small fixed reader for the two existing SELECTs. Run budget first and
short-circuit on the existing daily-calls, exact-revision and open-window checks;
only then run the unchanged inventory readiness SELECT. Preserve the two separate
transactions and inherited isolation, making both explicitly read-only through
the existing signaled database runner. No repository write method enters this
path. Its default BEGIN READ ONLY inherits server isolation; combining reads
would change readiness's snapshot under non-default repeatable-read/serializable
settings. Do not introduce a shared snapshot or claim an atomic
foreground-work/reservation guarantee.

Reuse one three-second acquisition-to-result budget across the entire check,
passing the remaining time to each transaction, plus the existing cancellation
cleanup of up to 1.5 seconds. The runner keeps
shorter inherited SQL timeouts, exact-backend/same-role cancellation, ownership
health checks, uncertain-client discard and late-grant release without SQL.
No new driver API, pool, global timeout or general cancellation framework.

Add exactly two fixed database-module admission scopes: initial/monitor and fresh
reservation. They preserve the production maximum of two concurrent checks.
Each read keeps its scope occupied through cleanup and actual acquisition
settlement, including runtime replacement. The second read reuses the role scope
only after the first succeeds and settles; local role ownership spans the check.
Unknown, unsigned and writable scoped requests
remain rejected. Occupied slots fail closed without a queue; do not coalesce a
reservation with a poll or replay an abandoned check. Unexpected same-role overlap
must not grow acquisitions or authorize work using another check's result.

Keep an invocation-owned cancellation controller and track all owned check
promises, including explicit reservation checks. On callback success or failure,
stop scheduling, close check admission, abort pending reads and drain their owned
check promises. Preserve the callback's primary result/error. Parent stop/resource
cancellation retains existing first-abort behavior; local timeout, occupied slot,
query failure and missing/invalid readiness retain the fixed
evaluation_workload_deferred refusal. No raw error or caller abort reason is
logged. Late and escaped checks cannot authorize another reservation or generation.

The shared deadline spans both transactions and result acceptance; do not restart
it for readiness. Failed/aborted budget reads cannot start readiness. At most one
read cleanup is active per check; finalization aborts and drains the two roles
together rather than adding their cleanup budgets sequentially.

The existing two-second monitor cadence remains self-serial, with no new retry
loop or cached success. Initial/fresh checks use current reads. Keep budget-first
short circuit, read-only refusal on empty/disabled setup, and signal checks before
dispatch. The existing workload guard remains the sole production entry point;
its readiness-only test seam may be replaced with a whole-check reader seam without
adding a new application extension point.

## Authority, lifecycle and explicit exclusions

No new work on a fresh installation; the configured budget remains off by default.
The guard reads at most one budget row and one readiness result and stores no
checkpoint, diagnostic payload or report. Existing automatic schedules, saved
status and UI stay unchanged. Add no operator CLI trigger, endpoint, setting,
job, schema, provider call, routing, learning, release or deployment.

Leave budget.read on its existing write path: it inserts the singleton, resets
the UTC day and prunes progress. Reservation, finish, checkpoint and publication
transactions likewise retain their existing signals, ownership and retry policy.
Keep independent stored replay, budget/revision/window, cooldown, reservation,
checkpoint identity and publication gates. Do not refund charged attempts,
regenerate uncertain provider work or reinterpret cached evidence.

This bounds only inner workload checks and their guard finalization. Earlier
budget/repository operations and the failure handler's unsigned budget.finish
remain outside this boundary. Do not claim bounded whole-worker shutdown or
provider rollback. Caller cancellation of admitted workers, library comparison
and write-transaction cancellation require separate designs.

Admission is process/database-module state, not a cross-process lease. Restart
resets it with the pool. A cancelled check can finish locally while the original
pool request is still queued; its database scope remains charged until actual
settlement. Draining owned check promises does not promise physical connection or
server termination. Timer budgets are not a hard event-loop SLA. Setup before
the read runner's local settings retains connection defaults; unavailable control
can leave remote SQL until its server fallback timeout.

## Official research and alternatives

Official sources discovered and read through MCP on 2026-10-31:

- [Node 24 AbortSignal](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html)
  supports composition, pre-abort checks and one-shot listeners. Apply explicit
  lifetime ownership so normal callback completion also closes outstanding reads.
- [node-postgres pool API](https://node-postgres.com/apis/pool) documents FIFO
  waiting and release/destructive release. Inference: a locally cancelled await
  does not prove its pool acquisition drained. Reuse exact-promise admission.
- [PostgreSQL timeouts](https://www.postgresql.org/docs/18/runtime-config-client.html)
  measure server commands and do not cover pool wait. Keep the existing runner's
  end-to-end budget and shorter inherited settings instead of resetting three
  seconds separately for each query.
- [PostgreSQL transaction modes](https://www.postgresql.org/docs/18/sql-set-transaction.html)
  distinguish read-only restrictions from isolation. READ COMMITTED takes a fresh
  command snapshot; repeatable-read retains the first query's snapshot. Preserve
  separate transactions and inherited defaults rather than silently changing
  visibility or adding an atomic reservation/foreground lock.
- [PostgreSQL cancellation](https://www.postgresql.org/docs/18/libpq-cancel.html)
  distinguishes dispatch from guaranteed effect. This informs existing server
  fallback/discard behavior; no libpq implementation is introduced.
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), a May 2025
  Statement, supports minimizing diagnostics. Keep fixed refusal categories and
  no new retained error data or UI surface.
- [W3C Web Sustainability Guidelines](https://www.w3.org/TR/2026/DNOTE-web-sustainability-guidelines-20261016/),
  an October 16 Group Note Draft, offers non-binding guidance on reducing database
  query complexity and waste. Bound the existing two reads and prevent abandoned
  retries from accumulating; do not trade away admission freshness merely to
  reduce acquisitions. It is not a W3C Recommendation or an application
  conformance claim.

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Fixed reader with existing transaction separation, shared deadline, two role scopes and invocation-owned drain | Preserves fresh checks, inherited isolation and current parallelism; reuses existing cancellation; bounded acquisitions | Two acquisitions per valid check, as before; only inner reads are bounded | First batch |
| One shared slot, reuse an active poll | Small state machine | Older poll success can replace fresh reservation evidence | Reject |
| One slot, wait then perform a fresh check | Fresh evidence with less concurrency | Adds waiting/freshness rules and a separate wait budget | Defer |
| Combine both SELECTs in one transaction | One acquisition and simpler drain | Changes readiness's snapshot under non-default isolation | Defer |
| Timeout wrapper without cancellation/admission | Small patch | Abandoned SQL/queued requests can accumulate | Insufficient |
| Extend cancellation to budget writes and full worker | Broader shutdown coverage | Requires write-outcome, cooldown and reservation design | Separate batch |

Recommended stack: fixed two-SELECT reader preserving separate transactions,
existing read-only runner and one shared three-second check budget with remaining
timeouts, two stable role scopes, invocation-owned cancellation
and drain, unchanged reservation/provider authority, real PostgreSQL plus loopback
HTTP verification. Keep the operator process automatic and the UI quiet.

## Verification and delivery

First demonstrate the blocked-poll finalization regression. Verify exact budgets,
pre-abort, stop during acquisition/SQL, normal callback completion, primary-error
preservation, two-role overlap, fresh reservation reads, no rearm or late admission,
empty/disabled/revision/window/foreground/unknown refusals and unchanged cooldowns.

Use the production database factory against isolated PostgreSQL: blocked reads in
each SELECT, saturated one-client pool with a long acquisition timeout, occupied
scopes across recreated guards, late grants without SQL, all owned checks drained,
shorter inherited SQL limits, unrelated reader isolation and subsequent pool reuse.
Existing HTTP cancellation/charged-attempt tests remain, but their facade ignores
transaction options and cannot alone prove the new cancellation contract. Add
production-factory HTTP evidence that cancellation retains a charged reservation
and prevents another dispatch/publication. Do not contact paid or live providers.

Run focused tests and review exact ownership drift before full coverage/quality
gates. Preserve classifications, baseline revision and review-group limits. Keep
design/outcome documents separate, update Unreleased and the predecessor's next
item, recheck PRs, and commit/push all reviewed changes on main. No release or
deployment. The user confirmed this complete first-batch contract before
implementation. Verification is recorded in the separate
[outcome](capture-workload-check-cancellation-outcome.md).
