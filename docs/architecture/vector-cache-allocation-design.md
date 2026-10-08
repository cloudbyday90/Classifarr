# Shared validation and cached normalization allocation

Date: 2026-10-07. Follow-up to the representative centroid allocation outcome.

## Investigation contract

The previous catalog rehearsal still attributed temporary allocations to shared
validation and the cached-normalizer path. These are sampled cumulative bytes,
not evidence of retained objects or a leak. Isolate validator input history,
norm calculation, exact cache-result matching, misses and hits before changing
runtime code. Reuse the existing synthetic fixture and bounded inspector summary.

Run fresh, network-disabled, read-only, non-root containers from immutable local
images with two CPUs, 2 GiB and 128 PIDs. Fixture creation and conditioning occur
outside measurement. Compare identical parsed inputs before/after cloned-input
conditioning, with independent inventory validation as a control. Separate
natural and allocation-sampled runs, repeat measurements, and check exact results.
No provider requests, live database inputs, raw heap profiles or forced GC.

Preserve every shape, dimension, own-slot, finite, float32 range/underflow and
nonzero check. Preserve division, operation order, signed zero, double precision,
input/output mutation checks and build-local WeakMap lifetime. No new retry,
admission, concurrency, persistence, migration or startup work. Cancellation,
ownership and publication fencing remain at their existing callers. Failure
continues to reject publication; no malformed vector becomes a cache hit.

Only keep a small ESM change supported by measured improvement and differential
tests. If the isolated result is inconclusive, retain the diagnosis and a
repeatable diagnostic instead of a speculative runtime refactor.

## Sources and alternatives

Official sources discovered and opened through web search on 2026-10-07:

- [V8 elements kinds](https://v8.dev/blog/elements-kinds): input representation
  history can affect optimized array operations; measurement must include it.
- [V8 field and element representations](https://chromium.googlesource.com/v8/v8.git/%2B/refs/heads/main/docs/objects/fields-and-elements.md):
  numeric storage specialization explains why identical values need not have
  identical engine costs. It does not prove a specific allocation mechanism here.
- [Node Inspector](https://nodejs.org/api/inspector.html): use an in-process
  session, not a listening debugger. The pinned Node 24 image remains the test
  subject; current documentation is not permission to upgrade the runtime.
- [ECMAScript Number semantics](https://tc39.es/ecma262/2023/multipage/ecmascript-data-types-and-values.html):
  SameValue distinguishes signed zeros and matches NaN to NaN. Use this stable
  contract, not approximate equality, for the cache comparison.

| Option | Benefit | Cost / risk |
| --- | --- | --- |
| Keep runtime, improve diagnosis | No behavioral change | No allocation reduction |
| Narrow numeric boundary | Potentially less temporary allocation | Engine-specific benefit; must preserve validation |
| Broader typed-array/cache redesign | Potential storage savings | Changes representation and mutation contracts |
| Skip validation or relax safeguards | Not acceptable | Weakens integrity and resource safety |

Preferred stack: measure each phase, retain only demonstrated narrow changes,
verify full refresh behavior, then resume compatible dependency updates separately.

## Measured implementation decision

Initial six-pass probes over 5,776 parsed vectors of 1,024 dimensions reproduced
about 1.1 GB of cumulative sampled allocation in exact cache matching and hits,
but not in isolated shared validation or norm calculation. A numeric SameValue
prototype reduced matching to near the sampling floor. This identifies a narrow
comparison-path opportunity, not a confirmed general validator bug or a leak.

Keep the current module and replace Object.is at the numeric comparison site with
strict equality plus explicit signed-zero and NaN handling. Division always
produces a number, so other types still fail without coercion. Keep own-slot and
length checks, reading each value once. The validator and weak cache are unchanged.
Prove equivalence against Object.is across numeric edge cases, corrupt borrowed
outputs and deterministic bit patterns; repeat against the actual rebuilt image.
Do not remove the NaN case merely because valid production inputs are finite.

## PR and delivery gate

Fresh enumeration found only PRs 555 and 556. Random selection chose 555 at
`5545605b53c854de8847b44e24fa083ff4218080`. Review its immutable patch and trial
locally. The proposed Node 26 declarations must pass the existing Node 24 runtime
contract; do not broaden that contract to accept the trial. Revert trial-only
changes if this first gate fails, without installing incompatible tooling.

Run affected tests and quality gates, no-cache local Compose build, isolated
schema dump/check, and appropriate actual-image diagnostics. Back up local data
and pin rollback before replacement. Keep Unraid untouched. Record source/image
identity, limitations and next work in a separate outcome. No release or branch.
