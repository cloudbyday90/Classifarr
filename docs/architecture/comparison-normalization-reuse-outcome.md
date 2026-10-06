# Comparison normalization reuse outcome

Date: 2026-10-06. [Design, official sources and tradeoffs](comparison-normalization-reuse-design.md).

## Implementation

A small ESM normalization factory reuses exact arrays within one comparison build.
It validates input on every lookup and compares every cached component with the
fresh normalization calculation. Broad control, retained-mean validation and
community discovery share the factory; the graph retains its separate second
normalization. Standalone callers retain fresh normalization by default. No global
cache, source mutation, schema change, new provider call or unchecked flag.

Existing component/worker/cache limits, admission headroom, retry budgets,
timeouts, publication verification and safe optional-failure behavior are intact.
The factory and scratch inputs are not captured by the public profile handle.

## Verification so far

- Focused tests: 19 suites, 232 tests passed, including exact non-unit control and
  community comparisons, retrieval isolation, signed zero, malformed vectors,
  dimensions, mutation and cancellation. Existing optional-failure tests passed.
- [PR #556](node-types-pr556-outcome.md) was applied locally, rejected by the
  Node-major gate, then reverted; no dependency change or PR merge.

Full checks, image measurements and local observation are recorded below after
completion. No application-wide peak reduction or solved memory-pressure warning
is claimed from the allocation change alone.
