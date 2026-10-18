# Gateway repeated-restore memory design

## Approved scope

Approved on 18 October 2026 after the grill-me planning checkpoint: measure five
large, real v7 catalog restores in one verifier process, with one-minute pauses
between restores and a final five-minute natural idle observation. Run a separate
bounded statistical allocation lane. Do not deduplicate verification yet.

The previous [outcome](gateway-history-query-outcome.md) recorded higher quiet
verifier RSS, but did not measure its heap or external buffers. RSS alone cannot
identify a leak. This change adds modular ESM fixture tooling, not production
hooks, services, admin controls, schemas, tables or identities. Existing native
UUIDv7 identities remain required. Work stays on main without a release.

## Official research and alternatives

Discovered/read through MCP on 18 October 2026:

- Node 24.21 [process memory counters](https://nodejs.org/download/release/v24.21.0/docs/api/process.html#processmemoryusage)
  distinguish RSS, V8 heap, external memory and ArrayBuffers. ArrayBuffers are
  included in external memory: do not add overlapping counters. Full sampling
  has overhead. The documented glibc-fragmentation example is not a diagnosis of
  this Alpine/musl image.
- Node's [inspector API](https://nodejs.org/download/release/v24.21.0/docs/api/inspector.html)
  supports an in-process session. Never open an inspector listener or retain
  console objects. Close the session in every failure/cancellation path.
- The official [DevTools protocol source](https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/js_protocol.json)
  describes statistical sampling and the distinction between surviving sampled
  objects and allocations collected by GC. Use fixed 512 KiB sampling with
  collected-object flags to study churn; this is not an exact allocation count
  or retained-object graph. Repository blob retrieved:
  `b9ac762a2f7078039a6dd0d6c819320db72d7bd5`.
- Node's [heap-snapshot guidance](https://github.com/nodejs/learn/blob/main/pages/diagnostics/memory/using-heap-snapshot.md)
  warns about pauses and additional memory demand. Full heap snapshots are not
  needed or authorized for this study.

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Natural counters only | Representative process and cache trend | Cannot attribute allocation sites; insufficient alone |
| Natural run plus separate allocation sampling | Separates retention observations from code allocation estimates | More diagnostic time and bounded profiler overhead; selected |
| Heap dumps or forced GC | May expose object reachability or collect garbage | Alters behavior, can stall/exhaust memory and expose contents; excluded |
| Restart after every restore | Bounds retained process state | Conceals same-process growth; not a remedy without evidence |
| Remove repeated validation now | Less work | Some checks straddle distinct snapshots/writes; deferred |

## Fixed protocol and isolation

Reuse the existing disposable soak setup, real prerequisite verification and
3,000 deterministic varied failed-history records. Produce one real large v7
catalog through the packaged worker. Freeze its identity and source-state
fingerprints before measurement; compare them afterward. Do not publish repeated
receipts, accept the source catalog, refund attempts, edit clocks or delete
history. Restore the same immutable artifact to reduce input variation.

With no new inference advancing the revision, the prerequisite archive consumes
shared attempt 1 and the catalog consumes attempt 2. Assert that relationship and
preserve the original attempt-2 record, rather than assuming the attempt-1 catalog
seen in the concurrent-inference study. Repeated restore calls admit no new job.

Natural lane: one-minute baseline, five sequential restores with four one-minute
gaps, then five minutes idle. Allocation lane: fresh verifier process/container,
five sequential restores without artificial quiet periods; profiling surrounds
each restore. It is diagnostic throughput, not production-cadence evidence.
Each restore retains the packaged 180-second outer deadline and existing native
command, four-second SQL and five-second client limits. Lane wall-clock limits
are 26 and 16 minutes respectively, with no caller overrides. No automatic retry.

Run from the repository root with the immutable image ID and inspected source
revision, using the fixed mode (no database/provider/duration arguments):

```text
node scripts/run-gateway-online-archive-rehearsal.mjs <sha256:image> <40-character-revision> --restore-memory
```

Each verifier uses network none, read-only root, UID/GID 1000, no capabilities,
no-new-privileges, 1536 MiB memory/no swap, one CPU and 64 PIDs. Archives,
catalogs, dependency receipts and fixtures are read-only. Scratch is a private
1 GiB tmpfs, with a separate 16 MiB temporary directory. No source socket,
configuration, provider, credentials, Docker socket or published port is mounted.
Only the existing producer has source database authority. Unraid, Plex and
shared Ollama remain untouched; no real inference is issued.

## Measurements and completion

Collect bounded one-second numeric aggregates, phase boundaries and observation
cost: RSS, heap used/total, external, ArrayBuffers, V8 physical/malloc figures,
cgroup total/anonymous/file charge, CPU and optional I/O/PSI. Track natural GC
counts/durations without requesting collection. Missing interfaces stay absent,
not zero. Record lifetime peaks separately; do not reset counters or drop cache.
No raw profile, stack, URL, environment, SQL row or payload may be emitted.

Use closed allocation component labels, bounded node/depth/sample counts and
finite safe numeric totals. Unknown frames become `other`, not invented
attribution. Session cleanup and malformed/oversized profile rejection must be
tested. Profiler time/memory is never reported as normal capacity.

Every restore must return the exact expected catalog receipt, including both
`rowsRestored` and `dependenciesAvailable`, with runtime/purge authority false.
A fulfilled promise or syntactically valid receipt is not success. Verify empty
scratch and no remaining child after each call. Cancellation, timeout, false
receipt, missing coverage, OOM/PID/limit event, changed input/source or failed
cleanup means non-success; retain partial bounded evidence and exit nonzero.

The v7 pre-admission frozen-table check and later restored-state checks are
different phases; no cross-phase cache or budget discount is introduced. A failed
study grants no production recovery, purge, retry or deployment authority.

## Verification and recommendation stack

Test exact receipt/identity refusal, finite scheduling, cancellation with no
retry, coverage gaps, missing counters, malformed/oversized profiles, sanitized
classification, inspector cleanup and exact sandbox mounts. Run existing gateway
contracts, ownership, lint/types and applicable CI gates. Build from clean source
with no cache; use that immutable image for both lanes and native archive safety
regressions. Keep heavy work out of measurements. Record outcome separately.

Stack: real immutable catalog → natural repeated-restore counters → separate
allocation attribution → reviewed findings → only then propose a minimal
same-view optimization. One finite run cannot certify leak freedom or production
headroom. Longer endurance or deeper retained-object analysis remains a separate
decision if evidence calls for it. After passing local gates, preserve a private
backup/rollback image, refresh only normal local Compose, and commit/push scoped
changes. No release, tag, PR merge or production activation is authorized.
