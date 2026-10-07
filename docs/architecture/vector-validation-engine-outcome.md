# Inventory vector validation outcome

Date: 2026-10-07. See the [design and official sources](vector-validation-engine-design.md).

Decision: keep the narrow fix. Warm comparison allocation improved about 36–42%
in matched sampled reads; overall peak memory did not materially improve. Both
complete catalog controls passed without changing memory or security safeguards.

## Cause and implementation

The pinned Node 24.21.0 / V8 13.6.233.17-node.53 reproduction showed a whole-array
elements transition in optimized validation: parsed double arrays were converted
to a tagged, hole-capable representation after the same validator saw cloned
arrays. Generated IR and machine code corroborated the transition. There were
two actual validator deoptimizations, not a repeated deoptimization storm.
This explains the reproduced temporary allocation; it does not establish that
every memory-pressure warning has this cause or that the process leaks memory.

The candidate gives inventory decoding and both fingerprint readers a distinct
small validation function. It does not trust cached input: each call still checks
shape, dimensions, own entries, finite/nonzero float32 representability and the
original observable read/error order. Numeric values, signed zero and object
identity are unchanged. No decoded-vector cache, schema change, new background
work, runtime flag or larger memory allowance is introduced. Admission, retry,
freshness and ownership checks are unchanged.
Existing Compose and Unraid templates need no new mount, service or setting.

Two equivalent loop bodies are intentional. A factory retained shared feedback;
per-number helper extraction increased allocation in the parsed control. The
dimension ceiling/error constructor are shared, and both loops run the same
adversarial semantic suite plus deterministic differential cases. Profiler labels
include the new boundary so an attribution shift cannot hide its allocation.

## Verification before image evaluation

- Full backend: 1,741 suites, 54,060 tests passed, one platform-specific skip,
  365.401 seconds. Final focused checks: 21 suites, 276 tests passed.
- Isolated PostgreSQL: two suites, 19 tests passed; no local/Unraid database used.
- Server lint/type check, full/production Knip, static imports, copyright,
  ownership baseline, npm CLI and Markdown gates passed. No baseline was relaxed.
- Baseline running image pinned as `classifarr:pre-vector-engine-study` before
  rebuilding the development tag. Existing local data and Unraid are untouched
  during the isolated measurements.

## PR trial

Fresh enumeration found two open PRs. Random selection chose server
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Its exact manifest/lockfile diff changes
Node types from 24.19.1 to 26.6.4 and undici-types from 7.24.6 to 8.9.0. Registry
metadata and integrity values matched. The runtime-major gate passed 8/8 before,
failed 1/8 with the trial, and passed 8/8 after reverting. No candidate install,
candidate dependency audit, merge or Node runtime upgrade is claimed.

## Image evaluation

Source commit: `945b3f6ecad033f7f22dcfa6ba8817161ef8a931`. The no-cache local Compose
build produced image
`sha256:7aafbc29184c78b4e973894bc558e464219e6070a0e6b4c48e84ac96dc98e92a`;
its OCI revision matches. The baseline is
`sha256:16d37021966c27192c7c1aa98af448d169f160db2c7cdb013f64bfe9ccd9944f`.

Actual-module probes ran sequentially with tracing disabled, identical fixed
synthetic input and the same 2 GiB/two-CPU/128-PID limits. Each image passed all
12 windows, count/checksum/fingerprint equivalence and resource continuity.

| General-validator conditioning | Operation | Baseline MiB | Candidate MiB |
| --- | --- | ---: | ---: |
| Parsed arrays | Decode | 40.31–44.34 | 43.33–44.84 |
| Parsed arrays | Decode and fingerprint | 54.37–59.44 | 45.81–49.34 |
| Structured-cloned arrays | Decode | 180.69–198.30 | 45.35–51.90 |
| Structured-cloned arrays | Decode and fingerprint | 183.74–188.22 | 38.75–61.93 |

These ranges are three cumulative statistical allocation estimates, not peak or
retained memory and not precise speedup estimates. The inventory input remains
parsed in both conditions. Arbitrary mixed histories within the inventory-only
function are not covered by this claim. A separate filtered candidate IR trace
compiled `validateInventoryVector` without the demonstrated elements transition.
Traced timing is excluded from the comparison; no production flags changed.

Schema dump and independent schema verification used separate disposable
containers from the exact candidate image. Both passed and cleaned up; the tracked
schema is unchanged. The Linux image also passed the directory-fsync/exclusive
copy check skipped on Windows, including unchanged-source and existing-target
refusal assertions. This is a filesystem check, not a restore rehearsal.

### Complete sampled catalog

Project `classifarr-resource-study-94c0881cfcb392b5705e19dd8937ed0f` passed in
1,063,611 ms. All 5,776 items and description vectors completed; pending, failed,
routing, handoff and service-error counts were zero. There were 30 reads/two builds,
10 worker creations/exits and zero remaining workers. Consumers and admissions
drained, both workers completed real warm refresh intervals, and owned resources
were removed. No forced GC, OOM kill or memory-limit hit occurred. This run did
not observe pressure recovery; it proves normal completion, not a recovery case.

The comparison uses prior receipt
`classifarr-resource-study-9104d19379917010ad639643e567063b`, image
`sha256:797b3347423babba64e02b4fad977929b7927b40c1b3d9479d00fd69a198be89`.
Its runtime was identical to the micro baseline; intervening commits added only
the diagnostic, tests and documentation. These are separate runs, not matched
whole-process starting states. Each paired warm window has identical row,
component, encoded-character and batch counts and zero overlapping vector reads.

| Warm phase | Rows read | Baseline allocation MiB | Candidate allocation MiB |
| --- | ---: | ---: | ---: |
| Representative preparation | 11,552 | 643.72 | 592.18 |
| Representative verification | 5,776 | 313.10 | 278.97 |
| Comparison verification, first pass | 5,776 | 307.63 | 197.02 |
| Comparison verification, second pass | 5,776 | 299.20 | 174.28 |

The comparison reads improved by about 36–42%; representative processing improved
less (about 8–11%). Attribution also moved: the representative fingerprint and
membership-check frames remain large. Do not describe a missing validator sample
as zero total allocation. This is evidence for the narrow inventory-boundary fix,
not a claim that every validation-related allocation is removed.

Whole-run sampled peaks did **not** improve: main heap 458.84 MiB, process RSS
682.16 MiB, kernel container peak 1,049.97 MiB, versus 434.57/660.06/1,033.35 MiB
previously. The candidate built twice versus once in that control, so these peaks
do not isolate the change's effect. The final sampled observation had zero weakly
observed input snapshots/decoded vectors/owned sources, but still saw one comparison
handle, two representative models and some related objects. Without forced GC,
those remaining observations do not distinguish uncollected objects from strong
retention. Worker exit and consumer/cache cleanup are separate evidence.

Sampled receipt SHA-256:
`b9deec81da6ad8e5f5bd7ea9f3633359f3b378ba1296b78656d47f4b31455504`.

### Natural control

Project `classifarr-resource-study-e52c3dc5d3b71b6be6d20b4290ef78f0` passed in
1,173,150 ms with allocation sampling disabled. Major-GC event logging and bounded
numeric observers remained enabled; garbage collection was not forced. All 5,776
items/vectors completed with zero pending, failed or service-error rows. There
were 29 reads/four builds, 11 worker creations/exits and zero remaining workers.
Both consumer paths prepared/committed eight batches; pending work was zero and
their 80 readiness groups cleared on stop. Existing memory admission deferred and
subsequently recovered naturally. No OOM/limit hit occurred; cleanup passed.

Main-heap/RSS/kernel-container peaks were 619.75/786.82/1,154.98 MiB. The recent
natural baseline on image `16d37021` recorded 626.87/789.33/1,196.13 MiB with the
same 29 reads/four builds. Those small peak differences are not evidence of a
material peak-memory improvement. The final natural sample still observed one
comparison handle, two representative models, two community vectors and two
verification-metadata objects; observed input snapshots/vectors/owned sources
were zero. No claim is made that all models were collected or all leaks excluded.

Natural receipt SHA-256:
`96c0245a5bbf3a2dd4ea4d1fb613c5cfb5ae9593d22bfa60604b1cbd74436fc1`.
### Local replacement

The local test database was backed up to
`.tmp/pre-memory-fingerprint-7a61c7bf-2593-4661-ad7b-456acfacddef.dump`
(75,567,085 bytes), with matching checksum and a successful archive-list check.
This is not a restore rehearsal. The exact old image is retained as
`classifarr:pre-memory-7a61c7bf-2593-4661-ad7b-456acfacddef`.
Only the verified local Compose project was recreated, preserving appdata/media
mounts, UID/GID 1000, read-only root, no-new-privileges and the 2 GiB limit.
Container `33f3faa934e5e0deaf398a1e42ad466f9b24293d993d8bb01f4c3ff5692a7afa`
runs the exact candidate image/revision and became healthy. The initial read-only
database check reported library readiness `ready`; all returned comparison warnings
predated replacement. Unraid and the other local application were not changed.
The five-minute observation collected 19 healthy samples, with zero OOM kills or
memory-limit hits. Sampled raw cgroup usage was 516.29–856.76 MiB; the kernel peak
was 897.11 MiB. This includes PostgreSQL and other container memory, not just V8.
The read-only helper's own-process admission sample was not used as daemon-heap
evidence. During the observation a normal import/backfill handoff occurred:
all ten active libraries had complete imports, while three awaited metadata
backfill completion and no due queue tasks remained. The next scheduled pass
completed the handoff: the 19:10 UTC read-only check reported `ready`, with no new
comparison warning since replacement. No manual recovery or budget change was
used. No sustained-soak or Unraid-runtime claim is made.

Micro/engine evidence SHA-256:

- Baseline IR: `b0b08708852dbd22e750f7bf10a47d07487a92c385153a0a5f5ed5c62c82b7c1`.
- Candidate IR: `bab18189367788b15042034f1bc92286ff08fd22571bf44be5c11b945bbb834b`.
- Baseline micro receipt: `503cba7440bc97214bdc790ea7e5b43c96d9b115d7e873719555cc95f3321a94`.
- Candidate micro receipt: `ffa4e927742f91a5d6be8ca2443b561ce45d1e7ac5695e44f261480f200b0187`.

## Recommendation stack

1. Keep this narrow isolation: actual-image and matched full-cycle warm reads
   improved, and the natural control passed. Benefit: removes the identified
   cross-boundary feedback without weaker checks. Cost: a deliberately duplicated
   small loop and engine-specific
   evidence that must be rechecked when updating Node.
2. Keep natural cycles alongside cumulative allocation sampling. Benefit:
   distinguishes temporary churn from retention and observer effects. Cost:
   complete refresh intervals make these checks slower than unit tests.
3. Next, extend bounded post-stop observation through a naturally occurring major
   collection to distinguish the remaining model/cache references from objects
   simply awaiting collection. If no such collection occurs within the deadline,
   report that limit; do not force GC or infer a leak.
4. Then isolate remaining representative membership/fingerprint allocation in a
   bounded reproduction. The sampled warm preparation attributed about 180 MiB to
   membership checks and 94 MiB to fingerprints; verification attributed about
   99 MiB to fingerprints. These labels are hypotheses about cost, not proven
   allocation instructions. Investigate before another production rewrite.
   Do not bypass memory safeguards or infer a leak from RSS alone.

For a possible transport follow-up, the current cache query explicitly requests
`embedding::text`, then parses that text. Official [node-postgres type
documentation](https://node-postgres.com/features/types) and [query-scoped
parsers](https://node-postgres.com/features/queries) explain the supported parsing
boundaries; [pgvector-node](https://github.com/pgvector/pgvector-node) documents its
Node integration. These sources were discovered and opened on 2026-10-07. They do
not establish that replacing our parser will save memory. A separate experiment
must preserve cancellation, size bounds and fingerprint/numeric semantics; a
binary float32 value and a decimal text value can produce different float64
fingerprints. No parser, driver or storage representation change is included here.

The recovery-change skill required evidence before implementation and separate
design/outcome records. The dependency-update skill kept the random PR trial
subject to the actual Node runtime contract. No release is part of this work.

## Source CI

[CI run 37666520197](https://github.com/cloudbyday90/Classifarr/actions/runs/37666520197)
passed for source `945b3f6e`: Build and Test, Tests with Database, Fresh Install and
Published Upgrade, and Release Acceptance Readout. OSV, Trivy, Gitleaks, CodeQL,
Resource Capacity Regression and copyright checks also passed. Image publication,
promotion and release jobs were skipped as expected; this is not a release or
permission to publish. The outcome documentation is a later, runtime-unchanged
commit and does not change which source/image the measurements cover.
