# Completed refresh-cycle memory evidence

Date: October 12, 2026. Offline diagnostics on main; no release.

## Decision and contract

Extend the existing synthetic shared-catalog study, not production telemetry or
another database singleton. Earlier profiles already observe workers, weak
references and natural post-stop GC. Their missing comparison is explicit cache
occupancy beside each completed refresh and the same measurements after stop.

Record only successful comparison/representative attempts, their elapsed time,
existing numeric memory/reference samples, and both caches' entry counts and
estimated weights. Cache inspection must not prune, touch LRU or refresh TTL.
At most 120 observations; copy allowlisted scalars, never snapshots, vectors,
keys, titles, provider data or errors. Require one-to-one correspondence with
successful attempts, correct worker/status pairing, ordered timestamps and
cleared caches/no active workers after stop. Missing evidence fails the study.
Version the catalog receipt so older receipts cannot satisfy this contract.

Keep the real five-minute revalidation intervals, 25-minute workload deadline,
production admission/cooldowns, cache capacities and worker deadlines. Reuse the
bounded natural-major-GC and two-minute idle observation. No forced GC, heap
dump, inspector endpoint, V8 flag change or increased application limit.
No application startup work, migration, API, UI or durable retry state changes.
Unknown errors/cancellation fail the measurement and clean up the owned fixture;
a restart starts a new synthetic database, never resets live recovery state.

Use the existing isolated image runner: generated project/volume, no live
credentials or mounts, network isolation, fixed resource limits, source/image
identity and independent cleanup. Real PostgreSQL, refresh builders, worker
threads and consumers run; synthetic transport is not Plex/Ollama traffic.
Complete means publication plus real-time revalidation for both refreshers and
validated cache/worker shutdown. Natural GC may not occur in its bounded window;
report that absence rather than forcing collection or declaring a leak.

## Interpretation and alternatives

| Option | Pro | Con | Decision |
| --- | --- | --- | --- |
| Completion samples with cache occupancy | Comparable lifecycle checkpoints, little extra work | Samples are not exhaustive retention paths | Implement |
| Heap snapshots on Unraid | Detailed object retainers | Pauses work, can double heap, contains private data | Do not run |
| Raise limits or force GC | May hide visible deferral | Changes the phenomenon being measured | Reject |
| Extend synthetic season-mapping distribution | More representative catalog projection | Separate fixture/correctness changes | Next bounded workload extension |

Recommendation stack: verify diagnostic bounds → measure completed refreshes and
cache shutdown → correlate natural collection/residency → choose only a reproduced
fix. Cache weight is an estimate, not heap bytes. RSS is process-wide; other Node
memory values describe the main thread. ArrayBuffers are included in external
memory, not additive. Weak-reference survival before collection proves neither
a leak nor a release failure. Do not equate fixture health with a production fix.

## Official sources

Discovered and opened through MCP on October 12, 2026:

- [Node process memory](https://nodejs.org/api/process.html): memory categories,
  worker scope and sampling overhead. Living docs currently describe Node 26;
  exercised APIs are already present in pinned Node 24.21.0.
- [Node heap snapshot guidance](https://github.com/nodejs/learn/blob/main/pages/diagnostics/memory/using-heap-snapshot.md):
  stop-the-world and additional-memory risks; snapshots are excluded here.
- [Node GC trace guidance](https://github.com/nodejs/learn/blob/main/pages/diagnostics/memory/using-gc-traces.md):
  distinguish allocation pressure and collection activity when interpreting use.
- [V8 weak references](https://v8.dev/features/weak-references): unspecified
  collection timing and subtle closure reachability; observations do not own data.

## Random PR trial

Fresh enumeration found open #556 and #558. A cryptographic random draw selected
[#558](https://github.com/cloudbyday90/Classifarr/pull/558), exact head
`e8a7ee2e490e5437375aa3a4628943657fa1783e`. Apply its client manifest/lock patch
locally: Node types 24.19.2 → 26.6.4 and undici-types 7.24.6 → 8.9.0. Registry
integrity matches and no install scripts are added. Test strict installation,
dependency tree, full audit, tooling and client typechecks. Revert the trial if
the existing Node-major contract rejects it; do not weaken that contract, merge
the PR or upgrade the runtime. The [DefinitelyTyped version policy](https://github.com/Definitelytyped/DefinitelyTyped)
aligns declaration versions with the represented library.
