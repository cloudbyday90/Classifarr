# Completion-driven queue wakeups

## Decision — 28 September 2026

Replace idle-only fixed polling with a bounded, process-local wakeup hint after
durable enqueue and actual task settlement. Retain the one-second polling fallback.
The prior capacity study took 106 seconds to drain after production stopped;
the worker released its slot without notifying its sleeping dispatch loop.
Measure the baseline again before changing runtime code.

## Design and safety boundaries

Use a small ESM service owning one pending bit and at most one cancellable timer.
Clear the pending bit before checking for work, not after an asynchronous dequeue:
a completion during that check must not be lost. Multiple notifications coalesce.
The notification carries no item data, grants no permit and creates no task.

Every awakened iteration repeats concurrency, memory admission, classification
blocker and AI-readiness checks. PostgreSQL remains authoritative for task claims,
priority, retry dates and visibility recovery. External writers and direct bulk
inserts still work through fallback polling; no database connection is added.

Memory refusal and thrown dispatch errors retain their full polling cooldown even if
notifications arrive. The AI-unavailable requeue also retains its cooldown.
Shutdown can cancel any worker sleep. Dispatch continues yielding to the event
loop. Enqueue wakes only after its durable write and existing bookkeeping.
Completion wakes only after processing counters and the memory permit are released.

Serialize worker lifetimes, including startup and immediate stop/start. A newer
stop cancels an earlier queued restart. Do not
reset per-type processing counts merely because the loop stops: in-flight tasks
still consume capacity until settlement. If stopping overlaps dequeue, return the
claimed task to pending without running it. These protections do not redesign
existing visibility-timeout or graceful-shutdown ownership semantics.

TMDb metadata requests already pass through the shared token bucket (40 tokens,
10-second refill interval); preserve that and provider retry handling. Faster
synthetic throughput is not a promise of faster rate-limited provider throughput.
No new concurrency, live limits, schema, API, routing, learning or music support.

## Options and tradeoffs

| Option | Advantage | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Coalesced local hints plus polling | Low latency, constant-size state, no new infrastructure | More concentrated CPU/query work; other processes still wait for polling | Implement with capacity validation |
| Shorten polling globally | Simple | More idle database work, still timing-dependent | Reject |
| PostgreSQL LISTEN/NOTIFY | Cross-process hints after commit | Dedicated session, reconnect and startup races, notification queue management | Defer until measured multi-process need |
| Raise worker concurrency | More parallel work | Changes provider and memory exposure without fixing idle slots | Reject |

## Official research

URLs discovered with online search and checked on 28 September 2026:

- [Node 24 timers](https://nodejs.org/docs/latest-v24.x/api/timers.html): promise timers support
  AbortSignal cancellation; cancellation rejects with AbortError. Use the stable
  API supported by Node 24, not a newer runtime requirement. Cancel and settle the
  timer instead of leaving losing Promise.race timers alive.
- [Node 24 globals](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html):
  AbortController is available without a dependency.
- [TMDb rate limiting](https://developer.themoviedb.org/docs/rate-limiting):
  respect 429 responses and changing provider limits; do not turn queue latency
  improvements into bypasses of request admission.
- [PostgreSQL NOTIFY](https://www.postgresql.org/docs/17/sql-notify.html):
  notifications are transaction-aware hints, with queue and listener lifecycle
  constraints. They are not a substitute for durable task state.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  avoid unnecessarily chatty status announcements. No per-wakeup alerts or UI
  changes are needed; preserve existing accessible aggregate status.

## Acceptance and recommendation stack

1. Test wake-before-wait, wake-during-wait, bursts, idle fallback, cancellation,
   pressure/error cooldowns, enqueue failures, duplicate starts and stop/start.
2. Reuse the real-service isolated smoke/capacity gate to prove queued pressure
   recovery, no premature/duplicate dispatch, full backfill and zero leaked permits.
3. Compare drain, backlog, CPU, memory and event-loop delay using unchanged
   synthetic profiles and limits. Report shared-host and synthetic-provider limits.
4. Keep production resource settings unchanged. Evaluate explicit CPU/PID budgets
   separately only after confirming queue throughput and recovery safety.

See the [separate validation outcome](queue-completion-wakeups-validation.md)
for measured results and limitations.
