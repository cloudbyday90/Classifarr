# Scheduler lifecycle cleanup design

Date: 2026-09-09.

## Evidence and decision

The local event-loop receipt table has seven completed windows, all in the
`under_25ms` p99 bucket. This does not justify collecting database pool-wait
receipts or adding an additional operational data stream.

The scheduler had four direct startup `setTimeout` calls for gap analysis,
library watchdog, library sync, and retry-queue work. Those timers were not in
the scheduler's `initialTaskTimers` map, so `resetState()` could not cancel
them. The local event-loop histogram also had no stop path during a scheduler
reset or controlled process shutdown.

## Design

`schedulerStartupTasks.mjs` contains the four fixed startup task definitions
and registers them only through `scheduleInitial`. This makes reset and
reinitialization cancel every delayed task from one lifecycle map.

`eventLoopDelayObservationScheduler.mjs` gains a guarded stop operation.
`SchedulerService.resetState()` stops cron tasks and pending startup tasks, then
disables local histogram sampling. `runtimeLifecycle.mjs` resets the scheduler
before draining queue work in `SIGTERM` and `SIGINT` handling. A failed reset is
contained so queue and HTTP shutdown still complete.

The change retains only existing fixed event-loop buckets. It adds no library,
provider, configuration, source, policy, AI, decision, or routing data.

## Alternatives

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Keep direct timers | Minimal edits | Timers outlive reset and are hard to reason about | Reject |
| Clear each direct timer independently | Short-term remedy | Future tasks can bypass cleanup again | Reject |
| Centralize delayed tasks in the existing lifecycle map | Cancellable, testable, no new configuration | Small module and tests | Adopt |
| Add pool-wait telemetry now | Could diagnose a future database bottleneck | Measurements do not justify it | Defer |

Node 24 documents `monitorEventLoopDelay` histograms as explicitly enabled and
disabled, and documents signal events for controlled process shutdown. These
support a local start/stop lifecycle rather than a process-global monitor.

Sources: [Node.js performance hooks](https://nodejs.org/download/release/v24.18.1/docs/api/perf_hooks.html),
[Node.js process signals](https://nodejs.org/download/release/v24.18.1/docs/api/process.html),
and [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/).
