# Comparison refresh phase lifetimes

Date: 2026-10-06. Builds on the [retention findings](comparison-refresh-retention-outcome.md).

## Decision and contract

The five-cycle study found bounded retained caches and exited workers, but high
temporary allocation. The comparison refresher currently keeps its initial
decoded snapshot and borrowed source in the asynchronous scope that also builds
the model and reads the verification snapshot. Shorten those lifetimes first.

Separate reading/validation/ownership from fitting, and fitting from verification.
The read phase returns only a canonical key, a cached model or an owned fitting
input. The build phase returns only the key, built model and reuse indicator.
Neither original snapshots nor owned fitting inputs should remain reachable
through the refresh coordinator when the verification read begins.

- Keep complete-cache preflight, exact vector fingerprints and structural checks.
- Copy new fitting inputs before yielding; never mutate, detach or clear caller
  snapshots. Cache hits still validate exact inputs without an owned vector copy.
- Keep the independent fresh snapshot, provider identity, state/revision and
  publication admission checks. No partial or stale publication is introduced.
- Preserve disabled/empty/error handling, fixed diagnostic stages, cancellation,
  shutdown, one active run, deadlines, jittered retry and cache expiry/weight.
- Preserve all memory safeguards and worker resource limits. No production GC,
  heap dumps, new telemetry endpoint, provider requests or database writes.
- Crashes discard unpublished memory; the existing scheduler retries within its
  bounds. This changes no migrations, ownership fences or persisted cooldowns.

Optional representative observation/recovery hooks retain separate contracts;
they are not refactored in this first lifetime change. Worker serialization,
community scratch buffers and vector transport are deferred until measured.

## Options and recommendation

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Separate phase scopes | Removes unnecessary reachability without numerical changes | More small internal functions; selected |
| Transfer/shared vector buffers | Potentially avoids worker copies | Ownership, detachment and validation redesign; defer |
| Reuse the first snapshot for verification | Avoids a read and allocation | Cannot prove source freshness; reject |
| Raise limits or force GC | May delay admission failures | Hides workload cost or adds pauses; reject |

Recommended stack: unchanged admission → complete scoped read → exact fingerprint
and owned input → bounded fit → independent fresh verification → bounded cache.

## Verification

Add an isolated Node process test using diagnostic-only collection and weak
references: the first snapshot must be collectible during fitting, and the
owned input during the verification read. Repeat for cached revalidation.
Existing mutation, cancellation, source/config/provider changes, cache capacity,
deadline, backoff and diagnostic-stage tests must remain green.

Repeat the existing PostgreSQL-backed synthetic study on fixed baseline and
candidate images: natural and collected five-attempt runs, including changed
sources. Do not equate forced collection with natural timing or require a fixed
RSS reduction in a unit test. Rebuild local Compose without cache, preserve its
data, dump/check schema using isolated candidate databases, and report measured
peaks and remaining deferrals honestly. No Unraid mutation or release.

## Official research

Sources discovered and opened through MCP on October 6, 2026:

- [Node 24 worker threads](https://nodejs.org/download/release/v24.20.0/docs/api/worker_threads.html):
  cloning and transferring have different ownership semantics; moving buffers
  can invalidate other views. Retain the existing owned-copy boundary here.
- [Node garbage-collection diagnostics](https://github.com/nodejs/learn/blob/main/pages/diagnostics/memory/using-gc-traces.md):
  distinguish collection behavior and heap changes from reachable retention.
  Shorter scope permits collection; it does not schedule collection.
- [Node heap-snapshot warning](https://github.com/nodejs/learn/blob/main/pages/diagnostics/memory/using-heap-snapshot.md):
  snapshots can block execution and substantially increase memory. Use isolated
  synthetic aggregate measurements rather than capturing production heaps.

Design recommendations are our application of these sources, not promises from
Node about this workload. Results belong in a separate outcome document.
