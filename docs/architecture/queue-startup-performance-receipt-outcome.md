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

The recommended passive database-health summary is implemented separately in
[the database-health summary outcome](database-health-summary-outcome.md). Its
next item is a server-owned, reset-aware bucket-transition receipt, only if
ordinary observations show a persistent trend. It must retain no raw values or
source dimensions and cannot trigger maintenance, policy, AI, or routing work.
