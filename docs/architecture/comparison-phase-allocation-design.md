# Concurrent comparison allocation design

Reviewed: 2026-10-07. This is an opt-in synthetic diagnostic, not another
production memory optimization or a release.

## Question and boundaries

The previous catalog peak at `recovery_community` is a boundary **before**
community discovery, after control construction. It cannot attribute that peak
to the community algorithm. Measure separate control, community and quality
windows, plus comparison/representative verification and warm preparation.
Correlate each with its actual scheduler worker, attempt and final outcome;
a verification read alone does not prove a cache hit.

Use the existing isolated catalog runner, empty synthetic PostgreSQL database,
5,776 deterministic descriptions and real concurrent import/metadata services.
No new provider, live credentials, inspector port, forced GC, timing shortcut,
application endpoint, migration, cache policy or production service change.
Unraid is outside this exercise. Keep ownership/freshness checks and every
admission, CPU, memory, PID, retry and five-minute refresh bound unchanged.

## Sampling contract

- Default disabled: no inspector connection and no extra production work.
- Enabled only for `comparison-catalog` in the isolated study environment.
- One main-isolate sampling session at a time, 512 KiB average interval,
  including allocations collected by both minor and major GC. Worker heaps
  remain separately measured by existing instrumentation, not this sampler.
- Maximum 128 windows, 360 seconds per window, 50,000 profile nodes, depth 64
  and 200,000 samples. Existing Docker timeout and 8 MiB output bound remain.
- Never serialize raw profiles, paths, function names, vectors or error text.
  Retain only fixed phase/component labels, attempt identity, elapsed times,
  heap/RSS boundaries and statistical self-byte estimates.
- Do not serialize competing work to obtain exclusive measurements. Unexpected
  nested/overlapping sampling, missing context, timeout, invalid profile or
  inspector failure invalidates evidence. Disconnect in cleanup. A production
  optional-work catch must not turn a failed diagnostic into a passed study.
- Work errors/cancellation preserve their application handling; the study fails
  its evidence check. No retry of mutations, changed cooldown or persisted state.
  A crash yields no successful receipt; rerun only in a new disposable project.

Allocation estimates describe all main-isolate work during the labelled window,
including overlapping ingestion and diagnostic overhead. They are not exact
allocation counts, retained sizes, or proof that the labelled operation owns all
bytes. Fixed stack-category attribution separates known components from `other`.
Use existing natural-GC/weak observations for retention, not allocation totals.

## Options and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Opt-in bounded phase sampling | Locates allocation-heavy work in the actual concurrent workload | Sampling perturbs GC; adopt as diagnosis only |
| Whole-process heap snapshot | Strong retainer paths | Pauses and substantial extra memory; defer unless retention evidence requires it |
| Optimize the old phase peak immediately | Less diagnostic work | Boundary is ambiguous; reject |
| Relax memory admission or force GC | May let optional jobs run | Masks resource pressure; reject |

First preserve safety and establish phase attribution; then compare warm and
construction paths; only then propose a small production optimization supported
by the measured components. Rebuild without cache, dump/check schema in an
isolated container, exercise complete scheduled catalog cycles, and separately
evaluate the backed-up local test deployment. Do not claim a release or a
performance improvement from a sampled run.

## Random PR trial

Fresh enumeration found two open PRs, #555 and #556. Random selection chose
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`: client Node declarations 24.19.1 to
26.6.4, with undici-types 7.24.6 to 8.9.0. Apply its exact manifest/lock metadata
locally and run the existing runtime-major gate before installation. Revert if
it conflicts with the pinned Node 24.21.0 runtime; do not merge or waive the gate.
Benefit: newer declarations. Cost: APIs beyond the deployed runtime.

## Official research

Discovered through web search and opened on 2026-10-07:

- [Node 24 inspector](https://nodejs.org/download/release/v24.4.0/docs/api/inspector.html): local session lifecycle and disconnect behavior. Validate against the pinned 24.21.0 runtime, not the latest Node major.
- [V8 inspector protocol definition](https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/js_protocol.json): sampling interval and flags including collected objects; default surviving-object samples answer a different question.
- [Node heap-snapshot guidance](https://github.com/nodejs/learn/blob/main/pages/diagnostics/memory/using-heap-snapshot.md): snapshots pause the main thread and can substantially increase memory; avoid taking them in the live deployment for this first attribution step.

Registry metadata fetched with the saved npm configuration confirmed the PR's
26.6.4 integrity and undici-types dependency. No new UI or accessibility claim.

## Ownership review and repeatable invocation

Reviewed both complete changed launchers and their sampling callees before
updating only their two source digests in `ownershipReview.json`. Analysis digests,
classification and unresolved debt remain unchanged. The new explicit `0`/`1`
probe flag cannot select another database, provider, project or source mount.
It only wraps existing synthetic reads/builds with local inspector sampling.
Seed/startup are explicitly unsampled; receipts require requested telemetry.
No SQL, ownership reset, admission exemption or production recovery is added.

Use `runResourceStudyCompose` from `scripts/lib/resourceStudyCompose.mjs` with
`mode: 'comparison-catalog'`, `budget: 'bounded'`, `profileAllocations: true`,
`traceGc: true` and the verified immutable `candidateImageId`. The same invocation
with `profileAllocations: false` is the natural control. The runner writes the
sanitized allocation windows inside `.tmp/resource-study/<owned-project>/result.json`
after receipt and cleanup validation. Do not invoke this against live appdata.
