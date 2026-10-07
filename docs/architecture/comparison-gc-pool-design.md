# Comparison GC page-pool attribution

Date: 2026-10-06 local / October 7 UTC. Follows the
[resource-retry outcome](comparison-resource-retry-outcome.md).

## Evidence and question

The prior same-catalog study showed 725 MiB anonymous resident memory with 384 MiB
reported committed main V8 heap, zero active workers and collectible sampled
inputs. It later fell naturally to 276 MiB anonymous / 232 MiB committed. LazyFree
was zero in those samples; private dirty memory matched anonymous memory. These
observations do not identify a native allocator leak.

The measured image reports Node 24.21.0 / V8 13.6.233.17-node.53. The exact Node
tag's V8 allocator pools freed regular pages until a memory-reducing collection.
Its ordinary GC trace reports local pooled MiB separately from heap MiB. Hypothesis:
pooled pages explain a substantial part of the gap. Measure this before changing
an allocator, V8 flags, worker lifetime, cache ownership or memory admission.

## Diagnostic contract

Add an opt-in host-runner option for the existing `comparison-catalog` study only.
Enable `--trace-gc --trace-gc-ignore-scavenger` on its isolated Node probe, never the
application entrypoint, startup probes, seed step or deployed Compose. Existing
workers use `execArgv: []`; do not alter them. A real image probe established that
V8 tracing is process-wide and worker events still appear despite that empty list.
Ordinary studies remain unchanged.

Parse only the pinned trace's major-collection numeric fields: event time, used
and committed heap before/after, local pool MiB, pause time and reduce/interleaved
markers. Use bounded opaque numeric source tokens, never raw isolate addresses.
Tokens distinguish addresses, not stable worker identities: worker teardown can
recycle an address. Record backwards source-clock observations explicitly rather
than interpreting them as continuous growth. Do not add the last pool size from
different tokens; some belong to workers that have exited. Associate events with
the previous/next allowlisted study phase in output
order. V8's isolate clock and study elapsed clock have different origins: do not
subtract them or claim atomic synchronization. MiB are rounded upstream; they are
not exact RSS accounting or allocation call stacks. Local pools exclude shared
pool contributions after worker teardown.

Keep raw output transient within the existing 8 MiB command buffer. Persist only
numeric/allowlisted data, never PID, isolate address, arbitrary GC cause, paths,
provider text or raw logs. Bound input, line length, event count and numeric values;
flag missing, malformed, foreign-process or truncated evidence; bound source tokens
to 64 and events to 1024. The parser retains time-reset markers for address reuse.
Save sanitized failure evidence before cleanup. Requested tracing cannot silently
pass with absent/incomplete telemetry. No new dependency, native addon or heap dump.

The study retains its original synthetic catalog, real services/schedules,
2 CPUs, 2 GiB, 128 PIDs, internal network, deadline and completion/revalidation
checks. No competing local builds/tests during observation. No forced GC, memory
pressure injection, cache dropping, changed allocator or weakened safeguard.
Tracing itself adds I/O and may affect timing: this is attribution evidence, not
an uninstrumented performance comparison or release-capacity certification.

Test parsing/sanitization and scoped launch flags first, then run a pinned image
through complete refresh/revalidation. Keep failed runs, validate cleanup, rebuild
local Compose without cache, generate schema in isolation and check independently.
Local testing only; Unraid is untouched. No release, version bump or branch change.

## Official sources and tradeoffs

Sources discovered through web search and GitHub API and retrieved October 7 UTC:

- [Node 24 V8 statistics](https://nodejs.org/docs/latest-v24.x/api/v8.html): heap
  statistics describe V8, not all native allocation; snapshots can amplify memory
  and block execution. Do not force collection to make the result look smaller.
- [Pinned allocator](https://github.com/nodejs/node/blob/v24.21.0/deps/v8/src/heap/memory-allocator.cc)
  distinguishes pooled pages from freed chunks.
- [Pinned heap implementation](https://github.com/nodejs/node/blob/v24.21.0/deps/v8/src/heap/heap.cc)
  releases pooled chunks during memory-reducing GC.
- [Pinned trace implementation](https://github.com/nodejs/node/blob/v24.21.0/deps/v8/src/heap/gc-tracer.cc)
  prints local pooled page MiB; it is version-specific diagnostic output, not a
  stable Node API. Refuse changed formats instead of inferring zero.
- [Linux proc accounting](https://cdn.kernel.org/doc/html/latest/filesystems/proc.html)
  distinguishes anonymous, private dirty and LazyFree pages. Keep kernel counters
  separate from rounded V8 measurements and never subtract them from admission.

| Option | Benefit | Cost / recommendation |
| --- | --- | --- |
| Opt-in major-GC pool trace | Directly tests the pinned runtime's page-pool hypothesis | Version-specific parser and tracing overhead; selected |
| More heap snapshots / forced GC | Detailed JS retaining paths | Sensitive data, pauses, memory amplification and changed behavior; not selected |
| Native allocator replacement or tuning | Might lower RSS | Mechanism not proven and deployment-wide risk; defer |
| Lower memory safeguards | Fewer deferrals | Does not explain residency and weakens safety; reject |

Recommendation stack: attribute page-pool retention; if supported, evaluate
allocation pressure at the responsible refresh stage; otherwise plan a separate
native-allocation profiler on synthetic data. Neither outcome authorizes a runtime
tuning change in this round.

## Random PR trial

Fresh enumeration found open #555 and #556. Random selection chose
[client typings #555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable
head `5545605b53c854de8847b44e24fa083ff4218080`. Trial its exact two-file diff against
the unchanged runtime-major gate, then revert if incompatible. Node 26 declarations
do not justify expanding the pinned Node 24 runtime; no PR merge or automatic major
upgrade. Registry metadata verifies the proposed versions and integrity. Available
postcss/Vite patches remain a separate dependency batch.
