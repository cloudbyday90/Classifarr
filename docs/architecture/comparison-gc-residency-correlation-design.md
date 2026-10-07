# Comparison GC and residency correlation

Date: 2026-10-07. Diagnostic-only follow-up; no release or production policy change.

## Question and decision

The previous quiet-window observation released about 457 MiB of process RSS
between its 90- and 120-second samples. Sampled objects had already been collected
and all workers had exited. Determine whether additional natural major collections
and changes in V8's reported local page pool accompany that drop.

Combine the existing major-GC trace and post-stop observation modes. Add a small
ESM host-side correlation module and a named CLI entry point, not another runtime
observer. Match adjacent quiet samples to GC output-order brackets. Do not compare
worker GC clocks directly with the study clock or call correlation causation.

## Safety and completion contract

- Explicit opt-in isolated synthetic catalog only; existing 2 CPU, 2 GiB, 128 PID,
  internal-network, resource admission and timeout limits remain unchanged.
- Existing five-minute natural-GC deadline and two-minute quiet window remain.
  No forced GC, allocation sampling, allocator flags, public API or production
  scheduler/cache change. No fresh-install or restart behavior changes.
- Reuse the bounded trace parser: 8 MiB output, 1,024 events, 64 anonymized sources;
  never save raw addresses, process IDs, provider content or free-text GC causes.
- Correlate four adjacent intervals only. Require five valid quiet samples,
  complete GC parsing and exact phase/time brackets. Missing mappings, ambiguous
  sources, clock resets or mismatched brackets produce an explicit unavailable
  result, not zero-pool evidence or a leak verdict.
- Emit fixed numeric RSS, heap, anonymous-mapping and small-mapping deltas,
  collection counts and first/last reported local pool sizes. An interval with no
  collection has null pool readings; GC's pool reading is not pre-GC memory.
- Keep workload completion, natural pressure recovery, GC observation and
  correlation availability separate. No mutation/retry or live recovery is added.
- Verify parser/privacy/refusal cases and combined launcher behavior, then measure
  the full exact-image workload. Preserve rollback before building, rebuild local
  Compose without cache, generate schema only from disposable containers and
  record local health separately. Unraid remains untouched.

## Official research and options

Sources discovered/retrieved through web search and GitHub MCP on 2026-10-07:

- [Node's GC tracing guide](https://github.com/nodejs/learn/blob/main/pages/diagnostics/memory/using-gc-traces.md)
  explains trace fields and performance hooks. Text traces add instrumentation;
  they are not a substitute for matched uninstrumented performance measurements.
- The pinned [Node 24.21.0 V8 memory reducer](https://github.com/nodejs/node/blob/v24.21.0/deps/v8/src/heap/memory-reducer.cc)
  schedules memory-reducing collections, with a 100-second watchdog among its
  conditions. Timing similarity is a hypothesis, not evidence that it caused this
  application's observed drop.
- The pinned [V8 page pool](https://github.com/nodejs/node/blob/v24.21.0/deps/v8/src/heap/page-pool.cc)
  distinguishes local and shared pools; worker teardown can schedule shared-page
  release after eight seconds. Do not equate a local `pooled` trace field with all
  process memory or infer a worker leak from a later RSS sample.
- The pinned [major-collection implementation](https://github.com/nodejs/node/blob/v24.21.0/deps/v8/src/heap/heap.cc)
  explicitly releases local pooled chunks during memory-reducing collections.
  The [GC trace implementation](https://github.com/nodejs/node/blob/v24.21.0/deps/v8/src/heap/gc-tracer.cc)
  reports the isolate-relative clock and rounded local pool size via the
  [allocator](https://github.com/nodejs/node/blob/v24.21.0/deps/v8/src/heap/memory-allocator.cc).
  This provides a mechanism to test, not proof of ownership of an OS mapping.

| Option | Benefit | Cost / limitation | Recommendation |
| --- | --- | --- | --- |
| Existing GC trace plus quiet mappings | Tests a specific delayed-reclamation hypothesis | Instrumented, coarse output brackets; no allocator ownership proof | First |
| Native allocator/reducer instrumentation | More direct attribution if correlation is insufficient | Additional tooling, runtime sensitivity and overhead | Only if needed |
| Force GC, purge caches or replace allocator | Could lower one reading | Changes behavior before the cause is established | Reject |

Randomly selected open PR #555 proposes client Node-26 typings on a Node-24
runtime. Trial its exact diff against the existing runtime gate; retain neither
an incompatible major update nor a weakened gate. Record its outcome separately.
