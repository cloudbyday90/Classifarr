# Shared work admission

## Design and decision — 28 September 2026

Discovery already checks memory and holds a database advisory lock. Ingestion
and queue workers have separate concurrency limits, however, so each can admit
work without accounting for the others. The previous resource assessment found
a 2 GiB container limit, a 1.5 GiB V8 heap limit and no CPU quota. Raising the
heap limit would leave less room for PostgreSQL, buffers and native allocations.

Introduce one small, process-local admission service shared by ingestion, queue
dispatch and inventory discovery/evaluation. Preserve database ownership locks,
source recovery, music exclusion, readiness checks and routing permissions.

| Work | Reservation | Maximum active | Lifetime |
| --- | ---: | ---: | --- |
| Library ingestion | 128 MiB | 2 | Entire owned scan, including cleanup |
| Queue task, including metadata backfill | 64 MiB | 25 | Task promise settles |
| Inventory discovery/evaluation | 768 MiB | 1 | Discovery callback and cancellation settle |

These are conservative admission estimates, **not measured allocation ceilings**.
Preserve the existing reserve: one eighth of effective memory, clamped to
128–512 MiB. A new task needs available memory covering that reserve, all active
reservations and its own estimate. Count reservations conservatively even when
their work has already allocated memory. Unknown telemetry defers new work.
After a memory denial, require another 64 MiB for that work class to resume;
this hysteresis does not stop smaller work after a large evaluation is denied.

New discovery waits while ingestion or queue reservations are active. Existing
work is not preempted. Existing discovery pressure cancellation remains in place.
No waiting-promise list, new polling loop, persistent job, schema change or
configuration bypass is introduced. Acquisition is synchronous; release is
idempotent. State has three fixed work classes rather than per-library entries.

The ownership review pin for `mediaSync.mjs` is updated after reviewing the new
entry path: resource refusal returns before ownership; every admitted scan still
uses `withOwnership`, and its reservation is released only after that operation
settles. The SQL/ownership analysis fingerprint is unchanged. This pin update
does not authorize any previously unresolved inventory writer.

## Recovery and visibility

Admission occurs before ingestion ownership or queue dequeue. Refusal must not
consume attempts, mutate inventory, claim a task or be reported as completion.
The queue polls normally and ingestion watchdog/scheduled syncs retry normally.
A manual rescan of an already-complete library is not a new durable request:
after deferral, retry manually or wait for its normal scheduled sync.
Visibility recovery continues while new queue work waits.

Expose a fixed queue admission reason separately from AI availability and queue
counts. It describes whether **new work can start**, not whether a particular
item failed or how many items are affected. Use a concise, polite status message
without focus changes, raw errors, credentials, titles or per-item alerts.

## Research and alternatives

Sources were discovered through online search and opened on 28 September 2026.

- [Node process memory APIs](https://nodejs.org/download/release/v24.1.0/docs/api/process.html)
  distinguish memory available to the process from total host memory. These APIs
  are supported by the platform's Node 24 runtime.
- [libuv memory APIs](https://docs.libuv.org/en/v1.x/misc.html) account for Linux
  cgroup limits when reporting available memory. A constrained-memory value of
  zero is not itself a zero-byte budget; use total memory as the fallback limit.
- [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints)
  explain CPU and memory controls. Keep the container hard limit as the final
  safety boundary; cooperative application admission cannot prevent every OOM.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  support programmatic waiting/progress announcements without moving focus.

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Raise heap or worker limits | Higher possible throughput | More contention; no coordination | Reject |
| Shared admission over existing workers | Bounded state; automatic retry; no new infrastructure | Conservative throughput; estimates need calibration | Implement |
| Dedicated distributed worker budget | Coordinates separate Node processes | New leases, recovery and deployment complexity | Defer until multi-worker need is demonstrated |
| CPU-sensitive adaptive concurrency | Could reduce sustained event-loop contention | Needs measured thresholds; short CPU bursts are not overload | Measure first |

Recommended stack: existing durable queues and PostgreSQL ownership → shared
cgroup-aware memory admission → current readiness/retry logic → fixed, accessible
waiting status → container hard limit. This is not a global process supervisor:
other Node processes, PostgreSQL and unrelated containers do not reserve tokens.
Their memory consumption is observed only through OS telemetry. CPU and PID
limits remain unchanged; no claim of CPU isolation or a proven leak fix is made.

## Acceptance and next step

Require tests for competing classes, pressure/unknown telemetry, recovery,
hysteresis, ownership/dequeue failures, empty queue, cancellation and release
after task rejection. Exercise movie/TV and fresh-install recovery through the
existing isolated test paths. Record actual outcomes in a separate validation
document; do not treat synthetic reservations as a memory benchmark.

Next: a sustained mixed ingestion/backfill/evaluation load study, recording peak
RSS/cgroup memory, event-loop delay, queue latency and recovery time. Use those
measurements to calibrate reservations and decide whether CPU quotas or adaptive
concurrency are justified. Do not add another scheduler merely to observe this.
