# Post-stop comparison collection observation

Date: 2026-10-07. Scope: the isolated synthetic catalog diagnostic, not production
recovery or a new memory policy. Builds on the
[validation outcome](vector-validation-engine-outcome.md).

## Question and decision

After complete real refresh cycles and worker shutdown, some weakly observed
models remain. The immediate stop sample cannot distinguish objects awaiting
collection from retained objects. Add an opt-in, five-minute observation of the
first natural main-thread major-GC event after shutdown. Report counts before and
after, or explicitly report that no qualifying event was observed.

| Choice | Benefit | Cost / limitation |
| --- | --- | --- |
| Natural post-stop observation (selected) | Preserves runtime GC and admission policy | GC may not occur within the deadline; survivors are not proof of a leak |
| Forced GC / heap snapshot | Can aid later retainer investigation | Perturbs the workload and can consume substantial memory; excluded here |
| Tune caches or memory limits now | May change reported pressure | No demonstrated retention cause yet; risks hiding the problem |

## Design

- Reuse the existing isolated Compose runner, synthetic database, real scheduling,
  worker cleanup and resource-budget checks. No live data or provider calls.
- Add small ESM modules for observation and receipt validation. Enable only for
  the catalog diagnostic, without allocation sampling. Existing default runs and
  workload deadlines stay unchanged; the optional observation adds at most five
  minutes of waiting plus the existing bounded finish allowance.
- Require stopped consumers, drained admissions, and all worker exits before the
  window. Sample weak references once, yield an event-loop turn, then subscribe.
  Do not dereference repeatedly while waiting: dereferencing itself temporarily
  keeps a target alive. Continue existing numeric memory/budget observation.
- Use `PerformanceObserver` with `detail.kind` / `detail.flags`, not deprecated
  aliases. Ignore minor and pre-window events; reject forced collection evidence.
  Require event start/end within the monotonic window, then sample on another
  turn. Disconnect and clear timers on completion, timeout and error.
- Receipts contain only bounded numeric memory, reference counts, worker counts
  and fixed status/scope labels. Do not save objects, raw profiles or payloads.
- An observed major event does not prove an entire concurrent marking cycle began
  after shutdown, nor that every unreachable object must be reclaimed. A cleared
  weak reference is positive evidence of collection; a surviving reference is a
  lead for further investigation, not a leak verdict. RSS alone is not a verdict.

## Research

Official sources discovered with web search and opened on 2026-10-07:

- [Node 24.21.0 performance APIs](https://nodejs.org/download/release/v24.21.0/docs/api/perf_hooks.html):
  GC details, monotonic event timestamps, asynchronous notification and observer
  disconnection. The GC extension is Node-specific, not a browser/W3C GC API.
- [ECMAScript WeakRef semantics](https://tc39.es/ecma262/multipage/managing-memory.html):
  dereferencing adds the target to kept objects for the current execution. This is
  a living draft; the behavior also appears in the published
  [2025 specification](https://tc39.es/ecma262/2025/multipage/managing-memory.html).
- [V8 weak references](https://v8.dev/blog/v8-release-84): collection is
  nondeterministic and may not occur at all.

No UI or HTTP contract changes are proposed, so no accessibility behavior changes.

## Verification and PR trial

Run `node scripts/run-resource-study.mjs --comparison-catalog-post-stop-gc` for a
new isolated build, or call the existing `runResourceStudyCompose` with
`mode: 'comparison-catalog', budget: 'bounded', observePostStopGc: true` and an
immutable `candidateImageId`. Do not point the fixture at an existing database.

Test event filtering, asynchronous delivery, timeout, forced flags, cleanup,
worker/admission refusal, bounded sanitized receipts and runner option propagation.
Run a no-cache exact-image full catalog with this option, dump/check the schema in
isolated containers, and evaluate the rebuilt local test container after backup.
Keep Unraid untouched. Record results separately; no release.

Fresh enumeration found two open PRs. Random selection chose
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`9d74537d7917c248d15926f37b2e40ceba7559a4`: server Node types 24.19.1 to 26.6.4
and undici-types 7.24.6 to 8.9.0. Trial its exact diff locally against the existing
Node-24 compatibility gate before installing. Benefit: newer declarations;
cost: declares Node-26 APIs for a Node-24 deployment. Revert if the gate rejects it;
do not weaken the gate, change the runtime or merge the PR.
Registry metadata confirms the exact tarball integrity and dependency change;
the selected packages declare no install scripts. The official
[DefinitelyTyped versioning guidance](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
ties declaration major/minor versions to their target library API. This is a
compatibility trial, not an audit or installation of the rejected candidate.

## Recommendation stack

1. Measure natural post-stop collection, keeping all safeguards unchanged.
2. Investigate any survivors with narrowly scoped lifetime evidence; absence of
   an event is a measurement limit, not evidence for a production patch.
3. Separately isolate representative membership/fingerprint temporary allocation.
