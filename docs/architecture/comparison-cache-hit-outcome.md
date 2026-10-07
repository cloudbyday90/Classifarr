# Streamed comparison cache-hit outcome

Implementation date: 2026-10-06. Design and official research:
[streamed cache-hit revalidation](comparison-cache-hit-design.md).

## Implementation

Commit `d1e41da09ae611ec1579edae476d6f7e2f2f5479` on `main` adds a warm-only
streamed fingerprint probe. An exact hit reuses the existing model without the
full decoded vector map or a new fit. A valid miss takes the normal full-read
path; an error does not. Cold/expired/degraded entries do not add a probe.

Both independent reads, complete-vector validation, configuration and revision
checks, provider verification, cancellation and final admission remain. The warm
probe's metadata is released before the next read. Corrupt warm vectors now
report `snapshot_read`, where validation actually happens, rather than the former
post-read `source_validation` stage. The fixed failure code is unchanged.

No schema, API, UI, migration, dependency, memory-budget, GC-policy or deployment
template changes. The recovery-change skill guided regression-first work and
kept the two-read publication contract intact.

## Local verification

- Regression-first run: 11 failures and three passes reproduced the full-read
  behavior before implementation.
- Final focused comparison/repository/lifetime tests: nine suites, 157 passes.
- Isolated PostgreSQL integration: two suites, nine passes. Real committed vector
  updates and deletions between the two warm transactions respectively invalidate
  publication or report incomplete coverage. Unchanged data revalidates without
  materialization or fitting. Existing batch-consistency and rollback tests pass.
- Full backend unit run: 1,729 suites; 53,740 passes and one Windows-only skip.
  Linux directory fsync, exclusive copying and preservation of the source were
  separately verified using the candidate image's actual module, without appdata.
- Backend lint, typecheck, development/production knip, copyright, static-import
  and Markdown checks passed. The inventory ownership gate passed with no
  baseline changes; it still reports unresolved legacy paths, not universal
  production writer compatibility.
- The restored runtime baseline passed all eight assertions.

The forced-GC weak-reference tests are isolated test processes, not production
behavior or evidence about natural RSS retention. They check the full-read/fit
and warm-probe metadata lifetimes. The image study uses natural collection only.

The [implementation CI run](https://github.com/cloudbyday90/Classifarr/actions/runs/37558706472)
passed for the exact implementation commit: backend/client tests and typechecks,
coverage ratchet, browser checks, image/schema/startup/shutdown/queue recovery,
database tests and fresh-install/published-upgrade checks. OSV, Trivy, CodeQL,
resource capacity, secret scanning and copyright workflows also passed.
Image publication/promotion and release-candidate jobs were skipped; no release
was created. Later documentation commits have their own checks and do not change
the tested runtime image's source revision.

## Random open PR trial

There were two open PRs: #555 and #556. Random selection chose
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`. Its exact client manifest and lockfile
changes were applied locally: `@types/node` 24.19.1 → 26.6.4 and `undici-types`
7.24.6 → 8.9.0. Registry metadata confirmed the candidate's dependency/integrity
and absence of lifecycle scripts.

The unchanged runtime-major gate produced seven passes and one expected failure:
Node 26 declarations do not match deployed Node 24.21.0. The trial was reverted
before dependency installation; it was not a successful installed build and is
not retained or merged. The dependency-update skill kept the existing assertion
and install policy unchanged. Current client outdated results also identify
PostCSS 8.5.29 and Vite 8.3.3 as separate patch-review candidates; TypeScript 7
remains a separate major-version decision.

## Candidate image

Local Compose was built with `--no-cache --require-provenance` from the clean
implementation commit using the pinned Node 24.21.0/npm 12.2.0 toolchain.

- Image/index: `sha256:a1ca5717da557b486777d0bb9b7a56fbf3ade166921a66f8490218f362044463`.
- Native manifest: `sha256:5a10684139da51dc753ae115480d84779489c5f2ae4a766bc7209041338a14a8`.
- Configuration: `sha256:d4d1d792ca4f1f48e1415e8c47bf739cdec6546c47828ab7501a757eed859aa0`.
- OCI revision: `d1e41da09ae611ec1579edae476d6f7e2f2f5479`.

Before overwriting the local tag, the exact previous image
`sha256:0921e890934899e86b1fda171efd2c7836fc3b03b38772316a9b064d09e68be8`
was pinned as `classifarr:pre-cache-hit-dc95faa` for rollback. The isolated numeric
GC parser probe passed with 44 major events from two sources; it retained neither
native addresses nor raw trace text.

## Scheduled catalog study

The exact image passed the isolated `comparison-catalog` bounded-budget study
with opt-in sanitized major-GC tracing. It ran for 1,015,049 ms (16m55.049s),
using real ingestion/metadata services, production refresh registrations and one
migrated synthetic application catalog. Providers/vectors and the schedule adapter
are fixtures: this is not production-capacity or model-accuracy evidence.

- Twenty waves, 209 scans, ten libraries/owners and 5,776 completed items.
  All 5,776 descriptions were cached. No pending/failed work, routing, handoffs or
  service errors remained. Work drained at 619,814 ms.
- Representative publication followed at 641,305 ms; comparison was ready at
  675,083 ms and revalidated at 1,014,225 ms, 339,142 ms later. There were six
  comparison build attempts and 17 reads overall. The final hit added two reads,
  both marked streamed, and no build.
- Seven workers were created and all seven exited. All admission classes ended
  with zero active jobs. One ingestion and 16 queue memory-pressure refusals
  occurred; discovery had nine admissions and no pressure refusal. Therefore
  `pressureRecoveryObserved` is false, not proof that comparison pressure recovery
  happened during this run. Existing safeguards did enforce workload deferrals.

Final unchanged comparison refresh, in MiB:

| Observation | Main heap used | V8 physical heap | Node RSS | Raw container |
| --- | ---: | ---: | ---: | ---: |
| Previous representative `up_to_date` result | 302.71 | 362.19 | 623.86 | 1000.30 |
| First streamed comparison read | 218.06 | 263.74 | 598.05 | 975.03 |
| Second streamed comparison read | 201.08 | 269.16 | 600.00 | 977.05 |
| Comparison `revalidated` | 187.79 | 269.47 | 599.98 | 975.54 |

The prior full-read/streamed-read run sampled 272.36/351.87 MiB heap at the two
comparison boundaries, versus 218.06/201.08 here. This is supportive observation,
**not a matched performance A/B or a general RSS reduction claim**: scheduling,
collection, scan counts, builds and workers differed. The deterministic evidence
is that the full vector-map read and new fit are absent on a validated hit.

Independent whole-run peaks were Node RSS 669.66 MiB, main heap 448.67 MiB,
worker heap 216.13 MiB, raw container 1060.14 MiB and kernel peak 1066.97 MiB.
These are higher than the prior study's peaks and must not be summed or hidden.
There were zero OOM kills or memory-limit hits. The trace contains 102 phase
records, with 91 complete and one partial resident observations.

Natural GC produced 135 major events across eight source tokens; the largest
source-local page pool was 272 MiB. The final source-1 event retained 219 MiB of
pooled pages. Pools remain real memory usage, not available admission headroom.
At revalidation, the observed full snapshots, decoded vectors and owned fitting
inputs were no longer live; one model handle, two community vectors and one
verification-metadata object were still visible through weak references. They
were also visible at the immediate post-stop sample. Without a later collection
this is not proof of a leak, nor proof that every retained object is gone.

Private evidence directory:
`.tmp/resource-study/classifarr-resource-study-bc5fbd6c83bd4584ca4714e5728f20c9/`.

- Phase trace SHA-256: `078e44ed60b8fa77a3a4091d8ad2578a5dc6c53b08e9d91d8fe6cd4e35f73823`.
- GC trace SHA-256: `e5a2ba94b74a908695e2549e159e841a8da0e6aec23e77079ffe6032ea152063`.
- Receipt SHA-256: `847deae025b985e423b8173c6d88852b816cc360b0ab42d61cba4d9d027811e4`.

Owned cleanup passed and empty project-label container, volume and network
inventories were independently checked. Only regenerable synthetic study data
was removed; the candidate/rollback images and private evidence remain.

## Local deployment and next item

A fresh 75,605,553-byte local database archive passed checksum and archive-list
checks (not a restore rehearsal). Exact rollback was verified before replacement,
also pinned as `classifarr:pre-memory-d2a0e3e4-f925-4f93-a272-dd4028534408`.
Local Classifarr was recreated without another build at 02:03:53 UTC on October 7.
The image ID matches the measured image; user `1000:1000`, read-only root,
no-new-privileges, 2 GiB limit and existing mounts remain unchanged.

The isolated schema dump and independent check passed through migration
`20261005_180000_ingestion_compatibility_fence.sql`, including 22 data seeds.
The tracked schema is unchanged, and both owned schema containers were removed.
An initial read-only local check reported background readiness `ready`; its
latest comparison warning preceded this container's start. The helper process's
own memory-admission reading is not a measurement of the running web daemon.

The five-minute observer completed with 19 healthy samples from 02:06:33 to
02:11:27 UTC on October 7. Raw container usage ranged from 854.77 to 897.11 MiB;
the kernel lifetime peak since recreation was 989.25 MiB. There were zero
memory-limit hits, OOM kills or restarts. A final bounded read-only log check
observed no comparison warning after the 02:03:53 restart; background readiness
was `backfilling` again. This is not proof of completed backfill, a locally
completed warm refresh or sustained memory stability.

Unraid and the unrelated Harmoniarr container were not changed. Production
`NODE_OPTIONS` remains `--max-old-space-size=1536`, without diagnostic trace or
forced-GC flags. The private backup, image pins and evidence were retained.

## Recommendation stack

1. Keep the streamed comparison hit path: it removes the proven unnecessary
   full map while preserving both fresh reads. Cost: one extra bounded read on a
   valid warm miss, with no extra probe for cold/expired/degraded entries.
2. Next investigate **representative-profile up-to-date revalidation**. In this
   run its two full reads sampled 307.22/307.02 MiB heap immediately before the
   final comparison hit. `inventoryRepresentativeCandidate.mjs` materializes
   vectors before its cache lookup, and `inventoryRepresentativeProfileRefresh.mjs`
   performs another full read for verification. Do not copy the comparison reader
   blindly: representative profiles allow partial vector coverage and supply
   snapshot-dependent observer/neighborhood-backfill consumers. Design an exact,
   bounded verification contract for those consumers, then add equivalence/race
   tests and repeat the study before claiming a memory benefit.
3. Keep admission, retry, TTL, corruption and publication safeguards unchanged.
   Do not tune allocators or force production GC from these single-run peaks.
4. Review PostCSS/Vite patches separately; retain Node 24 declarations until a
   deliberate runtime-major migration.

No release, tag, version bump, PR merge or new branch.
