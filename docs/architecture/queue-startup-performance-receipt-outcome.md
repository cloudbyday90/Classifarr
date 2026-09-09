# Queue startup performance receipt outcome

## Implemented outcome

The queue worker health check and metadata-refill reader now publish passive
aggregate observations to a one-minute coalescing recorder. The recorder writes
only fixed performance buckets to `queue_startup_performance_receipts` and
never waits on the active read or queue operation.

The receipt table has a fixed composite primary key and database constraints for
its operation and bucket vocabulary. It contains no raw query, query result,
media, library, provider, configuration, policy, AI, route, actor, or error
data. `buffer_bucket = not_sampled` states that runtime reads do not execute
an intrusive PostgreSQL plan probe.

All implementation code is native ES Module code. No dependency, endpoint,
configuration input, UI action, classifier input, semantic selection, label,
policy change, or automatic routing was added.

## Verification

- Contract, repository, coalescing, failure containment, queue refill, and
  queue worker checks passed: 4 suites and 117 tests.
- The existing queue health response remains unchanged while its new receipt is
  emitted through an injected recorder in the isolated test; a throwing
  optional recorder also leaves the health result connected.
- Refill receipt tests confirm only operation, elapsed duration, page scan
  count, and candidate count reach the recorder; item and metadata fields do
  not.

## Recommendation stack

1. Retain the fixed receipt schema and bounded coalescing interval.
2. Treat `not_sampled` as an honest absence of buffer data. Use manual,
   maintenance-time `EXPLAIN (ANALYZE, BUFFERS)` only after an aggregate signal
   warrants it.
3. Keep the receipt read-only with respect to platform behavior; it must never
   become a classifier, policy, provider, or routing input.
4. If shown in the interface, add a server-owned, administrator-authenticated,
   fixed-window summary with an accessible status message.

## Next item

After receipts have accumulated across ordinary startup and refill activity,
add a bounded, administrator-authenticated summary that returns only the fixed
bucket counters and latest observation time. It should use a fixed window and
allow-list its response. It must not expose SQL, exact timings, query plans,
media, libraries, providers, configurations, policies, AI data, or routing
controls, and it must not trigger any work.
