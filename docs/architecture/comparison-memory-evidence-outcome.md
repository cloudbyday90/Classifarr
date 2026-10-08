# Comparison memory evidence outcome

Date: 2026-10-08. [Design and source research](comparison-memory-evidence-design.md).

## Implemented

Comparison warnings now carry a diagnostic `memory.reference` shared with the
eventual recovery log, plus per-attempt IDs, timestamps and elapsed time. The
existing database error ID remains unchanged. Evidence distinguishes the exact
admission/checkpoint refusal from later main-thread and process measurements.
The recovery-change skill kept this work separate from policy or data recovery.

The ESM evidence factory retains only three completed-cycle summaries. It samples
at most 16 times per due attempt, without new timers, queries, persistent tables,
heap dumps or forced GC. Warning deduplication, memory requirements, retry delays,
worker termination, cache expiration and ownership remain unchanged. Shared-budget
observations include current cooperative jobs; checkpoint observations do not
invent active-job counts. Cache inspection does not prune or alter LRU order.

Only factory-produced immutable records enter the log boundary. Fixed categories,
numeric fields and generated IDs are allowed; arbitrary worker reports, provider
messages, vectors, source text and configuration are excluded. Missing telemetry
stays null, and observer failures cannot change the work result.

## Reading the next report

1. Copy the normal bug report and find `memory.reference`. Search structured
   application logs for that same value to locate recovery. Identical retries
   remain quiet; recovery includes the number of actual attempts, not timer ticks.
2. Read `decision.phase` and `decision.stage` first. Compare `availableBytes` with
   `requiredBytes`. The latter already includes the applicable reserve, work,
   reservation and recovery-headroom components; do not add those twice.
3. Compare `start`, highest sampled `peak`, `refusedAt` and settled `end`.
   `admission` preserves the earlier shared-budget decision when a running
   checkpoint subsequently fails. Only the decision values explain the threshold
   used at refusal; the other readings are context, not replacements.
4. Inspect `recentCompleted` and the explicit end-to-reference RSS/heap deltas.
   These are the last successful refreshes, **not** idle/post-GC baselines.
   Different workload counts or limits can make cycles non-comparable. An empty
   history means no successful cycle in this runtime, not zero retained memory.
5. Use source counts and estimated cache bytes to scope a follow-up study. RSS
   covers the process, heap/external counters only the main thread. Samples can
   miss peaks between stages; this does not identify individual worker heaps,
   PostgreSQL allocations, native allocators, or a proven leaking object.

Timestamps are epoch milliseconds; byte counters are bytes. The reference changes
after successful recovery and on runtime replacement. Historical warnings cannot
be backfilled with measurements that were never captured. Normal log retention
applies; there is no new unlimited diagnostic store.

## Verification

The broader scoped run passed 31 suites / 465 tests. Three additional
telemetry-failure/not-due regressions subsequently passed in the 10-test evidence
and production-path fixture run. Coverage includes exact admission and hysteresis,
start/running/unknown checkpoint refusal, first-refusal preservation, settled
ownership release, stable recovery references, bounded samples/history, immutable
allowlisting and observer failures. These fixtures use the real admission,
refresh and scheduler code with synthetic repositories; they do not claim a live
Unraid reproduction or database-lock test.

Typecheck, both Knip modes, lint, copyright, Markdown and the unchanged ownership
inventory gate passed. The ownership gate remains a static drift check and does
not assert that every legacy writer is production-compatible. The full backend
suite and new no-cache image evaluation are pending at this implementation checkpoint.

## Recommendation

Keep this bounded evidence enabled and examine the next naturally occurring
pressure report before another allocation change. It offers concrete budget and
cycle context with modest bounded overhead, but cannot prove allocation ownership.
If repeated comparable completed cycles grow, reproduce that workload in the
existing isolated memory study. Do not raise limits or force GC to silence the
warning. No release, PR merge, migration or Unraid deployment is part of this work.
