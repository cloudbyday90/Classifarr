# Vector validation experiment outcome

Date: 2026-10-07. See the [design](vector-validation-allocation-design.md).

## Decision

**Keep the production validator unchanged.** Thirteen small alternative loops
were compared with the existing implementation. None established both reduced
allocation across the relevant histories and unchanged observable behavior.
This round adds a reusable offline reproduction and semantic regression tests,
not a production memory fix. All memory, freshness, retry and ownership safeguards
remain unchanged. No dependency, schema, version or release change is intended.

The reproduction uses the real decoder, validator and fingerprint helper in a
dedicated process, with fixed synthetic sizes and existing heap-sampling code.
The Linux CLI requires explicit opt-in and the existing 2 GiB/two-CPU/128-PID
budget, checks budget continuity, and emits only bounded numeric evidence.
It never connects to a database or provider, opens a remote inspector, writes a
raw profile, or forces GC. A cooperative deadline and external process timeout
bound execution. The diagnostic is not called by application startup or requests.

## Candidate evidence

The baseline development image was
`sha256:797b3347423babba64e02b4fad977929b7927b40c1b3d9479d00fd69a198be89`,
Node 24.21.0. Each alternative ran in its own network-disabled, read-only container
with 2 GiB/two CPUs/64 PIDs, three parsed rounds followed by three clone-conditioned
rounds. These initial probes used a decoder-shaped prototype, not replacements
mounted over application source. Each round processed 5,776 entries from repeated
256-row batches of 1,024-dimensional synthetic vectors; counts/checksums matched.

| Candidate | Parsed history MiB | Clone-conditioned MiB | Decision |
| --- | ---: | ---: | --- |
| Unchanged validator | 34.77–48.37 | 180.23–189.27 | Control |
| Scalar-check helper | 39.80–55.43 | 167.63–187.24 | Spike remains |
| Numeric local | 43.33–46.86 | 173.69–182.19 | Spike remains |
| Precompute numeric checks | 126.32–135.86 | 254.12–289.22 | Regresses |
| Captured hasOwnProperty call | 44.33–49.88 | 157.63–187.27 | Spike remains |
| Ownership check first | 38.79–54.41 | 177.68–199.36 | No benefit; changes access order |
| Numeric addition hint | 44.84–51.39 | 264.20–275.72 | Regresses |
| Explicit nonzero branch | 37.78–51.90 | 163.12–192.76 | Spike remains |
| Native values iterator | 340.39–346.86 | 363.87–373.36 | Regresses |
| Retained string index keys | 40.31–43.83 | 171.65–193.73 | No useful benefit; adds retention |
| Exact rounding-range predicates | 40.82–49.88 | 170.15–188.70 | No useful benefit; adds numerical complexity |
| Earlier finite guard | 44.33–45.34 | 172.14–180.28 | Spike remains |
| Native array at | 131.31–142.37 | 125.89–149.89 | Regresses parsed control; extra length reads |
| Native every plus visited count | 127.34–134.90 | 139.78–142.86 | Regresses parsed control; changes iteration semantics |

These are cumulative statistical allocation estimates, not concurrent usage,
retention or CPU guarantees. Three rounds do not establish the significance of
small differences. The measured history sensitivity persists; the exact V8
allocation instruction is still unproven. The alternatives remain ignored local
experiments, not production implementations or supported modes of the new CLI.

Local experiment source SHA-256:
`f74d16a9e12fbb97154b613e653edd02668277f9dadeb9903ff9232047a80ad2`.
Receipt SHA-256:
`943dec608d1f075d0619df29dc7e95004deba1bbec79f52c0ca54ff615680861`.

## PR trial

Fresh enumeration found two open PRs. Random selection chose server
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Applied its exact manifest/lockfile change
locally: @types/node 24.19.1 to 26.6.4 and undici-types 7.24.6 to 8.9.0. Registry
integrities/dependency metadata matched. The runtime-major gate passed 8/8 before,
failed 1/8 with the candidate and passed 8/8 after reverting it. The PR is unmerged;
no candidate installation, installed audit or candidate build is claimed.

The Node 24 runtime remains authoritative. Separately, npm outdated reports
dotenv 18.0.6, express-rate-limit 8.7.1, js-yaml 5.4.3 and Knip 6.40.0 as candidates;
review those in their own dependency batch.

## Recommendation stack

1. Retain the current validator and the new semantic/measurement controls. Benefit:
   no integrity regression or speculative production rewrite. Cost: the reproduced
   temporary allocation remains unresolved.
2. Use this small reproduction to isolate V8 optimization/deoptimization and
   allocation sites on the pinned runtime before proposing another validator fix.
   Keep engine flags confined to the disposable probe; do not tune production GC.
3. Only accept a future fix after both micro-controls and complete sampled/natural
   catalog cycles show benefit with identical warm-read counts and all checks.
   Defer broader vector representation or transport changes until justified.

This follows the recovery-change skill's evidence-before-fix gate. The next item
is engine-level attribution of the clone-conditioned path, not another blind loop
rewrite, removal of checks, or a larger memory allowance.

## Verification before image build

- Full backend: 1,740 suites, 54,021 tests passed, one platform-specific skip,
  328.187 seconds. Focused regression/sampler coverage passed 70 tests; the final
  diagnostic receipt checks were rerun separately (11 tests passed).
- Isolated PostgreSQL: two suites, 20 tests passed in 11.607 seconds.
- Server lint/type check, full/production Knip, static imports, copyright, npm CLI
  policy, ownership gate and Markdown passed. No ownership baseline was refreshed;
  that gate means no unreviewed static drift, not proof all legacy paths are safe.
- The first unit harness exceeded the unchanged 60-second diagnostic deadline
  under Jest's cross-realm VM. The full numeric workload now runs in a native Node
  subprocess with a 30-second external test deadline. Work size and production
  diagnostic deadline were not reduced/increased to obtain a pass. Fault-only unit
  cases inject bounded sampler results; the image CLI supplies real sampling.
- Before replacing the local tag, the running baseline image was pinned as
  `classifarr:pre-memory-26606ab0-0539-4595-a955-5672ed15d8f9`. Backup
  `.tmp/pre-memory-fingerprint-26606ab0-0539-4595-a955-5672ed15d8f9.dump` contains
  75,540,185 bytes and passed checksum/archive-list checks, not a restore rehearsal.

Prior documentation commit `a0399d89` has a failed
[CI run 37652685022](https://github.com/cloudbyday90/Classifarr/actions/runs/37652685022),
despite successful Build and Test, Tests with Database and Fresh Install/Published
Upgrade jobs. The API lists no acceptance-readout job or failed job log. The run
page identifies a GitHub Actions internal server error, correlation ID
`d1e34456-3303-44de-b5d1-9a778a967e26`. This is an incomplete workflow receipt,
not a failed application test or a regression attributed to this change.
The new source revision has its own successful
[CI run 37656159799](https://github.com/cloudbyday90/Classifarr/actions/runs/37656159799),
including Build and Test, Tests with Database, Fresh Install/Published Upgrade
and the acceptance readout. Resource Capacity Regression, OSV, Trivy, CodeQL,
Gitleaks and copyright checks also passed for `697b9897`. Publication jobs were
skipped as expected; no release approval, image publication or release is implied.

## No-cache image and diagnostic

Source commit: `697b9897d84df242e8a37db8521d505a072c8d50`.
The local Compose no-cache build produced image
`sha256:16d37021966c27192c7c1aa98af448d169f160db2c7cdb013f64bfe9ccd9944f`.
Its OCI revision matches the source. Schema dump and independent verification
ran against that exact image in separate disposable containers. Both passed;
the tracked schema is unchanged, and neither container remains.

The actual image CLI completed in 5.174 seconds with 12 successful windows,
5,776 rows and 5,914,624 components per window. Count, checksum and fingerprint
equivalence passed. Cumulative sampled allocation was:

| History | Decode MiB | Decode plus fingerprint MiB |
| --- | ---: | ---: |
| Parsed conditioning | 44.32–47.36 | 51.36–59.40 |
| Structured-clone conditioning | 166.13–188.23 | 181.78–190.26 |

The validator-attributed samples ranged from 124.30–140.37 MiB for clone-conditioned
decoding and 58.15–68.71 MiB with fingerprinting. Optimized attribution can move
among helpers: a zero sampled category or a smaller category is not proof of
zero allocation or lower total cost. These results reproduce the unresolved
temporary allocation; they do not measure retained memory or demonstrate a fix.
Receipt SHA-256:
`6c3ec545d651345c07797d9d208e638f5ebdc4520fd5644e44251479bc288213`.

The wrong-PID-budget control exited 1 with only the fixed failure classification
and no successful receipt. The Linux-only directory-fsync/exclusive-copy control
also passed in the candidate image, covering the platform-specific unit skip.

## Complete natural catalog cycle

The same image completed the allocation-sampling-disabled catalog study in
1,171,119 ms (19.52 minutes), with natural GC and unchanged resource admission.
Project: `classifarr-resource-study-c5658c66526946b2e53c82d7d0c2dd2d`.
Real database queries and schedulers used synthetic transports in an isolated
network with disposable storage; no production provider or appdata was used.

- All 20 growth waves, ten libraries and 5,776 imports/descriptions/cached vectors
  completed. No pending/failed work, routing, handoffs or service errors remained.
- Four builds and 29 reads completed. Comparison became ready at 852,222 ms and
  revalidated at 1,170,983 ms. Representative publication at 799,262 ms was followed
  by an up-to-date refresh at 1,158,012 ms. Both exceed the required five-minute
  warm interval after the final drain at 619,479 ms.
- Admission recorded nine ingestion, 89 queue and three discovery memory-pressure
  deferrals. The strict receipt validator confirmed subsequent discovery recovery;
  this run genuinely observed pressure recovery, not just queue deferral.
- All 11 workers exited. Sixteen consumer operations completed with no errors or
  invalid input; pending consumers and active admission slots were zero. Consumer
  groups dropped from 80 to zero when stopped.

| Peak measurement | MiB |
| --- | ---: |
| Main heap used | 626.87 |
| Process RSS | 789.33 |
| Worker heap | 201.85 |
| Sampled whole-container usage | 1,182.53 |
| Kernel whole-container high-water mark | 1,196.13 |

No OOM, OOM kill or memory-limit hit occurred. These are observations, not a
matched improvement over an earlier run: production code is unchanged and build,
read and deferral counts differ. Do not use them to justify raising safeguards.

At stop, the tracked source snapshots, decoded vectors, owned sources/vectors and
consumer batches had zero live weak samples. One comparison handle, two community
vectors, two verification-metadata samples and two representative models remained
observable. Without forcing GC, that neither proves a leak nor proves every cache
has been released. The 143 major-GC events included a natural main-heap reduction
from 596.8 to 218.2 MiB; allocator pooled memory is distinct from retained objects.

Receipt SHA-256:
`cfd57f664093078f8be4253b6672eb3870b2371ae2c146d9a49959f8afd3e409`.
Trace SHA-256:
`ef1a3eede9cb032a943020ca6ccff48e9dc354b95addc542b3d0bb414c6920e3`.
GC trace SHA-256:
`e8973fce1dff24a7ff5c3ea099244ac3a3cb105ce372795a715bb1582dc1184e`.
The receipt passed the existing strict contract. Project container, network and
volume cleanup passed and independent Docker listings found none remaining.

## Local deployment

Before recreation, a fresh 75,546,149-byte backup was saved as
`.tmp/pre-memory-fingerprint-c4c07914-14a3-4aa3-9ab6-efb2b5973c47.dump`.
Checksum and archive-list verification passed; this is not a restore rehearsal.
Rollback tag `classifarr:pre-memory-c4c07914-14a3-4aa3-9ab6-efb2b5973c47`
pins the prior running `sha256:797b3347…` image. These local recovery artifacts
remain outside Git.

Compose recreated only local `classifarr` from the already-built candidate and
waited for health. Container `252606b77b0723c067535a0a4db0752755bc063f386a3137bee8d15e6998121d`
runs the exact candidate image. Appdata/media mounts, user `1000:1000`, read-only
root, capabilities, no-new-privileges and the 2 GiB limit were preserved.
The health endpoint reports a connected database, and read-only inventory
readiness reports `ready`. Unraid and Harmoniarr were not modified.

The five-minute smoke recorded 19 healthy samples from 17:32:19 to 17:37:15 UTC:
sampled raw-container peak 828.21 MiB, kernel high-water mark 974.34 MiB, final
raw usage 618.57 MiB, zero memory-limit hits, zero OOMs and zero restarts.
This short startup check is not a sustained-load or retention guarantee.

Readiness briefly changed to `backfilling`. Read-only checks found three completed
imports with unfinished current-generation backfill cursors and no due/active/
failed queue tasks. All three checkpoints completed automatically at 17:40 UTC;
the final readiness check returned `ready`. No manual recovery or database edits
were performed. The newest recorded comparison memory-pressure warning remained
the pre-recreation 16:43:45 event, followed by recovery at 16:46:45. This absence
of new warnings during a short window does not establish that the original
temporary-allocation problem is fixed. Helper-process admission readings were
not used as measurements of the application daemon's heap.
