# Comparison quiescent residency design

Date: 2026-10-07. Scope: isolated diagnostics, not a release or production policy change.

## Question and decision

The previous full-catalog study collected all sampled snapshot/cache references
after a natural main-thread major GC, yet process anonymous residency remained
high. This is not sufficient evidence of a native leak or allocator fragmentation.
Extend the existing opt-in post-stop GC study with five aggregate mapping samples
over two minutes after an observed natural major GC. Keep its existing five-minute
GC deadline and one-second resource safeguards. A timeout remains inconclusive;
do not label a subsequent sample as post-GC without observing the event.

## Options and recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Bounded mapping categories and quiet-window trend | Separates anonymous writable, reserved, executable, heap, stack and file/shared mappings | Cannot identify allocation ownership; reads are observational | First, implement and measure |
| Native allocator tracing in a disposable image | Can attribute outstanding native allocations | Additional tooling, instrumentation overhead and interpretation | Next only if residency persists |
| Allocator replacement, forced GC or cache eviction | Might lower a particular measurement | Changes behavior without causal evidence | Do not implement |

## Contract and boundaries

- Existing ESM diagnostic entry point and unchanged synthetic 5,776-item catalog;
  no live database, Plex request, external provider or additional privilege.
- Read only `/proc/self/smaps`, in 64 KiB chunks, at most 8 MiB, 8,192 mappings,
  8 KiB per line and a one-second cooperative read deadline. Keep only one current
  mapping and fixed aggregate counters. Close the file on success or refusal.
- Emit fixed category and virtual-size-bucket counters, never addresses, PIDs,
  filenames, raw proc text or raw read errors. Invalid, unavailable, truncated or
  over-budget observations have an explicit unavailable status, not zero usage.
- Counters: mapping count, virtual size, RSS, PSS, anonymous, private dirty,
  swap and lazy-free bytes. Anonymous writable size buckets describe mapping
  size, not allocation size or a particular allocator.
  The `heap` category is Linux's `[heap]` mapping, not the JavaScript heap.
- Capture mapping aggregates at pre/post-GC boundaries and five quiet samples,
  30 seconds apart. Validate stopped consumers, empty admissions and exited
  workers before and after each observation. Keep budget checks running.
- Preserve the existing GC receipt. Add an optional, separately validated
  `postStopResidency` receipt only when GC was observed. Its observations are
  not atomic with Node, cgroup or rollup measurements. Historical receipts remain
  readable; the current launcher requires the extension when GC was observed.
- No change to runtime memory thresholds, scheduler, retries, routing, cache
  policy, public API, Compose requirements or Unraid installation.

## Research

Official sources retrieved 2026-10-07; conclusions apply to the deployed Node 24
line, not an assumed future/latest runtime:

- [Linux proc documentation](https://www.kernel.org/doc/html/latest/filesystems/proc.html):
  smaps provides per-mapping accounting. Anonymous pages can also belong to
  copy-on-write file mappings; lazy-free is not immediate reclamation. Partial
  reads are racy, so mapping totals must not be treated as an atomic census.
- [Node 24.21 process documentation](https://nodejs.org/download/release/v24.21.0/docs/api/process.html):
  RSS is process-wide while other worker memory counters are thread-local;
  array-buffer usage is already included in external memory. Its glibc
  fragmentation note does not diagnose the Alpine/musl image.
- [DefinitelyTyped versioning](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md):
  type-package major/minor versions follow the described runtime API. Randomly
  selected open [PR #556](https://github.com/cloudbyday90/Classifarr/pull/556)
  proposes Node 26 server typings; trial its exact manifest/lockfile change
  against the Node 24 compatibility gate, without merging or relaxing the gate.

## Validation and outcome

Test parser boundaries, malformed/duplicate/missing counters, privacy projection,
read failure/cleanup, quiet-window timing, resumed work refusal, receipt integrity
and launch timeout/cleanup. Run backend/tooling checks, then build the local image
without cache and measure the complete isolated workload on its immutable ID.
Record actual results and limitations in the separate outcome document. Back up
local app-data before recreation; generate schema from an owned disposable image
container. Production Unraid remains untouched.
