# Concurrent comparison allocation outcome

Date: 2026-10-07. See the separate [design](comparison-phase-allocation-design.md)
for researched alternatives and the diagnostic contract.

## Implementation and verification

Source commit: `efd3698c20a6c9c3385de20cd98c73f00681ae43` on `main`.
Small ESM study modules add bounded, opt-in allocation windows around control
construction, actual community discovery, quality assembly, streamed verification
and representative preparation. Production services, memory limits, admission,
ownership, freshness, retry and GC behavior are unchanged. No UI, API, dependency,
schema, version, release or branch change.

The old `recovery_community` marker is **before** discovery. A peak at that marker
is not proof that community discovery caused it. Window names now describe work
between explicit start/end boundaries; scheduler attempts establish whether a
verification actually ended in warm reuse.

Validation before image measurements:

- Focused study tests: ten suites / 160 tests passed, followed by 54 tests in the
  two edited suites after adding connection/disconnection/context failure cases.
- Final backend unit suite: 1,737 suites, 53,937 passed, one Windows-only skip;
  281.058 seconds. The first full run caught the changed ownership-review digests.
  The two launchers were reviewed, the digests updated, and both the 39-test
  ownership suite and final full run passed. No unresolved writer was authorized.
- Server/client type checks and lint, server full/production Knip, static ESM
  imports, ESM mock shapes, copyright and Markdown checks passed.
- Toolchain/install-policy suite: 40 passed. Live Node 24.21.0 inspector smoke
  exercised sampling, numeric reduction and disconnect without a remote port.
- No-cache Compose build succeeded. Image ID:
  `sha256:fe5eb3f5db51922a76a20517b4bd79014ccba9bc9b08ce4311f41bbf2b5e88dd`.
  Native manifest: `e2fa83dfbd23bbc21979eab079c9c7fea7276e2ff466be71fa486055c8fb5f56`;
  config: `d8a61793c1f87a4f0b08ccac5fbf0fb573d2e4e3d8d19960cd5f034eca422bee`.
  OCI source revision matches the commit above.
- Post-build schema dump and independent check each used a fresh disposable
  container. Schema and 22 seed migrations were unchanged, through
  `20261005_180000_ingestion_compatibility_fence.sql`; both cleaned up.
- The same Linux image passed directory fsync, exclusive-copy rejection and
  unchanged-source checks for the Windows-skipped filesystem behavior.

The pushed source passed [CI run 37635509105](https://github.com/cloudbyday90/Classifarr/actions/runs/37635509105):
build/tests, database tests, fresh installation/published upgrade and the
acceptance readout. Full OSV, secrets, filesystem/Compose scans, both CodeQL
analyses, copyright and queued-work/resource-safety checks also passed for this
SHA. Publication/promotion and manual-only jobs were skipped as expected; this
is not release approval or evidence for an untested published image.

## Open PR trial

Two PRs were open at fresh enumeration. Randomly selected
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable head
`5545605b53c854de8847b44e24fa083ff4218080`, was applied locally as its exact
manifest/lockfile patch. The runtime-major gate passed 8/8 before it, failed
1/8 with Node 26 declarations, and passed 8/8 after the trial was reverted.
The deployed runtime remains Node 24.21.0. No merge, package installation,
installed-candidate audit or candidate frontend build is claimed.

Benefits of the PR are newer declarations; the cost is permitting types for
runtime APIs we do not ship. Keep Node 24 declarations. Fresh `npm outdated`
also found client PostCSS 8.5.29 and Vite 8.3.3 patch candidates; evaluate those
as a separate dependency batch, not part of memory attribution.

## Complete sampled catalog

Project `classifarr-resource-study-68810149729764793228822891573fc9` passed on the
exact image above in 1,438,948 ms. Twenty waves and 190 scans completed all 5,776
items across ten libraries, with all 5,776 description vectors cached. Pending,
failed, routing, handoff and service-error counts were zero. Twelve workers were
created and all twelve exited; no worker remained active. Three builds and 35
reads produced 32 validated allocation windows.

Memory admission deferred ingestion 20 times, queue work 89 times and discovery
four times. The existing recovery receipt observed an actual memory-pressure
deferral followed by successful recovery. After drain at 622,072 ms, comparison
became ready at 840,517 ms and revalidated at 1,151,774 ms; representatives
published at 1,079,609 ms and were up to date at 1,438,793 ms. Both real scheduled
warm cycles exceeded five minutes. No cooldown or admission value was shortened.

Each read-only consumer prepared and committed ten batches: 20 processed
observations, zero errors/invalid inputs/pending work and no routing effect.
The 80 readiness groups were cleared to zero on stop. Container health, OOM,
limit-hit, restart and owned-project cleanup checks passed.

### Allocation attribution

These are statistical **cumulative allocations**, including objects collected
during the window; they are not simultaneous usage, retained sizes, or evidence
of a leak. The main-isolate sampler can include overlapping work and does not
profile worker heaps.

| Final full-size build window | Estimated MiB allocated | Duration | Main heap start → end, MiB |
| --- | ---: | ---: | ---: |
| Control construction | 242.53 | 298 ms | 187.79 → 256.37 |
| Actual community discovery | 1,036.34 | 43,996 ms | 233.98 → 500.74 |
| Quality assembly | 27.35 | 154 ms | 357.54 → 357.09 |

Across all three community builds, attribution was distributed across centroid
work (525.97 MiB), graph construction (507.42), partitioning (408.02), arithmetic
(402.05) and the similarity module (353.41). This is not a single established
culprit. The label `vector_normalization` covers the similarity module, including
cosine work, not just normalization.

| Successful post-drain warm window | Estimated MiB allocated | Cache decode/validation label, MiB |
| --- | ---: | ---: |
| Comparison attempt 21, first independent check | 304.39 | 183.10 |
| Comparison attempt 21, second independent check | 303.81 | 180.47 |
| Representative attempt 25, preparation | 610.01 | 346.78 |
| Representative attempt 25, final independent check | 277.44 | 163.04 |

The `vector_cache` stack category inherits uncategorized descendant frames,
including `validateEmbedding`; it does **not** establish that JSON parsing alone
causes those bytes. Both independent freshness checks remain necessary. Do not
remove validation or reuse stale results to reduce these numbers.

### Retention observations and limits

Late idle heap stayed around 218–219 MiB. During one idle period, RSS fell from
632.11 to 328.94 MiB and raw container usage from 941.05 to 625.57 MiB while main
heap stayed nearly flat. This demonstrates reclamation during the observation,
not a complete retainer analysis. Recorded major-GC events numbered 162 across
13 isolates; the largest reported pool was 432 MiB. Pools were not subtracted
from the admission budget.

At final stop, weak observations showed no live source snapshot, decoded-vector
map or owned-source/vector generation, and one comparison handle. Two community
vectors, one verification-metadata object, one batch per consumer and two
representative models were still weakly observable immediately after recent
work. All workers exited and explicit consumer groups cleared. No forced GC or
long post-stop collection was performed, so this is neither a leak finding nor
a guarantee that every historical object was collected.

Sampling can itself perturb GC; heap reductions around sampling completion must
not be credited to an application optimization. The host was not otherwise idle.
One bounded, read-only synthetic-database count query checked progress late in
the sampled run. No live database or provider was used for either study.

## Unsampled same-image control

Project `classifarr-resource-study-267d1877e3e56ade83ce579e35aa4d1a` passed in
1,201,729 ms with allocation sampling disabled. All 5,776 items and cached vectors
completed, with zero pending, failed, routing, handoff or service-error counts.
It performed 201 scans, four builds and 26 reads. All ten workers exited. Each
consumer prepared/committed seven batches, with zero errors and groups cleared
from 80 to zero on stop. It also observed actual pressure recovery: ingestion,
queue and discovery recorded 9, 76 and 3 memory deferrals respectively.

After drain at 625,311 ms, representatives published at 768,713 ms and were up
to date at 1,127,528 ms; comparison became ready at 881,099 ms and revalidated at
1,200,908 ms. Both scheduled warm intervals exceeded five minutes. Health, OOM,
limit-hit, restart and cleanup checks passed; an independent check found no
remaining owned container, volume or network.

| Peak measurement, MiB | Sampled catalog | Unsampled catalog |
| --- | ---: | ---: |
| Main heap used | 609.23 | 624.10 |
| Process RSS | 804.46 | 805.96 |
| Worker heap used | 206.42 | 200.70 |
| Raw container usage | 1,120.50 | 1,190.72 |
| Kernel container high-water | 1,123.95 | 1,195.51 |

These are two observations of the **same source/image**, not a before/after
optimization benchmark. Scheduling, completed build counts and profiler effects
differ; one run per mode does not establish a performance delta. Raw container
usage includes PostgreSQL and cache, not just Node. The configured limit remains
2 GiB, and optional discovery still needs its existing reserve/work headroom.

Without sampling, idle main heap remained around 218–219 MiB while RSS naturally
fell from about 792.6 to 330.5 MiB and raw container usage from 1,171.4 to 693.0 MiB.
There were 149 major-GC events across eleven isolates, with a largest reported
pool of 561 MiB. The final warm comparison ended at 386.26 MiB main heap; immediate
stop measured 388.30 MiB heap / 626.60 MiB RSS / 1,004.96 MiB raw container usage.
Weak observations showed no live source/decoded/owned generations or consumer
batches, but two verification-metadata objects and two representative models
were still observable. No post-stop collection guarantee is claimed.

## Focused decode cross-check

After both full runs, a separate disposable container from the same immutable
image used no network, a read-only root/probe mount, UID 1000, no capabilities,
2 GiB memory, two CPUs and a 64-PID limit. It called the actual cache decoder and
validator on deterministic float32-compatible vectors: 1,024 dimensions, repeated
256-row batches totaling 5,776 entries. Three rotated rounds compared equivalent
Map assembly with parsing only, validation of predecoded arrays, and the actual
combined decoder. Counts and checksums matched; no database, provider, forced GC
or production code replacement was involved. The container removed itself.

| Microdiagnostic | Estimated cumulative allocation range, MiB |
| --- | ---: |
| Parse and Map assembly only | 37.28–46.86 |
| Validate predecoded arrays and Map assembly | 1.00–3.50 |
| Actual cache decoder | 45.85–48.87 |

This small repeated-input probe is **not equivalent to the full application**:
input representation, runtime warm-up, call counts, database materialization and
overlapping work differ. Its result does not reproduce the 163–183 MiB cache-path
category of a full warm check. It therefore does not justify replacing the
parser, weakening validation or selecting a validator optimization yet.

Additional official check on 2026-10-07: the
[ECMAScript 2026 Object.hasOwn algorithm](https://262.ecma-international.org/17.0/index.html#sec-object.hasown)
requires property-key conversion and an own-property check, but does not specify
an implementation's allocation cost. Numeric keys alone are not an established
cause here. The standard URL was discovered from Ecma's publication page.

## Recommendations and tradeoffs

| Option | Pros | Cons / disposition |
| --- | --- | --- |
| Attribute the full cached-vector read path, then reduce proven temporary allocations | Repeated warm-read cost is measured; a shared-path fix could benefit both consumers | The isolated decoder does not reproduce the full cost; finer attribution is needed first |
| Optimize community construction | Largest single measured build window | Several distinct hot paths, different workload from warm reuse; second priority |
| Keep full decoded vectors across refreshes or remove the second freshness check | Might avoid repeated decoding | Increases retained memory or weakens freshness; not recommended |
| Raise limits, weaken admission or force GC | Might make optional work run sooner | Does not address allocation cause; rejected |

Recommendation stack: preserve the current safeguards; split the real cache path
into row materialization, parsing and validation with bounded call/row/dimension
counters; explain the full-workload versus isolated-decoder gap; then make one
semantics-preserving optimization and rerun natural complete refresh cycles.
Community hot paths follow. Treat the PostCSS/Vite patch updates as a separate
tested dependency batch. Do not skip validation, collapse independent freshness
reads or introduce an unbounded decoded-vector cache.
Only escalate to a heap-retainer study if repeated natural-cycle observations
show retained growth; do not take a disruptive snapshot in live Unraid now.

## Local recovery point

Before overwriting the local image tag, the running image was pinned as
`classifarr:pre-memory-88bd42a7-c827-43eb-8a78-6fcab72cea2a`, pointing to
`sha256:527d87727094890b958ba9c14940748faf9deb7597f3e2c61e92f7a0870b4e90`.
Backup `.tmp/pre-memory-fingerprint-88bd42a7-c827-43eb-8a78-6fcab72cea2a.dump`
contains 75,562,943 bytes and passed checksum and archive-list checks. This is
not a restore rehearsal.

Immediately before replacement, a fresh 75,569,320-byte backup was checked the
same way: `.tmp/pre-memory-fingerprint-07f041c9-6843-4965-8a30-b91c977d2e19.dump`.
Rollback tag `classifarr:pre-memory-07f041c9-6843-4965-8a30-b91c977d2e19` pins the
same old image. Only the local test Classifarr service was recreated from the
verified no-cache image, preserving appdata and mounts. UID 1000, read-only root,
2 GiB limit and security settings remain unchanged. Initial health and readiness
were healthy/ready, with no new reported/recent comparison error. Existing logs
still contain historical pressure/recovery events; this diagnostic-only change
does not claim to fix those events.

The 300,000-ms observation completed with 19 samples from 15:08:23 to 15:13:19 UTC:
raw container usage fell from 885.29 to 614.39 MiB; the kernel high-water was
904.21 MiB. Every sample was healthy, with zero OOMs and limit hits; the final
container restart count was zero. Final read-only diagnostics showed no new
reported/recent comparison error. Readiness had changed from `ready` to
`backfilling`: all ten active library imports were complete, three backfill
markers were unfinished, and no processing/due-pending queue task appeared in
that separate snapshot. This is not a claim that all local backfills completed
or that the original memory issue is eliminated. Unraid and Harmoniarr were not
reconfigured or restarted.

## Evidence identifiers

Sanitized receipts/traces remain ignored intermediates under
`.tmp/resource-study/<project>/`; the source and these design/outcome documents
are the committed deliverables. SHA-256 values:

- Sampled receipt: `bbd71dc8ebb4e62e3b91bd8a190ed12b4479c69eb5457eb17aeb66679f205ba6`.
- Sampled phase trace: `868914fcd0fb1a86719e010328499d866ad32691f34dae0339db9188173d3393`.
- Sampled GC trace: `e913891a023aa6fd3f785c8efdfb573a068dde64101b107e9e0b249a92f6d8bb`.
- Unsampled receipt: `efdfd9f3dfd500001b8e61e4675c92cb179e5e3086f83a9ebf73c87b61a0a048`.
- Unsampled phase trace: `e94e8ff503644187ef97883568179ac5dce8367ebc16a53e3d7be9753a79fe1d`.
- Unsampled GC trace: `281e7290f8cc38e3c16fae2f151eee178d80a65644a834c117c8edee2071af4e`.
- Decode probe script: `463197b011fdaa8888d1e643d9df5bec651023be8765cf1ced93c1e765dfe692`.
- Decode probe receipt: `d59617608970d8083e40057e0193a29b89f3c9639cb69626db359ac1ec2e6561`.
