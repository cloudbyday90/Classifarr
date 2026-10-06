# Comparison resident-memory attribution

Date: 2026-10-06. Follows the [streaming outcome](comparison-stream-verification-outcome.md).

## Decision and safety contract

The previous complete-catalog run deferred comparison with 64 MiB used JavaScript
heap but 661 MiB process RSS and 1078 MiB container usage. Old sampled inputs were
already collectible. This does not identify a leak or justify changing limits.

Extend the existing isolated comparison study, not the production scheduler or
public diagnostics API. At phase boundaries collect bounded, read-only Linux
`smaps_rollup` and cgroup memory statistics. Separate the study process from
PostgreSQL and other processes in its same memory cgroup. Add current-thread and
worker V8 committed-heap measurements to the existing sampler. Preserve stream
verification markers and metadata weak-reference counts through the trace allowlist.

- No new work on fresh installs, disabled services or ordinary production startup.
  Existing isolated synthetic-provider and container-budget prerequisites apply.
- Fixed proc/cgroup paths only; at most 128 processes, 64 KiB per file and a
  250 ms between-read observation budget. Detect PID reuse and membership changes.
  Missing, denied, oversized, malformed or vanished inputs produce explicit
  incomplete telemetry, never invented zero usage or relaxed workload acceptance.
- One observer at a time, phase-boundary process reads only; the existing one-second
  sampler reuses worker heap-stat calls. Record observation duration. No retries,
  persisted state, process signals, database mutations, heap snapshots, forced GC,
  allocator tuning, capability changes, cache dropping or admission changes.
  Concurrent phase callbacks share one observation while retaining their own labels.
- Emit only allowlisted numeric memory totals, counts, fixed groups and statuses.
  Never emit PIDs, addresses, mapping names, command lines, environment, database
  queries, raw errors or raw proc files. No host PID namespace or host mounts.
- Reads are observational, not an atomic cross-process snapshot. Exit/permission
  races are partial evidence, not proof of a zero-memory process. Restart discards
  metrics; cancellation/shutdown and workload deadlines remain as before.
  The process list covers the same memory group, not descendants in other groups.
- Completion means tested parsers/projection and an unchanged full-catalog image
  run with sufficient telemetry to distinguish major contributors. Preserve failed
  receipts. Report missing telemetry and workload failure separately.

## Options and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Bounded proc/cgroup plus V8 attribution | Separates resident, committed, shared and cache memory without payloads | Small observation overhead and platform gaps; selected |
| Heap snapshots | Object-level retaining paths | Pauses, memory amplification and sensitive contents; not needed yet |
| Change allocator or V8 flags | Might reduce resident retention | Causal mechanism unproven; defer |
| Subtract cache or raise admission limits | Fewer deferrals | Weakens the existing safety boundary without evidence; reject |

First repair measurement gaps and test both cgroup versions. Then run the same
2 GiB catalog workload without competing local builds/tests or forced collection.
Choose the next runtime experiment from observed anonymous memory, committed V8
space, external allocations or PostgreSQL/cache contributions. Do not equate RSS
minus used heap with a leak, or add shared RSS totals to container usage.

## Official research

Sources discovered and opened using web search on October 6, 2026:

- [Linux proc accounting](https://cdn.kernel.org/doc/html/latest/filesystems/proc.html):
  rollup reports RSS, proportional shared memory and anonymous/file/shared PSS;
  process-map observations can race. Use proportional totals to avoid counting
  each PostgreSQL shared mapping in full repeatedly.
- [Linux cgroup v1](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v1/memory.html?highlight=swappiness):
  `usage_in_bytes` is approximate; `rss` includes anonymous/swap-cache usage and
  is not process RSS. Keep the original counter names and version in evidence.
- [Linux cgroup v2](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html?highlight=memory.low):
  `memory.stat` separates types and overlapping subcategories; parse by key,
  not position. Shared memory is included in file accounting, not additive.
- [Node memory accounting](https://github.com/nodejs/node/blob/main/doc/api/process.md):
  RSS spans worker threads, while other process-memory fields refer to the current
  thread. Array buffers are included in external memory. Its glibc fragmentation
  note is not a diagnosis for our Alpine/musl image.
- [Node V8 statistics](https://nodejs.org/api/v8.html): committed heap differs from
  used objects; `malloced_memory` describes V8 allocations, not all native memory.
  Use only APIs verified in pinned Node 24.21.0, not newly documented Node 26 APIs.
- [PostgreSQL resource use](https://www.postgresql.org/docs/current/runtime-config-resource.html):
  PostgreSQL uses shared buffers and operating-system cache. No configuration
  change is justified by seeing both in the same container.
- [Definitely Typed version policy](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md):
  declarations target their corresponding library major/minor; a newer declaration
  major is not a routine patch for an older runtime.

## PR trial and validation

Fresh open-PR enumeration found #555 and #556. Random selection again chose
[client typings #555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable
head `5545605b53c854de8847b44e24fa083ff4218080`. Trial its exact manifest/lockfile
diff against the unchanged Node-major gate; revert if incompatible, without an
installation, runtime upgrade or PR merge. Record the result separately.

Test malformed/duplicate/overflow counters, bounded reads, missing permissions,
PID churn, foreign membership, observation limits and sanitization. Run affected
study contracts, backend quality gates, no-cache image build, isolated catalog
study, local recreation and isolated schema dump followed by an independent check.
Keep design separate from [observed outcomes](comparison-resident-memory-outcome.md).
