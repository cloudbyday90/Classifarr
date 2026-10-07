# Comparison GC page-pool outcome

Date: 2026-10-06 local / October 7 UTC.
Design: [page-pool attribution](comparison-gc-pool-design.md).

## Implementation and initial checks

The isolated catalog study can now opt into bounded major-GC tracing. Numeric
source tokens and phase brackets preserve attribution without storing native
addresses, process IDs, arbitrary causes or provider payloads. Missing or malformed
requested telemetry prevents an accepted study receipt. Production GC behavior,
worker lifetimes, memory admission and recovery safeguards are unchanged.

Focused parser, launcher, trace and study tests: 122 passed. Server lint/typecheck,
both dependency checks, copyright, static-import, ESM mock-shape and Markdown checks
passed. Host-script lint has no errors; its seven warnings concern bounded generated
artifact paths, including the existing saves. The first full suite passed 53,715
tests but flagged the two changed launchers' ownership-review digests (one failure,
one Linux-only skip). Reviewed their unchanged database targets/cleanup and the
new diagnostic-only flag/parser boundary, then updated only those review hashes
and rationale. The ownership suite then passed all 39 tests. The complete rerun
is recorded below.

A non-root, read-only, no-network probe of the pinned image emitted 47 valid major
collections from two source tokens, with a maximum 44 MiB local pool. The host
parser accepted all events without persisting raw identities. This verifies the
actual runtime format and worker-event handling, not the catalog retention cause.
Final image, local health and schema results follow below.

## Random PR trial

Random selection from the current open PRs chose [#555](https://github.com/cloudbyday90/Classifarr/pull/555),
head `5545605b53c854de8847b44e24fa083ff4218080`. Applied its exact manifest/lockfile
diff locally: client Node typings 24.19.1 to 26.6.4, undici-types 7.24.6 to 8.9.0.
The existing runtime-major policy failed as expected (7 passed, 1 failed): Node 26
declarations do not match the pinned Node 24 runtime. Reverted only that trial;
the unchanged gate then passed all 8 tests. No dependency installation, retained
dependency change, PR merge or gate weakening.

## Final code and image checks

The full rerun passed 1,728 suites / 53,716 tests, with one Windows-only Linux-fsync
skip. The corresponding directory-fsync, exclusive-copy and unchanged-source
assertions passed against the rebuilt image in a non-root, read-only, no-network
container with no appdata mount. The rebuilt image's format probe passed with 43
major collections from two source tokens. No forced GC was used.

The no-cache build, including frontend production compilation, passed from clean
`main` source `b9017a452052ed9b5d2eda947541cc94b89992d2`:

- Image/index: `sha256:0921e890934899e86b1fda171efd2c7836fc3b03b38772316a9b064d09e68be8`.
- Native manifest: `sha256:a21904ed6b079c86d872ac2a00eaddbfe40670b807d8ba1ffdb77171a4cf8055`.
- Config: `sha256:4e49547e6a39d59c6e93ada894c999476bc67f892037ca95d769f601ce25cb93`.

OCI revision matches that source. Later Markdown-only evidence updates do not
relabel this image as their later commit.

## Complete catalog observation

The bounded study passed in 985.820 seconds (16 minutes 25.820 seconds): 20 waves,
210 scans, ten libraries and all 5,776 inventory/metadata/description/cache records.
Pending, failed, routing, handoff and service-error counts were zero. Load drained
at 621.114 seconds; comparison was ready at 644.642, representative fitting
published at 672.809, and comparison revalidated at 984.925, 340.283 seconds after
ready. All six workers exited and no admission lease remained active. No OOM,
memory-limit or PID-limit hit occurred.

Seven discovery admissions were allowed, with no discovery memory refusal. Queue
work encountered nine memory refusals. `pressureRecoveryObserved=false` is retained:
this run proves completion/revalidation, not naturally occurring comparison-pressure
recovery. Real services, synthetic providers/vectors and the existing schedule
adapter were used; this is not a full-application or production-capacity claim.
No competing local builds/tests ran during observation. Two bounded read-only
inventory counts checked progress; neither changed data or scheduling.

The GC trace is complete: 124 events, seven numeric source tokens, zero rejected
events, truncation or backwards clocks. The long-lived source has 110 events and
a maximum local pool of **219 MiB**. Do not sum stale pool values across sources.

The key event sequence in that source's own clock:

- At 742,696 ms, ordinary major GC left 107.0 MiB of objects, 117.4 MiB of V8
  allocator space and a separate 219 MiB local pool.
- At 850,796 ms, a natural memory-reducing GC reduced objects only from 107.6 to
  106.6 MiB and allocator space from 117.4 to 112.4 MiB, while the local pool became
  zero. Its reported pause was 41.91 ms. Its output is bracketed by study phases
  at 846.701 and 861.696 seconds; those clocks are not subtracted or equated.

The corresponding phase observations below are MiB. Physical V8 heap and kernel
resident counters remain distinct from the GC allocator-space field. Container
usage is the raw cgroup total, not Docker's cache-adjusted display.

| Phase / elapsed seconds | Main heap used | Main V8 physical | Node RSS | Anonymous resident | Container total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Representative published / 672.809 | 286.68 | 337.40 | 622.10 | 558.43 | 1003.57 |
| Idle / 801.693 | 107.36 | 117.11 | 440.01 | 375.49 | 803.58 |
| Before reducing GC / 846.701 | 107.51 | 117.11 | 439.92 | 375.55 | 805.27 |
| After reducing GC / 861.696 | 107.34 | 112.52 | 212.23 | 147.88 | 570.78 |
| Revalidated / 984.925 | 339.63 | 400.73 | 508.57 | 444.60 | 880.96 |

These phases had zero active workers, zero LazyFree and private dirty bytes equal
to anonymous bytes. During the idle observations, sampled snapshots, decoded
vectors, fitting inputs and verification metadata were collectible; one comparison
handle and two community-vector references remained as intended cache. Final
revalidation retained one sampled snapshot/vector/verification reference at stop;
this profile has no post-stop GC window, so their final reclamation is unproven.

This is strong evidence that reusable V8 page pooling explains a substantial part
of this run's idle residency: about 228 MiB of anonymous memory disappeared while
sampled live heap stayed around 107 MiB and the 219 MiB pool emptied. It does not
establish an allocator leak, explain every byte, diagnose every deployed warning,
or prove that all retention bugs are absent. Pooled pages still consume real
memory and must not be subtracted from admission accounting. The pinned upstream
mechanism and official references are in the design document.

Separate, non-simultaneous peaks: Node RSS 623.91 MiB, main heap 351.87 MiB,
worker heap 210.56 MiB, raw container 1005.79 MiB and kernel peak 1008.38 MiB.
Do not sum peaks. There were 90 phase records, including 80 complete and two partial
resident observations. Tracing changes timing; scan/worker counts differ from the
earlier run. This is attribution evidence, not a measured performance improvement.

Evidence is private under
`.tmp/resource-study/classifarr-resource-study-c2003de0e095a4f1e8383e0181764705/`:

- GC trace SHA-256: `6074d0551fee1fadfc772845e6f71a6bd8480343ce9ce0ce44a9bf27894574d3`.
- Phase trace SHA-256: `7481965b25cdc18560d689b31f4717740a73769f5b493a1cb5312171080933db`.
- Receipt SHA-256: `362c770c4e91a5543bd9cf726770baf6baeabdd401a6c9eb7f6514bff9dc4e34`.

Owned cleanup passed, independently confirmed by empty project-label container,
volume and network inventories. Only synthetic study data was removed. No raw
trace, database archive, native address or provider payload is committed.

## Local deployment

Local Compose was recreated without another build from the measured image. User
`1000:1000`, read-only root, 2 GiB limit and existing mounts remain; production
`NODE_OPTIONS` is still `--max-old-space-size=1536`, without trace flags.

A fresh 75,601,295-byte database archive passed checksum and archive-readability
checks (not a restore rehearsal). The first backup attempt completed its dump but
could not tag the running image's now-unaddressable old index after rebuilding the
same tag. The verified earlier image `sha256:9a9969816684bde772fccb148ff40d43b3d42594eea6698c72bfdc36301fb7eb`
remains as `classifarr:pre-memory-8b8d8d79-c233-428e-a818-3edaa2add916`; this is an
earlier rollback, not the exact replaced image. The local backup helper now verifies
and pins its explicit rollback source before dumping. Future rebuilds should pin
the current image before overwriting its only tag. Private backups remain ignored.

The isolated schema dump and independent check both passed, including migrations
through `20261005_180000_ingestion_compatibility_fence.sql` and 22 data seeds.
The tracked schema is unchanged; both owned schema containers were cleaned up.

The five-minute local check recorded 19 healthy samples from 01:08:22 to 01:13:17
UTC on October 7, with zero memory-limit hits, OOM kills or restarts. Raw container
usage ranged from 390.69 to 773.91 MiB; the kernel lifetime peak since recreation
was 786.48 MiB. Read-only diagnostics during the window found no new comparison
warning since the 01:07:25 restart, but readiness was still `backfilling`. This is
not proof of completed local backfill or a sustained-memory soak. Unraid and the
unrelated Harmoniarr container were not changed.

The [implementation CI run](https://github.com/cloudbyday90/Classifarr/actions/runs/37553764642)
passed build/test, database tests and fresh-install/published-upgrade checks.
OSV, Trivy, CodeQL, resource capacity, secret scanning and copyright workflows also
passed for the exact implementation commit. Publication/promotion jobs were skipped;
this is not a release authorization. Later documentation commits have separate
checks and do not inherit that source receipt.

## Recommendation and next item

Keep the diagnostic and existing safeguards. It provides direct, sanitized
attribution; its cost is version-specific parsing and observation overhead, so
leave it opt-in. Do not introduce forced GC, allocator tuning or weaker admission.

Next evaluate a **bounded cache-hit revalidation path**. The unchanged-data refresh
raised sampled heap from 106.25 MiB before admission to 272.36 MiB after the initial
full snapshot read, then 351.87 MiB after streamed fresh verification, despite
reusing the model. `liveMultiScaleCandidate.mjs` currently materializes the full
snapshot before testing its key against the cache. Investigate checking a bounded,
exact fingerprint first when cache reuse is possible, with full materialization
on a miss. Preserve both independent reads, complete/corrupt-vector checks,
provider/state/revision validation, cancellation, admission and fail-closed
publication. Benefit: less avoidable allocation on unchanged catalogs. Cost:
additional path complexity and potentially an extra read on misses; require
equivalence/race tests and a matched study before adoption.

No release, tag, version bump, PR merge or new branch.
