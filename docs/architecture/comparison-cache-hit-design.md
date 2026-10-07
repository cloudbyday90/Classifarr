# Streamed comparison cache-hit revalidation

## Decision — 2026-10-06

Use the existing bounded verification reader before materializing vectors when a
live, cacheable model exists. The preceding [GC/pool study](comparison-gc-pool-outcome.md)
found a warm refresh still constructing the complete vector snapshot even though
the model was reused. This change removes that unnecessary allocation path; it
does not claim to eliminate all retained memory or fix incomplete vector caches.

## Contract

- A cold, expired, disabled, revision-invalidated or degraded model does not take
  the extra probe. Cold fitting retains its existing full read and fresh verification.
- A warm probe uses `readVerification`: complete cache coverage, exact canonical
  fingerprint, bounded vector batches and a read-only repeatable-read transaction.
  It does not trust counts, elapsed time or a revision number instead of the vectors.
- Check cancellation and source state after the probe. Recheck the model cache's
  TTL when selecting the matching fingerprint. A valid miss falls back to the
  full snapshot and normal fitting; a failed probe does not fall back.
- Release the probe metadata's scope before fitting or the second verification.
  Do not retain the old source or training vectors in the candidate result.
- Even a hit must pass a second independent verification transaction, provider
  identity verification, final configuration/busy/revision checks and publication
  admission. Only then return `revalidated` and renew the existing cache entry.
- Changed fingerprints/configuration/revisions return `invalidated`; cancellation
  or shutdown returns `cancelled`; resource refusals retain bounded deferral;
  incomplete/invalid sources and unknown errors retain sanitized failure codes,
  stage attribution and existing backoff. No new retries or durable state.

The existing single active refresh, shared discovery admission/ownership lock,
360-second attempt deadline, 90-second transaction bound, statement/lock limits,
one-entry 256 MiB accounting budget and ten-minute TTL remain unchanged. Restart
starts cold. No provider calls enter database transactions. No inventory,
credential, migration, schema, deployment-template or HTTP/UI contract changes.
Optional comparison availability still cannot hold import/metadata recovery open.

## Official research

Retrieved through search and opened on 2026-10-06:

- PostgreSQL documents that successive queries in repeatable read share one
  stable snapshot. Therefore two separately started transactions are still needed
  to observe intervening committed changes; one transaction reused twice would
  not be an equivalent verification. [Transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).
- Node's diagnostic guide demonstrates bounding accumulated data to reduce heap
  pressure and using GC traces to distinguish allocation from collection. Apply
  that principle to the existing batch reader, then measure complete cycles.
  [GC tracing guide](https://github.com/nodejs/learn/blob/main/pages/diagnostics/memory/using-gc-traces.md).

## Options and recommendation stack

1. **Warm-only streamed probe — selected.** Removes the full vector map on hits
   without weakening freshness checks. Costs an extra read on a warm miss and
   still allocates corpus metadata and decoded transport batches.
2. **Keep full reads.** Simpler and no miss penalty, but repeats avoidable large
   allocations every unchanged refresh; this is the measured opportunity.
3. **Skip the second verification/use revision-only identity — rejected.** Less
   work, but misses concurrent vector changes or incomplete caches.
4. **Force GC or relax memory admission — rejected.** Does not remove allocation
   work and changes safety/latency behavior without evidence.

Prove hit/miss/expiry/degraded paths, cancellation, both validation boundaries,
configuration/provider/revision races and metadata lifetimes. Retain real
PostgreSQL snapshot-race tests and add warm refresh coverage. Rebuild the local
image without cache, run the isolated multi-cycle catalog study, then evaluate
the authorized local test deployment. Do not touch Unraid or shared Plex data.

## Separate PR trial

Fresh open PR enumeration returned #555 and #556; random selection chose
[client Node declarations #555](https://github.com/cloudbyday90/Classifarr/pull/555),
head `5545605b53c854de8847b44e24fa083ff4218080`. Trial its exact manifest/lock
changes locally against the unchanged runtime-major gate. Node 26 declarations
must not be retained for a Node 24 deployment if that gate rejects them. Do not
merge, relax the assertion or install an incompatible major to make it pass.

## Deferred

Measure remaining metadata/batch allocations and natural idle retention before
choosing another memory fix. Keep allocator tuning, forced GC and broader
dependency upgrades separate. Observed results belong in the outcome document.
