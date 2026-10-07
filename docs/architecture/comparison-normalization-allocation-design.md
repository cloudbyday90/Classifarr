# Comparison normalization allocation design

Reviewed: 2026-10-07. Status: implementation and measurement planned; not a release.

## Evidence and scope

The [cold allocation outcome](comparison-cold-allocation-outcome.md) identified
normalization as the largest sampled allocation component. This is allocation
churn, not proof of a memory leak. Optimize the arithmetic of the two description
normalizers first; leave cosine, centroids, graph construction and cache weights
alone. Do not change admission limits, retries, ownership, deadlines or GC policy.

## Contract

- Validate each input on every call, including cache hits, using the unchanged
  embedding validator. Invalid shape, dimensions, non-finite, float32-range and
  all-zero inputs retain their existing errors.
- Sum squares in ascending index order starting with positive zero, take the same
  square root, then divide each value by that norm. No reciprocal multiplication,
  approximate equality, precision conversion or removed second normalization.
- Use small ESM arithmetic helpers for already-validated dense numeric arrays.
  These are internal data operations, not generic replacements for Array methods
  on subclasses, proxies or getters that mutate the array during traversal.
- Produce an ordinary dense Array. Reuse a build-local WeakMap result only after
  checking its length, own elements and exact values with Object.is; signed zero,
  mutated inputs and mutated borrowed outputs remain significant.
- Allocation growth remains bounded by the existing 16,000-element validation
  limit. No global cache, background task, additional concurrency or I/O is added.
- Callers retain cancellation, freshness/revision checks and atomic publication.
  A failed validation or build cannot publish partial results. Unknown failures
  continue through existing diagnostics; this does not introduce a recovery path.

## Research and alternatives

Official sources were discovered through web search and reviewed on 2026-10-07:

- [ECMAScript indexed collections](https://tc39.es/ecma262/2024/multipage/indexed-collections.html):
  reduce and map visit elements in ascending order. Preserve that arithmetic order
  rather than substituting a numerically different norm algorithm.
- [V8 elements kinds](https://v8.dev/blog/elements-kinds): array representation and
  element kinds influence optimization. This supports testing dense numeric output,
  not assuming that loops always outperform built-ins.
- [Node GC trace guidance](https://github.com/nodejs/learn/blob/main/pages/diagnostics/memory/using-gc-traces.md):
  interpret allocation and collection over time. A single RSS sample cannot
  establish retention; do not force collection to make the result look smaller.

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Indexed arithmetic and exact cache checking | Avoid per-element callback paths; preserve numbers | More explicit code; select only with measured evidence |
| Keep reduce/map/every | Concise and already tested | Retains the measured allocation hotspot; baseline |
| Typed arrays / approximate checks / skip validation | Potentially larger speedup | Changes contracts or safeguards; reject |

Recommended stack: unchanged validation, shared indexed arithmetic, exact
build-local reuse, differential tests, exact-image cold profiles, then the real
concurrent catalog workload. Profile the next hotspot only after this evidence.

## Validation and completion

First add an independent old-arithmetic oracle and a failing callback-path
regression. Cover dimensions 1 through 16,000, signed zero, extreme/mixed scales,
frozen inputs, repeated normalization and cache corruption. Run focused and full
backend checks. Numerical output must match element-for-element with Object.is.

Build without cache from a clean source commit, dump and independently verify the
schema, and retain the old image. Run natural/allocation/survivor cold modes with
the same fixture and limits; combine both old normalization labels and the new
arithmetic label when comparing. Sampling changes GC: do not compare a sampled
peak with a natural peak as a performance win. Run the bounded concurrent catalog
study and verify worker exit, publication, real warm-cycle completion and cleanup.
Recreate only the local test Compose service after backup and inspect its health.
Record actual results and limitations in a separate outcome document.

## Random open PR trial

Fresh enumeration found PRs 555 and 556. Get-Random selected
[PR 555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable head
`5545605b53c854de8847b44e24fa083ff4218080`: client Node types 24.19.1 to
26.6.4, with undici-types 8.9.0. Apply its manifest/lockfile diff locally and run
the runtime alignment gate. Node 24 remains the supported runtime; if the gate
rejects Node 26 types, revert only this trial without installation or merge.
Do not claim installed dependency tests for a rejected metadata-only trial.
