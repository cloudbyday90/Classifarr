# Comparison fingerprint allocation outcome

Date: 2026-10-06. Status: implementation and rebuilt local image validated;
memory-pressure deferral remains reproducible. No release is created.

## Measured result

The [design](comparison-fingerprint-allocation-design.md) addresses one confirmed
allocation hot spot, not every cause of container memory pressure. A new ESM
fingerprint helper replaces per-vector JSON serialization with one reusable
float64 little-endian buffer. Existing input, ownership and refresh safeguards
remain in place.

Two baseline and two candidate runs used the same published Linux image
`sha256:bdb21b21de8b4cdbac94d983094defbfb91c0d6d83bdf0a45db41a3ccc342d44`,
Node 24.21.0, a 2 GiB container limit, two CPUs, 64 PIDs, 1,536 MiB V8 old-space
limit and a private PostgreSQL cluster in 512 MiB tmpfs. Each ran two real vector
reads plus two fingerprints over 5,771 synthetic 1,024-dimensional vectors.

| Measurement | Baseline runs | Candidate runs |
| --- | --- | --- |
| `prepareSource` sampled self-allocation | 127.36 / 129.11 MiB | Below top-20 allocation sites |
| New binary helper sampled self-allocation | Not applicable | 6.78 / 7.73 MiB |
| Binary-write helper sampled allocation | Not applicable | 2.00 / 2.00 MiB |
| Node peak RSS, including stage observations | 319.37 / 321.80 MiB | 314.97 / 316.85 MiB |
| Final stage heap used | 197.37 / 199.15 MiB | 193.03 / 192.73 MiB |

Allocation sampling included objects collected by minor and major GC. These are
statistical cumulative allocations, **not retained heap or a leak measurement**.
Sorting and metadata processing still allocate. The limited peak RSS improvement
does not justify claiming that the warning is eliminated.

The study deliberately used read-only source mounts over the fixed image; it is
an allocation experiment, **not** candidate-image or release evidence. Metadata
queries returned synthetic catalog/state rows while vector reads used PostgreSQL
and node-postgres. No fit workers, provider calls, live data, credentials or open
debugger ports were involved. Containers were disposable and network-disabled;
only aggregate stage/profile summaries were exported to ignored `.tmp` files.

## Verification

- 13 focused backend suites / 145 tests passed, including exact identity, signed
  zero, sub-float32 differences, byte order, buffer reuse, invalid inputs,
  snapshot revalidation, holdouts and refresh behavior.
- Both repository snapshots generated the same key in all four isolated runs.
- The randomly selected [PR #555 trial](node-types-pr555-outcome.md) failed the
  existing Node-major compatibility gate. Its changes were restored, not merged
  or retained. Dependency manifests and lockfiles remain unchanged.
- Full backend coverage run: 1,711 suites passed, 53,273 tests passed. The single
  Windows skip is the Linux directory-fsync case in `embeddedMigrationTree`.
  Its complete-copy, unchanged-source and exclusive-target assertions passed
  separately against the candidate image's actual module in a network-disabled
  Linux container. Attempting Jest with Windows-mounted dependencies first failed
  module resolution; the native-assert replay is not claimed as a Jest suite run.
- Full client coverage run: 443 suites / 6,409 tests passed.
- Real PostgreSQL integration: three suites / 32 tests passed, covering vector
  cache, description refresh and live inventory retrieval.
- Lint, both type-checking passes, Knip (regular and production), ESM import and
  strict mock-shape checks, migration checks, copyright and Markdown checks passed.
- Coverage ratchet passed without changing its baseline: server lines 89.81%,
  branches 85.65%; client lines 88.78%, branches 80.37%.

## Candidate image and local replacement

Source commit: `f225b3689f35cf65a363b4ed7024a895b6ebc21f`, clean `main` checkout.
Built with Compose `build --no-cache --require-provenance`, native amd64/AVX2.

- Local image: `classifarr:memory-fingerprint-local`.
- Image/index ID: `sha256:c4ea0c852c8dead20c848ffccfea066a4ee2cd821be625d1fe6363a7351cd293`.
- Native manifest: `sha256:2527edc8172206d144cb1194127dcbcf7f5acfa22fb655f7a93f407f9dd904f0`.
- Image config: `sha256:54d1dd19ee06ae116b7f852411ea2c56362040550470ae48b114fcf83571c6f9`.
- Replacement started: 2026-10-06 10:55:29 UTC.

The Compose override changes only the local image name. Environment values,
UID/GID, app-data/media mounts and the 2 GiB limit were preserved. Compose has no
hard CPU quota; existing application concurrency/admission controls remain in
effect. The separate Unraid deployment was not modified.

A 75,699,059-byte custom-format local database backup was checksum-verified and
validated with `pg_restore --list`; the previous image has a local rollback tag.
This verifies archive readability, not a full restore rehearsal. Inventory count
was 5,807 and migration count 323 immediately before and after replacement; no
pending/processing queue work was present at the replacement check.

After rebuilding, the authoritative schema was dumped from a disposable
candidate-image database, then independently checked in another disposable
database. Both passed with **no change** to `database/schema/current.sql`.
Both containers and their dedicated temporary directories were cleaned up.

A fifth allocation run used the built candidate's actual modules, without a
source overlay. Matching snapshots produced matching keys; peak Node RSS was
313.52 MiB, with 7.83 MiB sampled self-allocation in the binary helper. This is
still a synthetic function-level study, not a full workload capacity guarantee.

The local browser reproduced the supplied RAG error on the old image, then
displayed 6,811 embeddings, zero pending and populated provider/backfill sections
on the candidate after reload. No provider action buttons were used.

## Runtime observation and remaining limitation

A bounded 20-minute sampler collected 73 observations from 10:56:49 to 11:16:37
UTC, pinned to the replacement container. Raw cgroup usage ranged from 371.99 to
1,216.68 MiB; its kernel high-water mark was 1,223.30 MiB. CPU peaked at 202.07%
(approximately two cores), and Docker's PID count ranged from 43 to 48. Every
sample was healthy, with zero OOM events and zero cgroup memory-limit failures.
The final inspection also showed zero container restarts. This short window
showed no unbounded process growth; it is not a sustained capacity qualification.

The scheduled backfill continued without intervention. All ten libraries had
completed import and metadata backfill markers by the later checks. Comparison
temporarily reported `cached_vectors_incomplete` at 11:05:47, then recovered at
11:08:24 after the missing embeddings became available. Representative-profile
publication at 11:11:43 reported 5,776 available vectors and none missing.

**The original memory-pressure condition was not eliminated.** At 11:13:45,
comparison deferred again with `memory_pressure`. Its logged Node RSS was
786.69 MiB, versus 227.93 MiB heap used, 243.36 MiB heap total and 6.27 MiB
external memory. These measurements are not interchangeable; the gap does not
by itself establish a JavaScript leak, allocator fragmentation or a worker leak.
The optional job recovered automatically at 11:17:08, after the sampler ended.
A subsequent final spot-check showed raw cgroup usage of 1,391.26 MiB (1.359 GiB)
and a kernel peak of 1,412.36 MiB (1.379 GiB), still under the unchanged 2 GiB limit.

The application remained healthy and ordinary retrieval stayed available, but
the recurring deferral and increased resident usage require further measurement.
No forced GC, live heap dump, raised limit, disabled guard or manual recovery was
used. This amd64 local evaluation does not qualify Unraid, ARM or a release soak.

## Recommendation stack

1. Retain the bounded fingerprint change and unchanged admission safeguards.
2. Profile allocation **and retention across the whole refresh**, including worker
   lifecycle, snapshot ownership copies, caches, vector reads and decoding. Track
   main-thread heap, worker/process RSS and raw cgroup memory separately across
   repeated cycles. The RSS/heap gap makes a decoder-only diagnosis premature.
3. Use that evidence to select a bounded transport/decoding or retention change.
   JSON decoding still accounted for roughly 89–93 MiB of cumulative sampled
   allocation in the isolated study, with additional PostgreSQL protocol and
   buffer-to-string allocations. Bounded batches may help, but must preserve
   transaction bounds, ownership and fresh-snapshot checks.
4. Repeat the same-image workload evaluation after the next scoped change. Do not
   increase memory limits or suppress warnings to hide the remaining work.
