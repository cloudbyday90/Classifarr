# Streamed representative-profile verification outcome

Implementation date: 2026-10-07. See the
[design, official research and tradeoffs](representative-verification-design.md).

## Implemented

Representative refresh keeps its full fitting/sidecar-preparation read, but its
independent publication verification now streams bounded batches into the same
private v4 fingerprint. Missing vectors remain valid partial evidence; malformed
present vectors still fail. The verification result contains no vector map.

Fresh corpus, novelty identities and observation-readiness metadata still reach
the staged consumers. Provider/configuration/revision checks, final admission,
cancellation, partial-coverage rules, backfill priorities and retry budgets are
unchanged. The recovery-change skill guided the narrow two-read contract and
regression-first tests. No schema, UI, API, deployment or GC-policy changes.

## Local verification

- Regression-first repository run: three new failures and ten existing passes.
- Focused representative/recovery/lifetime tests: 16 suites, 219 passes.
- Real PostgreSQL integration: two suites, 22 passes. Includes updates, deletions
  and backfilled vectors between independent reads; batch-snapshot consistency,
  cancellation rollback and actual neighborhood/backfill consumers.
- Lint, typecheck, development/production dependency checks, copyright, static
  imports and Markdown checks passed.
- Initial full backend run: 1,729 passing suites and one failed ownership gate;
  53,786 passing tests, one failed assertion and one Windows-only skip. The failure
  required review of the changed repository file, not relaxing an assertion.
  After review, only its source digest changed; the analysis/classification and
  SQL authority are unchanged. All 39 ownership tests and the gate now pass.
  The complete rerun passed: 1,730 suites, 53,787 tests and the one Windows-only
  skip, in 303.919 seconds.

Forced GC is confined to isolated lifetime-test subprocesses. Image profiling
uses natural collection. The Linux candidate-image check separately passed
directory fsync, exclusive copy and source-preservation assertions using the
actual image module, without network access or appdata.

The [implementation CI run](https://github.com/cloudbyday90/Classifarr/actions/runs/37602248367)
passed for the exact implementation commit: build/tests, database integration,
fresh installation/published upgrade and release acceptance readout. OSV, Trivy,
CodeQL, resource capacity, secrets and copyright workflows also passed. Image
publication/promotion and release-candidate jobs were skipped; no release occurred.

## Random PR trial

The two open PRs were #555 and #556. Random selection chose
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable head
`5545605b53c854de8847b44e24fa083ff4218080`. Its exact client manifest/lock changes
were applied: `@types/node` 24.19.1 → 26.6.4 and `undici-types` 7.24.6 → 8.9.0.
Registry metadata confirmed the integrity, dependency and empty script/peer sets.

The unchanged runtime gate returned seven passes and one failure because Node 26
declarations do not match deployed Node 24.21.0. The trial was reverted before
installation; the restored gate passes all eight assertions. No installed-build
or audit claim is made for the rejected candidate; no dependency change or PR
merge is retained. The dependency-update skill preserved that compatibility gate.
Fresh client outdated results also list PostCSS 8.5.29 and Vite 8.3.3 patch updates;
those remain separate reviews.

## Candidate image and schema

Implementation commit `fc9ec82fe1fc5487b176727b0109f428663c3218` was committed and
pushed on `main`. Local Compose was built from that clean checkout with
`--no-cache --require-provenance` and pinned Node 24.21.0/npm 12.2.0.

- Image/index: `sha256:28ea0ae1572355d2b7708bdb30784d04ad418141658d816eda777dce6dcc30a2`.
- Native manifest: `sha256:5454eb75303ce6f5c5a29fc9d9ba4cafb0aa3979f81deda219a0e1a9d8245780`.
- Configuration: `sha256:942839aa6c27846ca57de987d5f31a82ad29e80f39351df7663b7a3f9233db2b`.
- OCI revision matches the implementation commit.

The exact prior image `sha256:a1ca5717da557b486777d0bb9b7a56fbf3ade166921a66f8490218f362044463`
was pinned as `classifarr:pre-representative-verification-d1e41da0` before its
mutable tag was replaced. The post-build isolated schema dump and independent
check both passed through `20261005_180000_ingestion_compatibility_fence.sql`,
including 22 data seeds. The tracked schema stayed unchanged; both owned schema
containers were removed and the empty label inventory was checked.

## Scheduled catalog study

The exact candidate image passed the isolated bounded `comparison-catalog` study
with sanitized major-GC tracing. Duration was 1,012,327 ms (16m52.327s), with real
ingestion/metadata services, a migrated synthetic catalog and production schedule
registrations. Providers, vectors and the schedule adapter are fixtures. The
catalog refresher omits the optional shadow/neighborhood sidecars; their behavior
is covered by focused and real-PostgreSQL tests, not by these image memory numbers.
This is not full-daemon capacity, production-provider or model-accuracy evidence.

- Twenty waves, 210 scans, ten libraries/owners and 5,776 completed items. All
  5,776 descriptions were cached; pending/failed work, routing, handoffs and
  service errors were zero. Drain completed at 620,445 ms.
- Representative publication followed at 638,556 ms; comparison was ready at
  672,562 ms and revalidated at 1,011,289 ms, 338,727 ms later.
- There were 21 reads and eight comparison builds. The final representative
  `up_to_date` attempt made one full read and one streamed verification, without
  refitting. The final comparison hit retained its two streamed reads.
- All nine workers exited; active workers and all admission classes ended at
  zero. Queue work experienced 19 memory-pressure refusals. Ingestion and discovery
  had none, so `pressureRecoveryObserved` is false: completion does not establish
  that comparison recovered from pressure in this run.

Final unchanged representative attempt, in MiB:

| Observation | Main heap used | V8 physical heap | Node RSS | Raw container |
| --- | ---: | ---: | ---: | ---: |
| First, full read | 271.60 | 337.07 | 456.58 | 828.16 |
| Second, streamed verification | 346.37 | 394.04 | 510.62 | 883.09 |
| Representative `up_to_date` | 348.35 | 394.04 | 512.21 | 884.38 |
| Following comparison `revalidated` | 172.43 | 260.96 | 510.18 | 882.13 |

The preceding run sampled 307.22/307.02 MiB heap at the two representative reads.
This run's streamed second-read heap sample is **higher**, not lower. Independent
whole-run peaks were RSS 667.25 MiB, main heap 402.44 MiB, worker heap 207.48 MiB,
raw container 1050.41 MiB and kernel peak 1053.71 MiB; the preceding peaks were
669.66/448.67/216.13/1060.14/1066.97 MiB respectively. Do not add these independent
peaks or interpret their differences as a matched A/B: scheduling, scans, builds,
workers and collection differed. The established benefit is eliminating the
second materialized map, **not a demonstrated general RSS or peak-memory fix**.

There were zero OOM kills or memory-limit hits. The trace has 120 phase records,
101 complete and seven partial resident observations. Natural major GC produced
132 events across ten source tokens; the largest source-local page pool was
273 MiB, and the final source-1 event reported 138 MiB. These pools remain real
memory use and are not subtracted from admission accounting.

At representative completion, weak references still observed one full snapshot
and one decoded vector. By the following comparison completion both were gone,
as were owned fitting inputs. A model handle, two community vectors and one
verification metadata object remained observable at the immediate stop sample.
This distinguishes delayed natural collection from a proven strong-reference
leak; it does not prove every object was collected after shutdown.

Private evidence: `.tmp/resource-study/classifarr-resource-study-5a479b421f2b488c1f6656d15a574e6f/`.

- Phase trace SHA-256: `e10bc108639d887969ec65d9da8ddf160697bfeb98558119d9006e79d9a1189f`.
- GC trace SHA-256: `db99f02a2c01a6232d34154159c2670a7ab8ebd949fc1fdc777a3caf2610f151`.
- Receipt SHA-256: `79608a8d2a790b5495b8ecf323e4aaf225143a6d3a64873eb971d3cef23840dd`.

Owned cleanup passed; empty container, volume and network inventories were
independently checked. Only regenerable synthetic study data was removed.

## Local deployment

A fresh 75,563,399-byte local database archive passed checksum and archive-list
checks (not a restore rehearsal). Exact rollback was verified and separately
pinned as `classifarr:pre-memory-fb32150a-b2fa-4107-ac95-e627ad0a6ee6`.
Local Classifarr was recreated without another build at 10:05:26.910 UTC. Its
image matches the measured candidate; user `1000:1000`, read-only root, existing
mounts, no-new-privileges and 2 GiB memory limit remain unchanged.

The five-minute observer produced 19 healthy samples from 10:05:51.330 through
10:10:47.926 UTC. Raw container usage ranged from 317.95 to 1053.59 MiB, ending at
350.89 MiB; the kernel lifetime peak since recreation was 1066.09 MiB. There were
zero restarts, OOM kills or memory-limit hits. These are short-run observations,
not sustained stability or a matched improvement claim.

Initial and final bounded read-only checks found the latest comparison warning
at 09:58:45 UTC, before this restart. The only observed post-restart comparison
event was waiting for other background work at 10:06:45; readiness remained
`backfilling`. This does not prove completed backfill or a completed local warm
refresh. The diagnostic helper's own memory-admission reading is not a measurement
of the web daemon and is not used as such.

Production `NODE_OPTIONS` remains `--max-old-space-size=1536`, without forced-GC or
trace flags. The backup and rollback image pins are retained. Unraid and the
unrelated Harmoniarr deployment were not changed. Later documentation commits
do not change the tested runtime image's source revision.

## Next item

1. Keep the bounded second verification: same digest and freshness checks, no
   second full map. Cost: all vectors still require transport/validation; corpus
   metadata and the first full read remain.
2. Next add the real optional shadow/neighborhood sidecars to the isolated catalog
   profiler and attribute first-read/sidecar allocations across matched cycles.
   This fills a measurement gap before deciding whether a warm-only first-read
   optimization is justified. Removing that read now would require a separate
   validated consumer contract and could weaken backfill or geometry validation.
3. Keep admission and GC behavior unchanged. The mixed measurements do not justify
   tuning limits or declaring the reported memory-pressure problem fully solved.
4. Review PostCSS/Vite patch updates separately; keep Node 24 declarations aligned
   with the deployed runtime.

No release, tag, version bump or new branch.
