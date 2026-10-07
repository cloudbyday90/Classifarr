# Bounded warm preparation outcome

Implementation date: 2026-10-07. See the
[design, research and tradeoffs](representative-warm-preparation-design.md).

## Implemented

Warm representative refreshes now stream source validation and retain an explicit
present-hash set instead of a complete vector map. An exact cached model is
validated again, including membership and recovery-centroid geometry. Geometry
uses corpus-scoped batches in the same read-only repeatable-read transaction;
the reader expires after preparation and joins an unfinished read before releasing
the connection. Staged consumers still wait for the independent verification
transaction and existing provider, configuration, revision and admission checks.

Cold/changed models retain the full fitting path. A changed source costs one
additional streamed probe before fitting. Warm geometry requires another bounded
vector pass, trading database reads for lower retained allocation. Missing vectors
remain partial evidence; malformed present vectors remain failures. Unknown
streamed-recovery failures abort the attempt rather than publishing incomplete
preparation. Existing retry, memory, cache, timeout and GC policies are unchanged.

No migration, API, template, credentials, routing authority or release change.
The recovery-change skill guided differential/rollback and lifetime checks;
the dependency-update skill kept the PR trial separate from this runtime change.

## Verification

- Regression-first repository run: two new missing-method failures, fourteen
  existing passes. Subsequent focused run: 21 suites, 296 passes.
- Real PostgreSQL: two suites, 24 passes. Concurrent updates/deletions remain
  invisible within warm preparation, including its geometry reads, but are caught
  by independent verification. Cancellation rolls back and leaves a usable connection.
- Full/streamed geometry agree for valid, swapped-membership, changed-centroid
  and zero-mean evidence. Maximum-dimension tests enforce component-sized batches.
- Five lifetime subprocess cases pass, including real consumers on the warm path:
  metadata, reader, decoded maps and vectors are collectible before verification.
  Forced GC is used only by this reachability test, never by production/profiling.
- Backend lint/typecheck, dependency checks, copyright, static imports and Markdown
  checks pass. Ownership review inspected the adapter and callees, updating only
  its reviewed source digest; no SQL write/ownership permission was added. The
  gate still records 501 unresolved historical paths, not universal writer safety.
- First full run: 1,732 suites and 53,855 tests passed, one code-health failure
  and one Windows-only skip. The failure required explicit intent comments on
  cleanup rejection handlers. After adding them, code-health/reader tests passed
  33,262 checks. The final-source full rerun passed all 1,733 suites and 53,856
  tests in 293.419 seconds, with only the Linux-covered Windows skip.

## Random open PR

Fresh enumeration found two open PRs; random selection chose client
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable head
`5545605b53c854de8847b44e24fa083ff4218080`. Applied its exact manifest/lock changes:
Node declarations 24.19.1 to 26.6.4 and undici-types 7.24.6 to 8.9.0. Official
registry metadata confirmed the integrity, dependency and absent scripts/peers.
The runtime gate rejected Node 26 declarations against deployed Node 24 (7/8
passed). Reverted before installation; restored gate 8/8 passed. No merge,
retained dependency change or installed-candidate audit/build claim.

Fresh client outdated results also show PostCSS 8.5.29 and Vite 8.3.3. TypeScript
7 is a separate compatibility review; client 6.0.3 remains intentional.

## Image and schema

Implementation: `f209e92c1ce5d0e6edc6a4ca256a7d5e57f6811b`; cleanup-comment follow-up
and exact image source: `2907a961744baccfb9ab370cd9abc91709c357c3`, on main.
The first in-progress build was stopped after the comment change; a fresh clean
`--no-cache --require-provenance` build completed. OCI revision matches 2907a961.

- Image/index: `sha256:25f943fd9ee4ce016fcd00121346014eb84481dfd76d79f7b693cd11a3819ca6`.
- Native manifest: `sha256:a710a7422189d744e10c43760b613f507a248cc3f0aac1e77f4ac3db078dfd01`.
- Configuration: `sha256:3f6fde60966e801b8047531813423a27ff92c49318fcb809ebd1001078de0005`.

Previous image 36be70f7 was pinned as `classifarr:pre-warm-preparation-9e33fadb`
before replacing the mutable build tag. Post-build isolated schema dump and
independent check passed through `20261005_180000_ingestion_compatibility_fence.sql`
with 22 seeds; tracked schema unchanged. Owned schema containers were removed.
The exact Linux image passed directory fsync, exclusive copy and source-preservation
checks on disposable tmpfs without appdata/network, covering the Windows-only skip.

## CI

For image source 2907a961, OSV, Trivy, CodeQL, resource-capacity, secrets and
copyright workflows passed. Database integration and fresh-install/published-upgrade
jobs passed in [CI](https://github.com/cloudbyday90/Classifarr/actions/runs/37615109940).
The complete pipeline subsequently passed, including container recovery checks
and acceptance readout. Publishing/promotion/provider-release jobs were skipped.
No release was created.

## Complete-cycle measurement

Project: `classifarr-resource-study-ab85dfab56392b151c36769cc350d4b0`.
Exact image above; duration 1,097,614 ms (18m17.614s). No other build/test workload
ran during measurement. The ordinary local Classifarr and unrelated Harmoniarr
containers stayed running, so this is not an otherwise idle host or matched A/B.

- Twenty waves, 188 admitted scans and 22 scan deferrals; ten libraries/owners,
  all 5,776 inventory items completed and descriptions cached. Zero remaining
  pending/failed work, routing, handoff gaps or service errors. Drain: 715,500 ms.
- Post-drain representative publication at 725,172 ms; warm `up_to_date` at
  1,084,492 ms. Comparison ready at 776,757 ms; revalidated at 1,097,210 ms.
  Both independent real five-minute intervals elapsed; no forced clocks or GC.
- Seven preparations and three verified commits per consumer; invalidated attempts
  correctly did not publish. Twelve observations processed, zero invalid inputs,
  errors or pending observations. Eighty readiness groups before stop, zero after.
- Twenty-eight reads, five comparison builds, eleven workers created/exited and
  zero active workers/admission holders at finish. Observed overlap: 12 ingestion,
  76 queue. Memory refusals: 22 ingestion, 50 queue, zero discovery. Consequently
  `pressureRecoveryObserved=false`: completion does not prove discovery-pressure
  recovery occurred in this run.
- Zero OOM kills or memory/PID-limit hits. Independent sampled peaks in MiB:
  process RSS 807.27, main heap 636.97, worker heap 213.67, raw container 1176.76,
  kernel peak 1181.59. Do not add independent peaks together.

The trace has 160 records, 100 complete and five partial resident observations;
synchronous consumer boundaries deliberately have only main-thread measurements.
Major-GC evidence: 118 events, twelve source tokens, maximum source-local reusable
page pool 340 MiB. This remains real memory, not an admission deduction.

### Warm representative boundaries

All memory figures below are MiB, not allocation totals.

| Boundary | Main heap | Physical V8 heap | Process RSS | Raw container |
| --- | ---: | ---: | ---: | ---: |
| Streamed preparation read, 1,081,079 ms | 319.36 | 358.83 | 478.24 | 835.11 |
| Shadow preparation start/end | 327.81 / 323.36 | 360.79 / 367.79 | 481.87 / 485.61 | — |
| Neighborhood preparation start/end | 323.36 / 381.88 | 367.79 / 434.02 | 485.61 / 553.05 | — |
| Independent verification, 1,084,435 ms | 239.12 | 346.49 | 613.10 | 974.20 |
| Shadow commit start/end | 241.23 / 241.76 | 346.49 / 346.49 | 614.59 / 614.62 | — |
| Neighborhood commit start/end | 241.76 / 254.30 | 346.49 / 346.95 | 614.62 / 614.89 | — |
| Up to date, 1,084,492 ms | 254.33 | 346.95 | 614.89 | 975.93 |

Shadow preparation took about 30 ms; neighborhood preparation 1,350 ms. Their
commits took about 1 ms and 36 ms. Natural GC affected these endpoints. Periodic
samples under the `recovery_read_25` label reached 436.45 MiB heap; that label
persists through consumer work and into the next read until the next checkpoint.
The 319.36 MiB boundary is **not** the warm-cycle peak.

The preceding full-map run's first-read endpoint was 431.19 MiB heap / 602.86 MiB
RSS; the new endpoint is lower, but no causal percentage is established. Warm
publication RSS is effectively unchanged (614.89 versus 611.68 MiB). Overall raw
peak is also essentially unchanged (1176.76 versus 1176.24 MiB), with different
admissions, invalidations and eleven instead of thirteen workers. This proves the
bounded warm contract and completion, not resolution of all memory pressure.

At warm publication no full snapshot/decoded-vector references were observed;
one metadata reference and both staged batches remained. By final comparison
revalidation, the batches were gone. Model/community and two metadata references
were still observable at immediate stop; repeated model WeakRefs need not mean
distinct objects. Final comparison heap/RSS/raw: 386.49 / 627.14 / 988.93 MiB;
immediate stop: 388.62 / 627.05 / 989.36. No added post-stop idle soak was run.

The largest sampled main heap was associated with the `recovery_community` phase
(636.97 MiB), outside warm representative preparation. Investigate that cold-build
phase with matched source/workload evidence before choosing another memory fix.
The synthetic queries do not prove production semantic accuracy or a complete
priority-refill queue workload.

Owned cleanup passed; container, volume and network inventories were independently
empty. Only regenerable synthetic study data was removed. Private evidence lives
under `.tmp/resource-study/` in the project directory above.

- Phase trace SHA-256: `e7d5901429fc9507ff31722e12a5e284098eb3c38f188c96853f3f0c14b77095`.
- GC trace SHA-256: `fcbf823221dbc582f6b1c1b82b5ae1cab7f070adea0d0ce0e025a0f18031c010`.
- Receipt SHA-256: `e770cd0c6746cdbe3c7f545c86c085090bea703da259bdaf780715b023721c78`.

## Local replacement

Before replacement, the old local image had a memory-pressure warning at
11:18:45 UTC and automatic recovery at 11:21:42 UTC. Readiness was `ready`.
The read-only helper's own admission result is not the web daemon's memory.
Unraid and unrelated Harmoniarr containers remain untouched.

A fresh 75,567,003-byte archive passed checksum and archive-list verification;
this is not a restore rehearsal. Backup:
`.tmp/pre-memory-fingerprint-9323501d-0f99-4390-bd61-b1e72d2d9d3f.dump`.
Exact rollback image tag: `classifarr:pre-memory-9323501d-0f99-4390-bd61-b1e72d2d9d3f`.
Only local Classifarr was recreated at 12:03:42.727 UTC with the measured image;
startup health passed. It retains user `1000:1000`, read-only root,
no-new-privileges, existing capability restrictions/mounts and the 2 GiB limit.
The initial bounded read-only check returned readiness `ready`; the final check
returned `backfilling` as normal background work resumed. The newest stored
comparison warning remained 11:18:45 UTC, before this restart; the only observed
post-start comparison event was waiting for background work at 12:04:45 UTC.
Do not claim local backfill or a local warm cycle completed in this window.

The five-minute observer produced 19 healthy samples from 12:04:27.203 to
12:09:21.633 UTC. Raw container usage ranged from 313.32 to 1046.59 MiB and ended
at 396.93 MiB; kernel lifetime peak was 1058.46 MiB. Zero OOM kills, restarts or
memory-limit hits. This short, active-background observation is not a matched
memory comparison, leak disproof or sustained-stability test. Complete warm-cycle
evidence comes from the isolated catalog measurement above.

## Recommendation stack

1. Retain bounded warm reads with unchanged safeguards: no full warm vector map,
   exact source revalidation and equivalent geometry checks. Cost: an extra
   geometry pass and a probe before changed-source fitting.
2. Next profile cold comparison/community construction using matched inputs and
   phase/lifetime evidence. Overall peak is not materially lower, and it is not
   yet valid to name a new leak or remove another check.
3. Continue patch-level dependency reviews separately (client PostCSS/Vite are
   pending); keep Node declarations aligned with Node 24. Do not adopt PR #555
   without a separately approved runtime-major migration.
