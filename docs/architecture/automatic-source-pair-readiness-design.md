# Automatic source-pair readiness design

Date: 2026-10-31 (America/New_York). Status: agreed first batch; implemented.
Predecessor: [refresh readiness outcome](inventory-refresh-readiness-cancellation-outcome.md).

## Problem and first boundary

Automatic source-pair evaluation/capture still uses the legacy preliminary
readiness wrapper. Pool acquisition and BEGIN precede its three-second local
SQL timeout; stop fences late heavy admission but does not cancel the probe.
The new refresh infrastructure already solves that boundary for two other
runtimes. Reuse it without copying lifecycle code or importing refresh-specific
diagnostic behavior into evaluation.

Limit this batch to the automatic source-pair outer preflight. Library comparison,
other generic readiness callers, admitted evaluator/capture execution and the
capture workload guard's inner polling remain separate. Both admitted subworkers
own permanent stop controllers and accept no caller AbortSignal. Do not claim
that preflight caller cancellation can cancel an already admitted subworker.
Do not use permanent stop as a shortcut for an ordinary caller abort.

Capture independently checks its enabled budget/window, cooldown, valid stored
complete evaluation and completed policy replay. Workload admission and durable
reservation precede generation. The current tick's evaluator result is not
inference authorization. Preserve that separation, the existing evaluation-then-
capture order, returned evaluator result, child stop paths, retry state, budgets,
reservations, cooldowns, checkpoints and uncertain-outcome semantics.

## Architecture and contract

Extract the existing bounded probe lifecycle into a small shared service, with
an explicit read-only readiness reader and shared three-second constant. Keep
the refresh entry point as a thin adapter owning its existing diagnosis producer
and exact-probe native-query proof. Preserve both refresh runtimes' behavior and
compatibility surfaces. Source-pair preflight uses the shared core with no
diagnosis producer: failures remain quiet deferred/unavailable results, matching
its current presentation rather than creating refresh warning capsules.

Add one fixed source-pair scope to the existing database-module admission. Retain
independent description and representative scopes. A scope stays occupied until
both read cleanup and the actual connection acquisition settle, across runtime
stop/re-registration. There is no admission queue, additional pool, global
timeout change or driver-private queue manipulation. Unknown scope and unsigned
or writable use still fail before acquiring. Existing owner fencing remains
authoritative; readiness never becomes an ownership token.

Use the established three-second probe budget including pool wait and result
acceptance, plus up to 1.5 seconds of existing cancellation-control cleanup.
Reuse the existing signaled, explicitly read-only runner, remaining/inherited SQL
timeout minimum, exact-backend/same-role cancellation and uncertain-client
discard. Run only the unchanged preliminary readiness SELECT. A late grant
after abort returns without BEGIN or SQL; later ticks defer while it drains,
then the normal schedule may try fresh. No timer replays an abandoned request.

Preserve first-owner coalescing. A pre-aborted caller never acquires; a
pre-aborted joiner gets its own cancelled result without affecting the active
owner. Later joining signals cannot cancel the owner. Stop wins over pending
probe results and stops both admitted child workers through their existing
permanent stop paths. Local deadline/occupied scope returns deferred/unavailable;
owner abort during the probe returns cancelled. No probe failure or late ready
result may enter either child. Clear the probe timer before calling the unchanged
composite worker so it cannot shorten the existing admitted work budgets.

Keep the one-minute schedule, three-minute startup delay, noOverlap behavior,
scheduler result semantics, current saved status reader and cached/private CLI
interfaces unchanged. Routine execution requires no operator command. Add no UI,
endpoint, setting, job, schema, provider call, publication/cohort change, routing,
learning, release, deployment, restart or production cleanup.

The budget is timer-based, not a hard event-loop or server-termination SLA.
Acquisition cannot be removed from pg's queue through its public API; a very long
configured pool timeout can defer the scope until that actual request settles.
Cancellation dispatch is not termination proof. Admission is process/database-
module state and resets with its pool, not a cross-process lease. Preserve the
existing refresh diagnostic distinction between native query proof and local
abort; the shared core must not reinterpret generic AbortError as SQL evidence.

## Deferred active-work boundaries

The inner capture workload guard still performs budget/readiness checks before
capture, every two seconds and before reservations. Those acquisitions do not
forward cancellation, and finalization awaits an outstanding poll. This is a
known remaining gap; changing the outer preflight does not close it.

Repository methods named read are not necessarily read-only. Source-pair
readState prunes retained evidence; budget read inserts/resets/prunes state.
Do not move these methods onto the read-only runner or refund/replay uncertain
generation to make cancellation appear successful. Active caller cancellation
requires its own lifecycle and durable-reservation design.

## Official research, tradeoffs and recommendation stack

Official sources discovered and read through MCP on 2026-10-31:

- [node-postgres pooling](https://node-postgres.com/apis/pool) documents FIFO
  acquisition and mandatory release/destructive release. Inference: timeout of
  an awaiting caller does not prove its specific pool request drained. Reuse the
  existing admission tracking that promise instead of reading global counters.
- [Node 24 AbortSignal](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html)
  provides composition, pre-abort checks and one-shot listener guidance. The
  [DOM Standard](https://dom.spec.whatwg.org/), updated October 19, 2026, informs
  explicit cancellation ownership. Internal closed worker statuses remain the
  application's contract; this is not a claim of web API conformance.
- [PostgreSQL statement timeouts](https://www.postgresql.org/docs/18/runtime-config-client.html)
  begin when server commands arrive and are not a pool-wait deadline. Preserve
  shorter settings rather than installing a fresh three seconds inside the
  callback or changing unrelated sessions.
- [PostgreSQL cancellation](https://www.postgresql.org/docs/18/libpq-cancel.html)
  distinguishes dispatch from guaranteed effect. This informs the existing
  discard/server-fallback contract; no libpq implementation is introduced.
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), a May 2025
  Statement, supports minimizing retained diagnostics. Keep source-pair failures
  quiet and fixed; do not log SQL, backend identity, credentials, provider bodies
  or arbitrary caller abort reasons. There is no new visual or WCAG claim.

| Option | Benefit | Cost / limitation | Recommendation |
| --- | --- | --- | --- |
| Shared bounded core with domain adapters and one added scope | Consistent lifecycle, no copied state machine, preserves refresh diagnostics and source-pair quietness | Small extraction requires strong compatibility tests; only preflight is bounded | First batch |
| Copy the refresh guard for evaluation | Smaller immediate edits to existing files | Duplicated lifecycle can drift; refresh terminology/diagnosis can leak | Avoid |
| Change the legacy generic wrapper for every caller | Broad coverage | Unreviewed caller/side-effect and status contracts | Defer |
| Abort admitted workers through stop() | Reuses an existing method | Permanently disables future runs and can confuse charged attempts | Reject |
| Include active capture/poll cancellation now | Covers a larger shutdown gap | Requires separate write, reservation, cooldown and uncertain-provider contracts | Separate design |
| Promise timeout or SQL timeout alone | Simple | Leaves queued acquisition/SQL or late results unresolved | Insufficient |

Recommended stack: shared preflight lifecycle, plain fixed read-only SELECT,
stable source-pair admission scope, existing cancellation/server fallback,
domain-owned diagnostics, unchanged admitted permissions and real PostgreSQL
compatibility checks. Keep automatic execution and current UI surfaces.

## Verification and delivery

Start with regression tests for pre-abort and stop during pending readiness.
Verify exact probe deadline, first-owner/joiner semantics, no child/provider or
budget operation on deferral, late result suppression and fresh automatic retry.
Prove the timer cannot abort admitted work and source-pair failures do not mint
refresh diagnostic capsules. Preserve both refresh adapters' native proof,
local-abort quietness, unknown gaps, cached state and existing cooldowns.

Use the actual production database factory with isolated PostgreSQL for blocked
SQL cancellation, saturated pool/long timeout, repeated runtime replacement,
late grant without SQL, independent scopes and subsequent pool reuse. Verify
read-only enforcement and no evaluation/budget/checkpoint mutations before
admission. Retain existing replay-versus-inference, charged reservation, HTTP
shutdown and stop regressions without adding paid provider calls or live writes.

Run focused and repository gates before full coverage/ratchet. Review exact
ownership drift without resetting classifications, baseline or group limits.
Keep design/outcome documents separate, update Unreleased, recheck open PRs,
and commit/push on main. No release or deployment is implied. The user confirmed
this complete first-batch contract before implementation; verification is recorded
in the separate [outcome](automatic-source-pair-readiness-outcome.md).
