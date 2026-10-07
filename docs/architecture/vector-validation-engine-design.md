# Vector validation engine attribution

Date: 2026-10-07. Follow-up to the
[allocation experiment](vector-validation-allocation-outcome.md).

## Question and boundaries

Why does the unchanged validator allocate more after seeing structured-cloned
arrays? Use the existing fixed synthetic reproduction on pinned Node 24.21.0
to distinguish an optimized allocation site from repeated deoptimization.
Do not infer retained-memory leakage from cumulative allocation samples.

Start with natural optimization/deoptimization events and filtered generated
code. Engine tracing changes timing: it is attribution evidence, not a benchmark.
Do not force optimization or garbage collection, load live data, attach to the
application, open a remote inspector, or change production Node flags.
Each disposable probe has no network or appdata, read-only root, an unprivileged
user, no capabilities, no-new-privileges, 2 GiB/two CPUs/128 PIDs, and an external
120-second timeout. Raw synthetic traces stay in ignored local storage. No new
startup work, retry, write, queue, migration, ownership or cooldown is introduced.
Unsuccessful/unsupported/expired probes are failures, not successful evidence.

## Conditional implementation

Only change production code after identifying a concrete mechanism and testing
a bounded alternative. Preserve the complete shared validator contract: shape,
dimensions, own properties, finite/nonzero float32 representability, read/check
ordering, signed zero, original values and identity, and fixed errors. Preserve
all admission, freshness, retry, ownership and memory controls. No cache of
decoded vectors or larger heap allowance. Keep new JavaScript modular and ESM.

If an alternative qualifies, add regression tests and compare both parsed and
clone-conditioned histories with tracing disabled. Require real full catalog
cycles, including independent warm reads and worker/consumer shutdown, before
claiming a runtime benefit. A tiny probe alone does not explain every warning.
If none qualifies, record the attribution and bounded next experiment honestly.

## Evidence-selected candidate

The actual generated IR contains a `TransitionElementsKindOrCheckMap` converting
`PACKED_DOUBLE_ELEMENTS` to `HOLEY_ELEMENTS`, lowered to a runtime transition.
Only two validator deoptimization events occurred in the full probe. This points
to array representation conversion, not a deoptimization storm. Internal engine
names describe this pinned diagnostic only; application code must not detect them.

Parser-only isolation still reaches the general validator through fingerprints.
A factory shares feedback between its returned functions; numeric helper calls
regressed the parsed control. A distinct inventory loop used by decoding and both
fingerprinters is the candidate. Keep the same full validation on every call,
including after mutation; never mark arrays trusted or skip revalidation.

Share the error constructor and dimension ceiling. Deliberately retain two small
equivalent loop bodies to separate engine feedback without runtime flags, dynamic
code generation, module-query imports or mutable caches. The cost is maintenance
duplication: run the same adversarial semantic suite against both and add
deterministic differential cases. Full-cycle evidence must justify this cost.
No guarantee is made about other V8 versions or arbitrary mixed histories inside
the inventory-only boundary. If the real-cycle result does not improve the
specific warm reads, revert the production candidate.

## Alternatives

| Choice | Benefit | Cost / decision |
| --- | --- | --- |
| Trace the existing reproduction | Locate generated allocation sites without changing runtime | Engine-specific, timing perturbation; do first |
| Small semantics-preserving change | May remove the observed temporary allocation | Requires differential and full-cycle evidence |
| Separate inventory validation | Isolates the demonstrated cross-boundary feedback | Duplicated loop contract; selected conditionally after attribution, subject to real-cycle verification |
| Disable optimization, weaken validation or raise limits | Could hide the symptom | Changes safety/performance broadly; reject |

## PR and delivery

Fresh enumeration found two open PRs; random selection chose
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Trial its exact server Node-type diff
locally, preserving the Node 24 compatibility gate. Revert before installation
if that gate fails. Do not merge or change the runtime to accommodate the PR.

Run focused and full affected tests and quality gates. Update Unreleased at the
system level; record outcomes separately. Stay on main, commit/push, build local
Compose without cache, dump/check schema in isolated containers, back up before
local replacement and check health/memory afterward. No Unraid changes or release.

## Official sources

Discovered through online search and opened on 2026-10-07:

- [V8 elements kinds](https://v8.dev/blog/elements-kinds): representation and call history can affect optimized operations; not proof of this particular allocation.
- [V8 compiler documentation](https://v8.dev/docs/turbofan) and [flag definitions](https://github.com/v8/v8/blob/main/src/flags/flag-definitions.h): filtered tracing and generated-code inspection; verify flags against the actual deployed binary.
- [Node V8 API](https://github.com/nodejs/node/blob/main/doc/api/v8.md): engine-specific diagnostics are not a portable application contract.
- [HeapProfiler protocol source](https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/js_protocol.json): sampling can include collected objects, distinct from surviving allocations.
