# Health completion fencing: design

Date: 2026-10-12. Scope: process-local health observations, not recovery writes.

## Evidence and contract

`healthCheckService` assigns every awaited result directly to shared state. Manual
refresh, heartbeat and detailed health can overlap; a slower old observation can
replace a newer one, including after reset. The aggregate cache can independently
retain outdated service objects. Configuration reads precede asynchronous probes.

Use a small ESM coordinator with one in-flight check per service. Overlapping
callers share that work rather than starting competing probes. Reset replaces the
generation; old completions cannot publish, alert, or clear newer work. Different
services remain independent. Only accepted results update the authoritative cache.
Aggregate responses project that cache at completion, and cached aggregates expire
when its version changes. Database readiness retains its existing status rules.

For each of the ten configuration-dependent checks, capture a private keyed digest
of the exact successfully read rows and its fixed read callback. Before publishing,
repeat that read once and compare content. This detects committed changes made by
other processes too, without relying on incomplete route-save hooks. Compare row
sets independent of row/object-key order. Never expose digests, keys or rows through
health responses/logs. No migration, backfill, new dependency or provider write.

A changed configuration yields unknown with `configuration_changed`, no stale
membership/provider details and actionable Refresh guidance. A failed re-read
uses the existing sanitized database diagnostics. Initial read failures perform no
probe and no validation read. Unknown checks do not send image failure/recovery
notifications. Normal transient/permanent/cancelled failure meanings are retained;
no immediate retry is admitted for any outcome.

## Bounds and limitations

One in-flight check per service per process generation; one captured configuration
read and at most one validation read per check. Existing provider timeouts, response
bounds, heartbeat cadence, memory safeguards and authentication are unchanged.
No new timer, durable queue, cooldown or attempt budget is needed for read-only
observations. Reset is internal lifecycle/test control, not a public retry endpoint.
It fences completion but does not cancel already admitted transport work.

No database transaction or lock is held across provider I/O. Validation is a
point-in-time content comparison, not a transactional lease or durable revision.
It does not detect an A-to-B-to-A change between reads, or a change committed after
the validation snapshot. Already completed cached observations are not instantly
invalidated by settings saves; normal freshness and existing refresh cadence apply.
The next separate item is post-commit cache invalidation, with cross-process
delivery/reconciliation, if immediate settings visibility is required.

Fresh/disabled installations remain inactive after a confirmed empty/disabled read.
Restart clears in-memory observations. A missed or failed check is unknown, never
evidence that a provider is absent. Complete means regression tests prove shared
admission, reset fencing, changed/failed validation, aggregate freshness and alert
suppression; local image checks and schema dump remain separate evidence.

## Alternatives and recommendation stack

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Completion sequence only | Small, rejects old finishes | Still probes concurrently and misses settings changed by another writer |
| Transport cancellation only | Can reduce wasted work | Every provider must support cancellation; cannot retract a completed effect |
| Save hooks only | Immediate local invalidation | Easy to miss write paths; does not cover another process |
| Shared admission + content validation (chosen) | Bounded probes; detects changed committed inputs | One extra database read; unknown until next check on drift |
| Durable revision + notifications | Broader immediate consistency | Schema and all-writer coordination; disproportionate for this bounded fix |

Recommendation: shared admission, fenced publication, private content validation,
then aggregate-cache coherence. Preserve safeguards and defer broad configuration
event infrastructure rather than claim instant cross-process invalidation.

## Official research

Discovered and opened with MCP search on 2026-10-12; retrieved material available
then, not a claim about all later October changes.

- [Node timers](https://github.com/nodejs/node/blob/main/doc/api/timers.md): intervals
  schedule repeated callbacks; stopping a timer does not establish an application
  completion-order guarantee. The coordinator is our application-level inference.
- [Vue watcher cleanup](https://vuejs.org/guide/essentials/watchers): documents stale
  asynchronous callbacks after inputs change. This is the analogous failure mode,
  not a proposal to use Vue watchers in the backend.
- [Node AbortController](https://nodejs.org/docs/latest/api/globals.html): cancellation
  signals notify supporting APIs. Fencing is not evidence of transport cancellation.
- [PostgreSQL consistency checks](https://www.postgresql.org/docs/17/applevel-consistency.html):
  successive reads can observe different committed states. We intentionally use
  that for conservative drift detection, not a claim of serializable consistency.

GitHub MCP enumerated zero open Classifarr PRs at task admission. No random open
PR was available; none will be substituted with a closed or merged PR.
