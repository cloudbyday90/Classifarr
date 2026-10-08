# Comparison memory-pressure evidence

Date: 2026-10-08. Scope: diagnostic context, not a memory-policy change.

## Problem and contract

The October 8 warning recovered after three minutes, but its host-memory snapshot
does not preserve the container-aware decision that deferred comparison work.
Future warnings must explain the refusal and provide a reference point without
claiming that coincident work caused an allocation or that rising RSS proves a leak.

For an enabled, due comparison refresh, capture bounded numeric observations at
existing stage boundaries. Keep the start, highest sampled RSS and settled end,
plus the last three successfully completed refresh summaries. The latest successful
end is a reference, not an idle or post-GC baseline. Unknown readings remain null.
No collection occurs for disabled, not-due or already-running work.

Include aggregate source counts for full snapshot reads (libraries, documents,
vectors and vector dimensions); leave them absent for admission refusal or cached
revalidation instead of re-reading data just for diagnostics. Stage readings are
taken at entry to the named stage; their association is not proof of allocation
ownership. Only main-thread heap counters and process-wide RSS are measured.

At shared admission or the discovery start/running checkpoint, preserve the exact
available, required, reserve, reservation, work and hysteresis bytes used by that
decision. Include its fixed phase and the active cooperative work counts where
available. Capture the first refusal, before cancellation releases reservations.
Do not substitute later process readings for the decision-time budget.

Use a random diagnostic reference shared by the initial pressure warning, repeated
attempts and eventual ready/revalidated recovery. Each sampled attempt also has
its own ID and timestamp. Existing warning-state deduplication stays unchanged;
IDs and counters must not turn each retry into another warning. Recovery carries
the reference and latest measurements in the ordinary structured application log.
Warning metadata remains available in the existing copied bug report. Restart
starts new references; old persisted logs remain the historical evidence.

## Boundaries and safety

Use small ESM factories and allowlisted projections at the logging boundary. Keep
only scalar values, fixed categories and bounded summaries; never retain snapshots,
models, exceptions, providers, request bodies or credentials. Limit stage sampling
to 16 observations per actual attempt; add no timer, background job or database
table. Cache accounting is an estimate and a read-only observation, not a heap size.
Telemetry exceptions must not change admission, release, cancellation or serving.

Keep thresholds, hysteresis, concurrency, 250 ms pressure checks, deadlines,
cooldowns, fencing, cache limits and TTL unchanged. Cancelled/unavailable attempts
do not become successful baselines; only ready/revalidated results close a pressure
episode. Diagnostics do not authorize recovery of any other subsystem or Unraid
deployment. There are no external writes to retry and no schema migration.

## Research and recommendation

Official sources found through web search and opened on 2026-10-08:

- [Node process memory APIs](https://nodejs.org/api/process.html): available memory
  is a process/OS constraint measurement; RSS spans the process, while heap and
  external counters describe the calling thread. Report separate measurements;
  never sum overlapping counters or label main-thread heap as all worker heaps.
- [Node heap-snapshot guidance](https://github.com/nodejs/learn/blob/main/pages/diagnostics/memory/using-heap-snapshot.md):
  snapshots can double heap requirements and interrupt execution. Do not trigger
  them automatically during pressure.

Recommended stack: exact admission evidence, bounded phase measurements and a
completed-cycle reference, then targeted isolated profiling if repeated reports
show unexplained growth. This adds small bounded observation overhead and cannot
identify individual allocating objects, native memory owners or all concurrent
processes. Automatic heap dumps offer deeper attribution but risk capacity and
data exposure. Increasing limits or forcing GC would obscure the evidence and is
not recommended without a demonstrated cause.

## Acceptance

Prove exact threshold/hysteresis values, refusal stage, stable references through
retry/recovery, reference reset after recovery/restart, bounded retained history,
sanitization, missing/throwing telemetry, and unchanged release/cancellation.
Exercise the production admission-to-refresh-to-log path with deterministic
fixtures, then run backend gates and a no-cache local-image health check. Local
startup is not a memory-retention benchmark or proof of Unraid behavior.
