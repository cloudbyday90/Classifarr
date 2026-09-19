# Discovery allocation and comparison-input design

Date: 2026-09-19

## Evidence and scope

The [previous outcome](inventory-transaction-recovery-outcome.md) fixed database
connection ownership and moved fitting outside transactions. Its frozen comparison
still exhausted the fifth discovery deadline, while container memory-limit hits
increased. That is memory-pressure evidence, not a proven OOM or an accuracy result.

Inspection finds full vector copies before cache-hit/coalescing decisions, a
completed fold retained while its replacement fits, repeated normalized vectors
for profile retrieval, and profile closures created inside the scratch-work scope.
Address those allocations first without changing numerical fitting, holdouts,
timeouts, work limits, routing authority, models or background SWR recovery.

## Design

1. Validate and fingerprint borrowed source synchronously. Only a new admitted
   build copies vectors into owned storage, before any asynchronous boundary.
   Cache hits and joined requests still validate fresh inputs; object identity is
   not a validity shortcut. Public prepared sources remain owned copies.
   Apply the same admission boundary to live SWR revalidation and its final source
   check, without changing freshness, revision checks, retry or serving behavior.
2. Construct profile handles in a separate scope containing only retrieval state
   and aggregate summary. Reuse the control reader's normalized exclusive vectors;
   normalize shared descriptions separately. Do not change normalization order in
   community fitting or reduce floating-point precision.
3. Drop a benchmark's completed profile before the next nonempty fold. No later
   fold uses that profile. Keep live SWR behavior and same-key coalescing intact.
4. Give only the paired multi-scale AI mode a versioned, content-only fingerprint:
   complete document identity/type/membership, library IDs/types, exact vectors,
   and actual description text. Metadata and display names are not read by its
   selection, fitting, prompts or metrics. Keep the shared fingerprint unchanged
   for every other mode. Verify model identity separately as before.
5. Measure aggregate memory/timing with no heap dumps, private content or vectors
   in reports. Repeat the frozen comparison without competing test workloads.

## Research and tradeoffs

Official sources were discovered and checked online on 2026-09-19:

- [Node 24 process memory accounting](https://nodejs.org/docs/latest-v24.x/api/process.html): RSS covers
  the process (including workers), while heap statistics describe the current
  isolate. Use both; do not equate cache weight, heap size and container use.
- [V8 array representations](https://v8.dev/blog/elements-kinds): storage and
  optimization depend on element representation. Prefer measured allocation
  reductions over assumptions about array syntax or a precision-changing rewrite.
- [Node 24 worker limits](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html):
  worker heap limits do not bound external buffers or aggregate process/container
  memory. A future execution budget must account for all resident owners, not
  simply assign each worker an independent maximum.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  report meaningful changes without excessive interruption. This backend-only
  change adds no UI acknowledgements or per-item alerts; future UI diagnostics
  should use concise, accessible status summaries.

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Reduce copies and shorten ownership | Lower avoidable memory/work, same algorithm | Explicit borrowed/owned boundary | Implement first |
| Content-only fingerprint for audited mode | Unrelated enrichment cannot invalidate a run | Dependency contract needs regression tests | Implement narrowly |
| More parallel workers or larger limits | Potential throughput/headroom | More memory or concealed capacity issue | Do not implement |
| Approximate neighbors or float32 conversion | Potential large speed/memory gains | Changes ranking and numerical behavior | Separate measured study |

## Validation and recommendation stack

Test cache freshness, mutation isolation, coalescing/cancellation, incomplete-fit
retry, exact profile output and every consumed fingerprint input. Explicitly test
that metadata drift still invalidates other modes. Keep complete-context admission:
one failed fold means zero inference calls, never a partial-context success.

Recommended order: bounded ownership improvements; input-contract regressions;
frozen read-only Compose comparison; shared memory admission if pressure remains;
then query-focused evidence selection if the complete comparison supports it.
Placement agreement is not verified accuracy. Record observed results separately
in the outcome document. No release is created.
