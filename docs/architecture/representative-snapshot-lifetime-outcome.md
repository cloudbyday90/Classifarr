# Representative snapshot lifetime outcome

Date: 2026-10-06. [Design, tradeoffs and official research](representative-snapshot-lifetime-design.md).

## Implementation and regression evidence

Representative candidate preparation now ends before the independent verification
read. Both full snapshots, provider inspection/verification, exact source keys,
configuration/revision checks, coverage validation and publication checkpoint remain.
Recovery commits require explicit fresh input, constructed outside the scope that
held the old snapshot. Shadow scoring and committing no longer share that context.
No caller snapshot is cleared or mutated. Admission, deadlines, cache limits,
backoff and production GC behavior are unchanged.

The isolated reachability regression covers a fresh fit and a cache hit, both with
and without real pending shadow/recovery callbacks. It tracks the snapshot, vector
map and a vector, forcing GC only inside a disposable synthetic test subprocess.
Against the previous source, both ordinary cases failed while the deliberately
retained control passed. Against the refactor, all three passed. This proves the
first snapshot can be collected at the second-read boundary; it does not establish
natural collection timing or memory savings under production load.

Failed image studies now preserve allowlisted numeric phase peaks. Non-summary
lines retain their 16 KiB limit; summaries allow at most 64 KiB, 128 phase entries,
and the same overall 8 MiB input / 256 checkpoint limits. Unknown names, negative,
fractional or non-finite values and raw payload fields are excluded. No scanner,
study deadline or acceptance assertion was weakened.

Focused validation passed 16 suites / 236 tests. Server typecheck, lint, both
dependency-analysis modes, 40 tooling tests, static imports and copyright checks
passed. The ownership gate passed without changing its reviewed hashes or claiming
historical unresolved writer paths resolved. The broader affected backend run
passed 176 suites / 2467 tests. Image results follow below.

All seven workflows for the implementation commit passed, including
[CI/CD](https://github.com/cloudbyday90/Classifarr/actions/runs/37523513674),
database tests, fresh-install/upgrade, resource capacity, CodeQL, OSV, Trivy,
secret scanning and copyright checks. Conditional publishing/release jobs were
skipped; this is not a release, tag or published-image acceptance claim.

## PR trial

Fresh random selection again chose open #555 at
`5545605b53c854de8847b44e24fa083ff4218080`. The exact client manifest/lockfile diff
was applied locally. The Node-major policy test failed (seven passed, one failed):
Node 26 declarations do not match deployed Node 24. Only those trial changes were
reverted; all eight policy tests subsequently passed in the 40-test tooling run.
No install, retained dependency update or merge. The unrelated PostCSS/Vite patches
reported by `npm outdated` remain a separate potential batch.

## Image evaluation

Before building, a new private database archive (75,625,425 bytes) passed checksum
and archive-list verification. The previous image
`sha256:570d5cec73e7cfc65e62bec989aa53ceb6fd9d2a618af891c446a1dd92a96233`
was retained as `classifarr:pre-memory-7b0fba6c-974e-40a3-977b-e0801a98ca54`.
This archive verification is not a restore rehearsal. No Unraid access.

The no-cache build passed at source
`e3841045992193f7e1714e388c4a85f58ee80dfb`. Its immutable image is
`sha256:da153c1df913cc06976ac134d2b1505940fafd3bc1d3b20cc9c327b9e5eb019f`,
with native manifest
`sha256:a5f134ccd71d2e1e134e83b4a2762231c2d0fe7bb85a84d0324d3ade08ac7297`
and image configuration
`sha256:4098b608d4350daa0f076a69517e46194585a9dfe4d7995ffe05e90d35c05524`.
The OCI source label matches the commit.

### Shared-catalog study

The unchanged 25-minute, 2 CPU / 2 GiB / 128 PID study **failed**
`comparison_catalog_completion_missing`. All 5776 items completed import and
metadata, with 5776 descriptions and cached vectors, at 621.134 seconds. Comparison
recovered and later revalidated, but representative publication after that drain
did not finish. No successful study receipt was produced; assertions after the
completion check, including final admission-permit checks, were not reached.

| Elapsed seconds | Observed event |
| --- | --- |
| 415.849 / 475.853 | Representative admission refused for memory pressure during growth |
| 655.862 | Representative refused again: 949.16 MiB available, 1088 MiB required |
| 670.868 | Comparison refused: 951.07 MiB available, 1088 MiB required |
| 790.875 / 835.670 | Comparison admitted with 1547.33 MiB available, then published |
| 955.878 | Representative refused: 791.04 MiB available, 1024 MiB required |
| 1030.886 | Comparison idle checkpoint: old snapshot/input weak references zero; container 679.92 MiB |
| 1150.893 / 1154.818 | Comparison admitted and revalidated, over five minutes after publication |
| 1495.901 | Representative admitted with 1368.58 MiB available after repeated cooldown reports |
| 1500.8 | Deadline cancelled the in-progress representative fit; all workers joined |

There were 27 reads, six comparison builds, and 13 created/exited workers with zero
active workers at stop. Representative admission allowed seven attempts and refused
four; comparison allowed seven and refused one. No recorded OOM or memory-limit
hit occurred. Raw cgroup usage includes PostgreSQL and cache; it is not Node heap.

Comparable **checkpoint** maxima are below. The prior run did not save one-second
phase peaks, so these numbers deliberately exclude the new summary peaks.

| Metric, MiB | Previous source | This source |
| --- | ---: | ---: |
| Process RSS | 905.98 | 895.30 |
| Main-thread used heap | 740.02 | 726.12 |
| Raw cgroup usage | 1271.81 | 1274.45 |
| Kernel high-water | 1280.40 | 1280.52 |

The new one-second peaks were RSS 895.93 MiB, main heap 726.91 MiB, external
68.78 MiB (including 67.88 MiB ArrayBuffers), raw cgroup 1274.89 MiB and worker
heap 214.11 MiB. Maxima need not be simultaneous. Peak container memory was
effectively unchanged; a single timing-sensitive run does not establish a reduction.

The full-catalog comparison build still grew from 253.46 MiB main heap entering
community preparation to 509.93 MiB at build completion and 720.64 MiB after its
fresh read. The first comparable prior full-catalog build measured 262.48, 530.97
and 725.06 MiB respectively. This remains a substantial allocation target.
At 1030.886 and 1330.902 seconds, sampled old snapshots, decoded vectors, owned
inputs and community rows were all gone; the live cached comparison handle and
its shared vectors remained intentionally available. No stuck worker or permanent
snapshot leak was demonstrated. There is no post-stop GC window in this profile,
so still-live weak cache references at stop do not prove a shutdown leak.

Limitations: synthetic provider data and schedule adapters, not the full application
scheduler or Unraid. The image fixture does not enable real shadow/recovery callbacks;
their lifetime is covered separately by the regression test. No full-size
representative fresh-read checkpoint completed after drain, so this run cannot
quantify the refactor's benefit at that boundary. Different naturally occurring
admission/timing sequences prevent attributing the changed completion path solely
to this refactor. Safeguards and the original acceptance rule remain unchanged.

The sanitized trace has 144 records, with SHA-256
`5d340ac26b10a84538c15af84d4d074478e5c1e0ea54884a86b750de92a781c7`, at
`.tmp/resource-study/classifarr-resource-study-d536c0d193beafbbd279994571855fcf/comparison-trace.json`.
The runner removed its exact disposable containers, volumes and network; independent
label checks found none remaining. It preserved the tested image.

### Local Compose and schema

Local Compose was recreated from the tested image and reached healthy. Existing
data/media mounts, UID/GID 1000, read-only root filesystem, no-new-privileges and
2 GiB limit are unchanged. The isolated schema dump and independent fresh-container
check both passed, with no change to `database/schema/current.sql`; both disposable
schema containers were cleaned up. The five-minute local observation passed: all
19 samples were healthy, with zero OOM/limit hits, raw cgroup usage 373.09–512.64
MiB and a final sample of 373.09 MiB. Kernel high-water since startup was 790.23 MiB;
it includes time before this sampling window. No controlled before/after comparison
or full-cycle recovery claim follows from this short local observation.

The final read-only readiness query returned `ready`, after an earlier `backfilling`
result. The bounded comparison-warning/log checks contained no post-recreate event;
their latest warning predates the new container. A separate probe process's allowed
admission is not proof of the main process's cache state or successful revalidation.
The separate Unraid installation and unrelated local container were untouched.

## Recommendation

Keep the lifetime refactor: the regression proves unnecessary snapshot reachability
was removed without dropping either verification read. Do not call the wider memory
problem solved or the shared-catalog study passed.

1. Investigate representative retry accounting next. Its existing catch path counts
   memory-admission refusal like a fitting failure, increasing exponential cooldown;
   ingestion/backfill wrapper deferrals do not reset that history. Add deterministic
   natural-schedule/boundary tests, then evaluate separating transient resource
   deferrals from genuine fitting failures. Benefit: resume optional work promptly
   when resources recover. Cost: more admission checks; keep them bounded, preserve
   every memory threshold/hysteresis, and never bypass readiness or cancellation.
2. Then investigate comparison build/fresh-read allocation (the measured 510-to-721
   MiB heap transition). Reducing decoding could lower peaks, but a fingerprint-only
   replacement needs its own corruption/consistency contract and tests.
3. Keep limits, eviction and production GC unchanged. Higher limits or forced GC
   could conceal the remaining allocation and retry behavior rather than explain it.

For the next timing investigation,
[Node 24 timer guidance](https://r2.nodejs.org/docs/latest-v24.x/api/timers.html)
(discovered and retrieved October 6) does not guarantee precise callback timing.
Test just-before/at/after eligibility and delayed scheduler ticks; do not assume an
exact-minute callback or infer a timer defect solely from this trace.
