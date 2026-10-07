# Cached-vector read attribution outcome

Date: 2026-10-07. See the [design](comparison-vector-read-attribution-design.md)
for alternatives, official research and the observation contract.

## Change and verification

Source: `f66d9827b6c73e86a41f35949755d3770f8cd491` on `main`.
The existing native parser and decoder are separated into small ESM modules.
Subscriber-gated numeric counters distinguish database batches from decode
batches, including rows, dimensions/components and encoded character counts.
The isolated sampler distinguishes parsing, validation, assembly, database
transport/client, cache handling and diagnostic overhead. No payload or identity
is published through the channel. Allocation receipts use version 2.

SQL, vector validity rules, snapshots, freshness checks, memory admission,
timeouts, cooldowns, routing and ownership safeguards remain unchanged.
There is no new decoded-vector cache, forced GC, inspector port, schema change,
dependency update, version bump or release. No UI/accessibility claim is made.

- Full backend suite: 1,738 suites, 53,989 tests passed, one platform-specific
  skip, 339.539 seconds. The skipped Linux directory-fsync behavior subsequently
  passed in the actual candidate image, including exclusive-copy refusal and
  preservation of the source.
- Two isolated PostgreSQL suites: 20 tests passed. The new real-database case
  proves that 257 vectors produce two read batches and one aggregate decode,
  with identical vectors and numeric totals. Existing snapshot/concurrent-write
  and representation/expiry checks remain green.
- Server type check, test/security lint, full and production Knip, ownership
  gate, static ESM import check, copyright, npm CLI policy and Markdown checks
  passed. The ownership baseline was not refreshed.
- No-cache Compose image:
  `sha256:797b3347423babba64e02b4fad977929b7927b40c1b3d9479d00fd69a198be89`.
  Native manifest `2f5bcb09fd955da820a7771358b4398fd7d168f8de7b8471838451e1a91283ae`;
  config `acbddc9527cae966cb702b9357010e9282d76349f6ea6f4e6b60a39a8f23db7f`.
  OCI revision matches the source above.
- Post-build schema dump and independent check used separate disposable
  containers. Both passed and cleaned up; the schema and 22 seed migrations
  were unchanged through `20261005_180000_ingestion_compatibility_fence.sql`.

The source SHA passed [CI run 37645419102](https://github.com/cloudbyday90/Classifarr/actions/runs/37645419102),
including build/tests, database tests, fresh installation/published upgrade and
the acceptance readout. OSV, Gitleaks, Trivy, CodeQL, copyright and resource-capacity
checks also passed. This is development-image evidence, not release approval.

## Open PR trial

Fresh enumeration found two open PRs. Random selection chose server
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Its exact manifest/lockfile change
was applied locally: Node declarations 24.19.1 to 26.6.4 and undici-types
7.24.6 to 8.9.0. Registry metadata and integrity matched the patch.

The runtime-major policy test passed 8/8 before the trial, failed 1/8 with the
candidate and passed 8/8 after reverting it. Newer declarations are not worth
allowing APIs absent from the pinned Node 24 runtime. The PR remains open and
unmerged. No installation, installed-candidate audit or candidate build is claimed.

The separate server outdated check found patch candidates for dotenv 18.0.6,
express-rate-limit 8.7.1 and js-yaml 5.4.3, plus Knip 6.40.0. Evaluate these in a
separate dependency batch; they are not part of this memory investigation.

## Local recovery point

Before overwriting the local tag, the previous running image
`sha256:fe5eb3f5db51922a76a20517b4bd79014ccba9bc9b08ce4311f41bbf2b5e88dd`
was pinned as `classifarr:pre-memory-39b3d0c0-71c5-4980-b149-986df5b41744`.
Backup `.tmp/pre-memory-fingerprint-39b3d0c0-71c5-4980-b149-986df5b41744.dump`
contains 75,558,343 bytes and passed checksum and archive-list checks. This is
not a restore rehearsal. Unraid and Harmoniarr are outside this deployment scope.

Immediately before replacement, a fresh 75,573,168-byte backup passed the same
checks: `.tmp/pre-memory-fingerprint-7d8dccd5-9948-4f40-91b9-7c0937a9d6e2.dump`.
Rollback tag `classifarr:pre-memory-7d8dccd5-9948-4f40-91b9-7c0937a9d6e2` pins the
same prior image. Only local Classifarr was recreated, preserving appdata/mounts,
UID 1000, read-only root, 2 GiB limit and security settings. Initial health and
background readiness were healthy/ready. Existing pressure warnings at 16:10 UTC
and earlier predate replacement; the last logged recovery was 16:13:52 UTC. This
diagnostic-only change does not claim to eliminate those warnings.

The five-minute observation completed with 19 healthy samples from 16:24:48 to
16:29:44 UTC. Raw container usage fell from 670.93 to 486.97 MiB; kernel high-water
was 921.27 MiB. OOMs, memory-limit hits and restart count were zero. Final read-only
checks found no new comparison warning in the bounded logs. Background readiness
was then `backfilling`, so this does not claim every local backfill has completed.
The diagnostic helper's memory-admission value describes its own short-lived
process, not the web daemon; it is not used as daemon heap evidence here.

## Measurements

The sampled project `classifarr-resource-study-9104d19379917010ad639643e567063b`
passed in 1,025,239 ms. Twenty waves and 210 scans completed all 5,776 items and
description vectors across ten libraries. Pending, failed, routing, handoff and
service-error counts were zero. One build and 32 reads completed; all ten workers
exited. Each consumer prepared/committed ten batches without error, and all 80
readiness groups cleared on stop. Health, OOM, limit-hit and cleanup checks passed.

Drain occurred at 625,669 ms. Comparison became ready at 692,417 ms and revalidated
at 1,025,006 ms; representatives published at 653,074 ms and were up to date at
1,011,504 ms. Both warm intervals exceeded five minutes. Queue work recorded 32
memory deferrals, but discovery recorded none: **this run does not prove a
discovery memory-pressure recovery**. No deadline or safeguard was changed.

### What the extra counters establish

| Successful warm window | Read/decode batches each | Rows decoded | Validation MiB | Parsing + assembly MiB | Database transport MiB | Total allocated MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Comparison, first independent check | 23 | 5,776 | 119.77 | 57.93 | 76.20 | 307.63 |
| Comparison, second independent check | 23 | 5,776 | 129.88 | 51.38 | 66.39 | 299.20 |
| Representative preparation | 103 | 11,552 | 268.19 | 96.73 | 130.32 | 643.72 |
| Representative, final independent check | 23 | 5,776 | 137.38 | 58.46 | 69.15 | 313.10 |

Each single pass covers 5,914,624 components and 65,014,954 encoded characters;
preparation covers exactly twice those totals. All four windows recorded zero
overlapping vector read/decode events. The comparison cost is not an accidental
extra decode hidden inside one check. Preparation first fingerprints the catalog,
then validates group centroids through its scoped reader: 23 catalog batches plus
80 membership-group batches. The final independent freshness check stays separate.

Validation is now the largest repeatedly observed cache-path category. The earlier
163–183 MiB coarse cache category included both it and parsing/assembly. Transport
is a separate material cost; it does not explain the coarse cache category itself.
The parser/assembly split varies markedly across two otherwise equal checks, so
report their combined value rather than interpreting optimized stack attribution
as exact Map-versus-native-parser ownership. Do not remove checks based on these
numbers. Both decoders and fingerprint helpers call the validator, so the aggregate
validation label is not a decoder-only invocation count. The cross-check below
reproduces the previously unexplained gap without changing the validator.

The periodic/phase sampler recorded peak main heap 434.57 MiB, process RSS 660.06 MiB, worker heap
199.89 MiB, raw container usage 1,029.76 MiB and kernel high-water 1,033.35 MiB.
There were 203 major-GC records across eleven isolates. Immediately after stop,
weak observations showed no live source snapshot, decoded-vector map, owned
source/vector generation or consumer batch. One comparison handle, two community
vectors, one verification-metadata object and two representative models remained
observable. Main heap was 229.46 MiB, RSS 473.40 MiB and raw container usage
797.85 MiB. No forced GC or long post-stop retainer observation was performed;
this is not proof that every historical object was collected.
Separate allocation-window boundaries observed main heap as high as 452.50 MiB;
the periodic sampler is not a continuous global high-water measurement.

A single bounded read-only count query checked the synthetic database during
the sampled run. The host was not otherwise idle. No real provider was contacted.

Interpretation follows the official
[DevTools HeapProfiler contract](https://chromedevtools.github.io/devtools-protocol/tot/HeapProfiler/),
discovered and checked on 2026-10-07: including objects collected by GC measures
temporary allocation as well as surviving objects. Component totals are
statistical cumulative allocation estimates, not simultaneous heap usage or a
retainer graph. Counter ownership follows scheduler context; allocation sampling
still includes the whole main isolate during each window. Worker heaps are not
attributed by that sampler. Raw container usage also includes PostgreSQL/cache.

## Natural-cycle control

Project `classifarr-resource-study-5bd6e3bf61edb69fca8e78ab1e7b83ca` passed on the
same image in 1,053,483 ms, with allocation sampling and counters disabled. All
5,776 items/vectors completed, with zero pending, failed, routing, handoff and
service-error counts. It performed 201 scans, four builds and 33 reads. All twelve
workers exited; each consumer prepared/committed nine batches, without errors or
pending work, and groups cleared from 80 to zero. Health, OOM, limit-hit and owned
resource cleanup checks passed. Independent inventory checks found no remaining
container, network or volume for either study project.

After drain at 620,634 ms, comparison became ready at 730,726 ms and revalidated
at 1,052,827 ms; representatives published at 681,918 ms and were up to date at
1,039,486 ms. Both real warm intervals exceeded five minutes. Ingestion recorded
nine memory deferrals and queue work 93; discovery recorded none. Thus neither
run establishes discovery pressure/recovery coverage, although both establish
complete catalog work and scheduled warm reuse under unchanged safeguards.

Natural-run sampled peaks were 649.16 MiB main heap, 815.87 MiB RSS, 204.86 MiB
worker heap, 1,190.64 MiB raw container usage and 1,196.09 MiB kernel high-water.
There were 155 major-GC records across thirteen isolates. Immediately after stop,
main heap was 386.51 MiB, RSS 623.36 MiB and raw container usage 967.59 MiB.
Weak observations again showed no source/decoded/owned generations or consumer
batches; one comparison handle, two community vectors, two verification-metadata
objects and two representative models remained observable. Sampling and natural
runs performed different build counts; these are not an optimization comparison
or a long-running leak/retainer proof.

## Explaining the isolated-decoder gap

Two short disposable, network-disabled probes used the same candidate image,
actual decoder, validator and fingerprint helper: UID 1000, read-only root and
probe mount, 2 GiB, two CPUs and 64 PIDs. Each measured 5,776 entries in repeated
256-row batches of 1,024-dimensional deterministic float32-compatible vectors,
with three rounds per operation. Counts/checksums matched. Conditioning occurs
outside sampling; measured rows remain unchanged. Neither probe changes
production functions, opens an inspector port or explicitly forces GC.

| Validator input history before the same decoder workload | Estimated decoder allocation MiB |
| --- | ---: |
| Parsed arrays in the mixed-history process | 44.35–51.40 |
| Array.from copies / zero-filled arrays populated with doubles | 33.25–48.37 |
| Null-filled arrays subsequently populated with the same doubles | 179.19–193.21 |
| Later integer-array conditioning in that same process | 177.74–190.77 |
| Fresh-process parsed-array control | 40.30–46.86 |
| After validating 512 structuredClone copies in that process | 163.67–198.24 |

The fresh structured-clone experiment is the most relevant reproduction: the
decoder's validation category rose from no sampled bytes to 118.81–152.39 MiB,
while the decoded input/count/checksum stayed the same. Adding the real
fingerprint helper to the benchmark did not create this jump before conditioning;
after clone conditioning that combined operation allocated 179.28–188.22 MiB.
Zero sampled bytes is not literally zero allocation, and optimized stack labels
can move between helpers.

This establishes **input-history-sensitive allocation in the shared validation
path**, sufficient to reproduce the full-workload/microbenchmark gap. It does not
prove a specific V8 deoptimization instruction or that every pressure warning has
this cause. A relevant real path exists: the representative worker posts its model
back, then coverage validation passes cloned centroids into this same validator.
[Node's worker documentation](https://github.com/nodejs/node/blob/main/doc/api/worker_threads.md),
discovered/opened on 2026-10-07, confirms structured-clone message semantics.
That path is a supported causal hypothesis, not direct instrumentation of the
exact first production array that changes optimizer behavior. Do not weaken
worker-result validation or replace cloning to hide the symptom.

## Recommendation stack

| Option | Benefit | Tradeoff / recommendation |
| --- | --- | --- |
| Optimize the validator's hot loop across parsed and cloned array histories | Targets the reproduced 120+ MiB temporary cost while retaining correctness | Requires differential malformed-input/error tests and full natural-cycle remeasurement; first priority |
| Replace JSON parsing or database transport | Could reduce a separate 50–80 MiB class of work | Larger compatibility/security surface and not the demonstrated history-sensitive gap; defer |
| Remove repeated validation/freshness checks or retain full decoded maps | Could reduce repeated work | Weakens integrity or increases retained memory; reject |
| Optimize community construction, then update dependency patches separately | Addresses other measured costs and maintenance needs | Keep separate from the validator experiment so results remain attributable |

Next: evaluate a small semantics-preserving validator-loop change against both
fresh and clone-conditioned callers, preserving own-property, dimensionality,
finite/nonzero and float32 overflow/underflow checks, exact values and error codes.
Retain independent freshness reads, worker-result checks and current memory/GC
policy. Accept a fix only after the bounded real workload reproduces its benefit.

## Evidence identifiers

Sanitized study results remain ignored intermediates in
`.tmp/resource-study/<project>/`. No raw heap profiles are written. SHA-256:

- Sampled receipt: `9c60b67d5cd13027c93f078eef07f682f8838792b96e772effa8a70ff764934a`.
- Sampled phase trace: `8e2c1b13fa6401fc09bd3a73476b58adacba123519bc682abf555153c3cb5b00`.
- Sampled GC trace: `c3934b00f4335bb859c65d08c5a8a3418fc0af8f72201371fa0a8440addc350d`.
- Natural receipt: `9d25af4cf7b876095920dfd2aeec7d6d95247dc1fef427975ccb674dabc377ed`.
- Natural phase trace: `ddfa5dc6fa3e2133b02e42d51db0b89564067fbcb50dd0fcc23ff3e8a2986300`.
- Natural GC trace: `06edd3177186e751d2f364360be35319c2a314abf6b6072de5bad382b5a16b56`.
- Mixed-history receipt: `b21528ccd020bfbe3d1c04751e254aaee819bd6df6faa8a4d02e552f7c776fcd`.
- Clone-history receipt: `736cc20a7d1c3b8803518a8d08926a16535a5154545f3fe47eea17660def905d`.

The local probe `.tmp/profile-vector-validation-history.mjs` was extended with
the fresh `clone` scenario after the mixed-history run. Its final source hash is
`1cdd7d06c9ee476e193920d012cc305f9549d3b1fea27f160016428f578b027a`;
the `clone` receipt uses that exact version. Construction-history labels describe
JavaScript operations, not a captured V8 internal element-kind/deoptimization trace.
