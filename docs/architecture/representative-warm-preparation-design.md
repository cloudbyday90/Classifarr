# Bounded warm representative preparation

Design date: 2026-10-07. Follows the measured first-read allocation in the
[consumer profiling outcome](comparison-consumer-profile-outcome.md).

## Decision and contract

Keep full fitting reads for cold or changed models. When a cached model exists,
probe its source using the existing streamed v4 fingerprint. Collect only the
present-hash set, not a complete vector map. Only an exact source/config match
may reuse the model. Validate its header, coverage, membership and numeric
structure again; validate recovery centroids from bounded vector batches in the
same read-only repeatable-read transaction. Preserve membership summation order
and tolerances. Missing vectors still mean partial coverage; malformed present
vectors, including unused ones, remain errors.

A transaction-scoped preparation callback receives fresh novelty/readiness
metadata and a bounded, corpus-scoped reader. The reader expires when preparation
ends and allows no SQL injection, writes, provider calls or fitting. Consumers
stage results only. Their synchronous commit still waits for the existing second,
independent transaction, provider identity check, state/revision checks and final
admission checkpoint. A cache miss closes the probe before the ordinary full
read/fit; this costs an extra scan for changed sources. No new HTTP contract,
migration, deployment option, ownership authority or routing behavior.

Coverage has an explicit present-hash input: do not fabricate vectors to satisfy
the old full-snapshot contract. Geometry reads use at most 256 vectors and
262,144 components per batch. One group sum and one decoded batch are live at a
time, rather than all source vectors. Existing corpus, library, component, cache,
TTL, concurrency, 120-second refresh and database timeouts stay unchanged.

## Failure and completion

Disabled/unsupported/busy/not-due work retains its no-op behavior. Cancellation
or stop prevents publication and expires the scoped reader. Source/config/revision
drift invalidates staging; restarts discard process-local caches and take the cold
path. Known malformed geometry uses the existing redacted diagnostic/backoff.
Database/unknown errors during streamed recovery abort this attempt rather than
publishing incomplete preparation. Subsequent scheduled retries use the existing
budgets; no counter resets, forced GC or relaxed memory admission.

Completion means a verified model and staged optional consumers published together
after fresh checks, not completion of import/backfill. Optional AI does not hold
import-plus-metadata recovery open. No live Unraid recovery is part of this work.

## Research and tradeoffs

Official sources discovered and opened through web search on 2026-10-07:

- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html):
  repeatable read gives successive queries a consistent snapshot; independent
  verification must use a new transaction to observe later commits. It is not an
  ownership or security boundary.
- [Node 24 process memory](https://nodejs.org/docs/latest-v24.x/api/process.html): RSS is process-wide,
  while worker heap readings are thread-local. Compare like-for-like boundaries;
  endpoint deltas are not allocation totals or proof of a leak.

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Stream warm preparation and geometry | Avoids the full retained vector map; preserves validation | Extra bounded geometry reads and a cache-miss probe; implement and measure |
| Trust cached model without revalidation | Less work | Misses cached corruption; reject |
| Raise limits or force production GC | Could admit more attempts | Changes safeguards/latency without fixing allocation; reject |

Recommendation stack: regression/differential tests; real PostgreSQL snapshot and
rollback tests; exact-image full-cycle consumer profiling; then local rebuild
evaluation. Retain only evidence-backed improvements. Next investigate remaining
allocations only after warm-path measurements; keep patch dependencies separate.

## Random PR trial

Fresh enumeration found #555 and #556; random selection chose client
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable head
`5545605b53c854de8847b44e24fa083ff4218080`. Trial its exact declaration/lock diff
against the runtime compatibility gate before installing. Do not merge or broaden
this round to a Node major upgrade if Node 26 declarations fail the Node 24 gate.
