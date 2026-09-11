# Automatic inventory description refresh

## Purpose and previous-commit review

Commit `6405f480` introduced independently retrieved inventory descriptions and
a resumable, representation-scoped vector cache. It did not refresh that cache
automatically. Its command also runs a historical comparison sampler, which is
unnecessary background work. This component maintains the description cache
without user declarations, manual rebuilds, or new review screens. Live routing
and policy thresholds remain unchanged.

## Options and recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Embed during library sync | Immediate freshness | Slows sync; provider errors couple unrelated work | Reject |
| Durable per-item outbox | Efficient very large inventories | New schema and hooks for every metadata writer | Defer until measured need |
| Bounded background reconciliation | Recovers after restart; includes all current writers | Reads a bounded corpus periodically; eventual freshness | Implement |

Recommended stack: existing scheduler, current-inventory projection, hash-only
cache lookup, shared verified batch writer, saved local Ollama configuration,
and the existing PostgreSQL session advisory lock. No new dependency or schema.

## Behavior

- Register a one-minute scheduler tick and delayed startup catch-up. Successful
  library sync requests refresh on the next tick. The signal is only a hint;
  five-minute reconciliation covers other processes, enrichment, deletion,
  configuration changes, missed signals, and failed/partial syncs.
- Reuse projection/model/digest/dimension/content keys. Read only hashes during
  maintenance, not every stored vector. Never run the historical sampler.
- Generate at most 64 new descriptions per pass in sequential batches of eight.
  Persist each verified batch so interruption does not lose completed work.
- Skip the latest sync per library when it is running, and pending/processing
  task-queue work that is ready to run (not future retries). Match the existing queue read model's latest-sync semantics:
  superseded historical running rows must not block maintenance indefinitely.
  Recheck admission and
  effective saved provider configuration before each batch and before writing it.
  This is cooperative priority, not provider-wide preemption: a request already
  admitted can overlap newly arriving foreground work until its bounded timeout.
- Use the same database lock as the manual retrieval command. Do not hold a
  transaction open during inference. Snapshot SQL has local timeouts; provider
  requests retain their 60-second timeout; each refresh has a two-minute deadline.
- Shutdown aborts in-flight requests. Provider/database failures use bounded
  exponential cooldown, never a tight retry loop. Cooldown and sync hints are
  process-local; valid cache checkpoints survive restarts.
- Delete at most 1,000 expired cache rows per pass, even when RAG is disabled.
  Expired entries cannot be reused. Physical cleanup is eventual while running.
- Preserve current corpus limits and conflicted-membership exclusion. Deleted
  inventory items cannot become candidates merely because their hash remains in
  the cache. The cache contains vectors/hashes, not membership or plaintext.

## Security and user experience

Only an already configured, enabled, trusted local Ollama embedding endpoint is
eligible. No cloud fallback, automatic model download, new credential access, or
provider-setting mutation is introduced. Descriptions are data, never executable
instructions. Logs contain fixed statuses and aggregate counts, not descriptions,
identifiers, endpoints, configuration, or raw errors in this worker. Background failure cannot
turn a recommendation into an automatic route.

No new UI is warranted for routine maintenance. A future existing Command Center
summary can say “Library understanding is up to date” or report an actionable
failure; detailed evidence stays collapsed. Avoid per-batch toasts, focus changes,
or repeated screen-reader announcements. This backend change does not claim a
new WCAG conformance assessment.

## Official research and date boundary

Requested baseline: August 2026. Sources were discovered with web tools and read
on September 11, 2026. They are living documentation, not verified August archive
snapshots. The design uses established behavior, not a claim about exact historic
page contents or newer version features.

- [PostgreSQL advisory locks](https://www.postgresql.org/docs/17/explicit-locking.html):
  session locks persist outside transactions and require explicit release or
  session termination. Reuse the existing dedicated-session helper rather than
  retaining a transaction across network inference.
- [Ollama concurrency guidance](https://docs.ollama.com/faq): parallel models and
  requests depend on memory, and overload can queue or reject requests. Small,
  sequential batches and cooperative backpressure protect foreground work.
- [Node 24 timers](https://nodejs.org/docs/latest-v24.x/api/timers.html): timers
  are lifecycle resources and can keep the event loop alive. Reuse scheduler
  registration and cleanup rather than adding an unmanaged polling timer.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages):
  displayed status changes need accessible semantics, but applications need not
  create extra messages; overly chatty live regions should be avoided.

## Verification and next boundary

Test incremental reuse, changed/deleted content, sync hints, restart catch-up,
foreground yield, provider disable/change, representation drift, backoff,
concurrent command/worker exclusion, cancellation, and private-data omission.
Run real PostgreSQL cache tests and a local Compose refresh without routing media.
The outcome is recorded separately in `inventory-description-refresh-outcome.md`.

Next: consume the maintained description neighbors in the live candidate
comparison path, with item identity and media-type constraints and explicit
handling of contrary examples. Freshness alone is not classification accuracy.
