# Optional startup telemetry: independent lifecycle

Date: 2026-09-30. Scope: anonymous queue startup performance receipts only.

## Problem and decision

The [reproduced defect](startup-telemetry-lock-scope-follow-up.md) is an ownership
lifetime mismatch: a delayed metrics timer inherits an ingestion advisory-lock
context that has closed by the time it writes. The database correctly refuses the
late query. Do not weaken that refusal or manufacture historical ownership.

Create the receipt service's `AsyncResource` during normal bootstrap, before
queue/request work begins. Both timer creation and manual flush execute in this
captured startup context. The context runner remains private: callers can record
fixed observations, flush or stop, but cannot supply SQL or callbacks to run in it.
The factory must not be constructed inside an ingestion/request scope. A negative
test demonstrates that mistaken construction retains the guard and fails closed;
it does not silently clear the captured lock.

The existing receipt contract and parameterized repository stay separate. A small
diagnostic module contains only safe error categorization and best-effort logging.
No generic database escape hatch, new connection pool, schema migration, API,
provider call, worker thread, dependency or configuration setting is added.

## Resource and failure contract

- No interval or query starts at construction. First observation schedules one
  unreferenced 60-second timer; idle services do no work.
- Six duration buckets, five-by-five refill count buckets and six health buckets
  yield at most 156 keys per pending map or detached batch (312 combined while a
  batch is active). Values are anonymous counts, saturated at the safe integer
  limit; input objects, media, credentials and query text are not retained.
- One in-flight flush promise serializes all automatic/manual calls. New records
  coalesce separately and receive a new delayed timer only after that batch ends.
  The writer issues at most one SQL statement at a time, using existing database
  connection and statement timeouts. No tight drain loop or duplicate batch replay.
- On the first persistence failure, drop that ambiguous receipt and the rest of
  its batch; emit one warning, not one per key. Future independent observations
  may try again after the normal delay. A failure may have occurred after commit,
  so replaying an increment could double-count it.
- Warnings expose fixed categories and explicitly allowed SQLSTATE/transport
  codes, never raw error details. Logger throws/rejections are contained;
  `skipDbPersist` prevents recursive database logging.
- `stop()` is terminal and idempotent. SIGTERM/SIGINT call it before queue shutdown:
  cancel the timer, discard pending optional counts and refuse new observations.
  An issued query may settle; no subsequent batch query starts. Destroy the async
  resource once that in-flight batch settles, or immediately if none exists.
  Shutdown does not wait for metrics or start a last-minute flush.
- `flush()` returns the detached observations, not a durable-delivery receipt.
  These aggregates are deliberately lossy under failure/shutdown. They cannot be
  used as billing, correctness, accuracy or ownership evidence.

## Official research and tradeoffs

Sources discovered through online search and official documentation links, then
read on September 30, 2026:

- Node documents asynchronous store propagation, context capture at resource
  construction, `runInAsyncScope` and destruction. Use APIs available in the
  deployed Node 24.18.1; do not use the newer experimental `withScope` API exposed
  by the current 24.x documentation.
  [Node asynchronous context](https://nodejs.org/docs/latest-v24.x/api/async_context.html).
- `unref()` lets an otherwise idle process exit; timers are scheduling thresholds,
  not exact execution deadlines. Cancellation and a terminal service state are
  still needed for shutdown.
  [Node timers](https://nodejs.org/docs/latest-v24.x/api/timers.html).
- W3C status messages should be programmatically available without moving focus.
  This backend-only change adds no UI notification, chart or conformance claim.
  Any later telemetry UI should label incomplete measurements, not present them
  as a success percentage or continuously announce background counters.
  [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Inline persistence under import lock | Simple lifetime | Adds optional database latency to import; not selected |
| Startup-owned, bounded writer | Independent lifecycle, no new infrastructure | Lossy counts and explicit construction/shutdown contract; selected |
| Durable outbox or separate telemetry worker | Can support stronger delivery semantics | Additional writes, recovery and operational cost for anonymous metrics; unnecessary here |
| Disable ownership checks | Suppresses this warning | Permits unsafe late inventory writes; rejected |

## Final recommendation stack

1. Ship the narrow ESM lifecycle fix with real PostgreSQL and negative ownership
   tests; retain the current receipt schema and failure isolation.
2. At the next authorized image rebuild, observe a real refill and its delayed
   receipt, checking count advancement and sanitized warnings. Unit/integration
   success alone is not evidence about an unchanged running image.
3. Resume the [embedded credential/OS isolation milestone](schema-maintenance-boundary-design.md):
   rehearse restricted runtime login, privileged maintenance/restore handoff and
   ordered PostgreSQL shutdown in a disposable container. Complete writer fencing
   before any automatic legacy ingestion recovery.

See the separate [implementation outcome](startup-telemetry-lifecycle-outcome.md).
