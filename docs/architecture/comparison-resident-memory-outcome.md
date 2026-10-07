# Comparison resident-memory outcome

Date: 2026-10-06. Design: [resident-memory attribution](comparison-resident-memory-design.md).

## Implementation and scope

The isolated study now separates self/PostgreSQL/other process RSS and PSS,
allowlisted cgroup memory types and V8 committed heap. Reads are bounded,
read-only and phase-scoped; concurrent marks share an observation without losing
their labels. Missing or raced measurements remain explicit. Saved traces also
retain streamed-verification markers and metadata weak-reference counts.

Production services, admission thresholds, cache lifetimes, refresh schedules,
database schema and deployment configuration are unchanged. No release is created.

## Validation status

The focused run passes 13 suites / 394 tests, including malformed counters,
partial reads, PID churn, denied/foreign processes, deadlines, sanitization and
concurrent observer shutdown. Backend lint, typecheck, both dependency checks,
host trace-module lint, copyright, ESM/static-import checks and Markdown pass.
The runtime-major gate passes all eight tests after reverting the PR trial.
Pinned Node 24.21.0 supports the selected main/worker V8 statistics.

A counterfactual using the old trace collector drops streamed verification,
metadata references and committed-heap fields; the new collector preserves them.
The full backend suite passes 1726 suites / 53,652 tests. Its one Windows skip is
the Linux directory-fsync case; the same complete/exclusive-copy and unchanged-source
assertions pass against the rebuilt image's module in an isolated Linux container.
No appdata mount or network was used for that filesystem check.

The no-cache build passes, including the client production build. A non-root,
read-only, no-network image probe returns complete cgroup-v1/self telemetry in
12 ms without extra capabilities. Cgroup-v2 parsing is unit-tested, not exercised
on this cgroup-v1 Docker host. The unchanged complete-catalog study failed its
final completion check, as detailed below; it is not a successful recovery receipt.
Local recreation and independent schema dump/check pass.

## Measured artifact

- Source: `1a08635ade36304fcab883d2ea2b699cca7b1fc0` (clean `main`).
- Local image/index: `sha256:9a9969816684bde772fccb148ff40d43b3d42594eea6698c72bfdc36301fb7eb`.
- Native manifest: `sha256:13350f68bcfeed9e1497bb712d639a66b6bcae0d0530eb06b5484f3eb2d4ac64`.
- Config: `sha256:8dc572ab7d4719096df1dd6352e6eb816f6593fc4edc3f0debf6e579b830f1e8`.
- Study project: `classifarr-resource-study-42a7de0dd8b8e4488239ca7a4f43374e`.

The existing bounded profile keeps two CPUs, 2 GiB and 128 PIDs, synthetic providers,
real catalog/queue services and unchanged acceptance/deadline/admission rules.
No competing local tests/builds or forced collection run during this study.

## Study result: completion failure retained

The run stopped at 1500.435 seconds with `comparison_catalog_completion_missing`
at `catalogContract.mjs:55`. All 5776 items, metadata descriptions and cached
vectors were complete at 621.004 seconds. The earlier work/coverage, budget and
admission assertions passed before that final completion assertion failed.
Comparison recovered to `ready` at 1327.805 seconds, leaving less than five minutes
for the required later revalidation. No revalidation occurred before the unchanged
25-minute deadline. Do not call this a completed natural-recovery study.

The failed run retained 123 sanitized trace records at
`.tmp/resource-study/classifarr-resource-study-42a7de0dd8b8e4488239ca7a4f43374e/comparison-trace.json`;
SHA-256 `d8f2ec338232bb3c6fd9a49a98924a278e13680adb642c84a546e13558dedd6c`.
There is intentionally no passed `result.json`. The runner removed its owned
container/volumes/network; an independent label inventory was empty afterward.

The summary records 11 workers created, 11 exited and zero active. Sampled peaks
were 800.36 MiB process RSS, 635.14 MiB used main heap, 678.89 MiB committed main
heap, 206.56 MiB used worker heap, 238.39 MiB committed worker heap, 77.84 MiB
main-thread external memory and 1181.52 MiB raw container usage. Kernel high-water
was 1184.00 MiB. No sampled OOM kills or memory-limit hits occurred. These peaks
occur at different times and must not be added together.

Of 108 phase observations, 104 obtained all selected measurements and four were
partial. Median duration was 72 ms, p95 195 ms and maximum 282 ms. The 250 ms
budget is checked between reads, not a cancellation deadline for an in-flight
kernel read. Two partial observations exceeded it; two shorter observations had
one unavailable process. Their missing process totals are not zero-memory claims.
Three streamed-verification events and their metadata references survived projection.

## Resident-memory findings

MiB below are simultaneous approximate observations, not an accounting identity.
Process RSS comes from the existing sampler; anonymous memory comes from the
phase rollup. All rows below had zero active workers and complete selected proc data.

| Phase / elapsed seconds | Used heap | V8 committed | Process RSS | Process anonymous | Raw container |
| --- | ---: | ---: | ---: | ---: | ---: |
| Catalog drained / 621.004 | 55.51 | 113.06 | 656.10 | 591.95 | 1071.80 |
| Representative pressure deferral / 671.380 | 46.63 | 55.51 | 654.97 | 590.76 | 1027.13 |
| Representative cooldown / 731.382 | 40.35 | 43.50 | 141.28 | 77.44 | 496.46 |
| Comparison ready / 1327.805 | 594.28 | 646.96 | 790.70 | 727.09 | 1172.91 |
| Later idle attempt / 1466.410 | 218.86 | 369.14 | 787.20 | 723.71 | 1165.88 |
| Stopped / 1500.435 | 218.17 | 233.64 | 339.69 | 276.08 | 702.38 |

At 671.380 seconds all sampled snapshot/input/community/metadata weak references
were collectible and all nine workers created so far had exited. External memory
was only 6.97 MiB and V8 malloc accounting 1.02 MiB. The roughly 591 MiB anonymous
resident footprint therefore cannot be explained by the 55.51 MiB reported committed
heap alone. It later fell to 77.44 MiB naturally, with no GC command or cache drop.
This narrows the investigation to anonymous residency outside those reported V8
counters; it does **not** identify a particular native allocator or prove a leak.

PostgreSQL was a separate contributor: at that same complete observation its PSS
was 128.97 MiB versus 269.61 MiB summed RSS. Other processes contributed 75.30 MiB
PSS. Cgroup cache was 331.84 MiB, including 101.11 MiB shared memory. These overlap
with process mappings and must not be added or subtracted from admission totals.
The application process, not merely PostgreSQL/cache, had substantial anonymous
residency. The main heap remains significant again during later build/publication.

At stop, sampled input and verification references were zero; one comparison
handle and two community-vector references remained observable. Weak-reference
sampling does not inventory every retaining path, and there is no post-stop GC
proof that every cache is released. The fixture uses synthetic providers/vectors,
production service paths and a study schedule adapter, not a full live-provider or
Unraid deployment. Observer overhead and schedule/GC variation prevent causal
performance comparisons with the previous run.

## Confirmed next bug: comparison resource retries

The comparison sequence was `invalidated` at 94.191 seconds, `unavailable` at
223.111, `invalidated` at 413.814, then `memory_pressure` at 686.376. The next
admission attempt did not occur until 1286.402 seconds. Meanwhile memory had
fallen by 731.382 and representative admission succeeded at 791.386.

`liveMultiScaleRefresh.mjs` calls the same `due()` function for invalidation,
failures and `DiscoveryDeferredError`. It increments a shared exponential counter
and gates later attempts with `nextAt` before admission is checked. A fourth
failure schedules 480–600 seconds of delay. This accounts for the long `not_due`
interval; it is not continuing memory pressure throughout that interval.

A no-network, non-root probe of the exact image reproduced the mechanism with
an injected clock and zero jitter: after three synthetic failures, a resource
deferral returned `not_due` after 120 seconds and did not re-enter admission until
480 seconds. No provider was called. This probe diagnoses retry state; it is not
evidence that real time elapsed. No production retry code was changed this round.

## Local deployment

Before replacement, the local database was backed up to a private ignored archive
and its checksum/archive readability verified; the old image was tagged for rollback.
A read-only check found `cached_vectors_incomplete` at `snapshot_read` at
22:35:46.144 UTC and automatic recovery at 22:38:20.359 UTC. That event is distinct
from the earlier memory-pressure deferrals; current catalog readiness was `ready`.

Local Compose was recreated from the measured image and started at
`2026-10-06T23:24:41.221963952Z`, healthy with zero restarts. Existing mounts, 2 GiB,
user `1000:1000`, read-only root and `no-new-privileges` were preserved. Unraid and
the unrelated Harmoniarr container were not changed. A fresh pre-replacement backup
was verified in addition to the earlier backup; neither archive is committed.

An isolated schema dump followed by an independent schema check passed and cleaned
up. `database/schema/current.sql` is unchanged, through migration
`20261005_180000_ingestion_compatibility_fence.sql`, with 22 data-only seed migrations.
The five-minute sampler recorded 19 healthy observations from 23:25:24.723 through
23:30:21.427 UTC. Raw container usage ranged from 318.89 to 701.21 MiB; kernel
high-water was 742.17 MiB, with no OOM kills, limit hits or restarts. Read-only checks
found no comparison warning newer than this container's start. The earlier
23:19:45 memory warning recovered at 23:22:40, both before replacement.

Current readiness remained `backfilling`, with an informational wait for other
background work at 23:25:45. This is not proof of a completed live-provider refresh,
and a separate diagnostic process's admission check does not measure the main
application's warm caches. The local health window cannot turn the isolated
study's missing revalidation into a pass.

All seven workflows passed for source `1a08635a`: CI/CD, Resource Capacity Regression,
OSV, Trivy, CodeQL, Gitleaks and Copyright. The
[CI/CD run](https://github.com/cloudbyday90/Classifarr/actions/runs/37543689260)
includes successful database, build/test and installation jobs. Conditional policy
replay and manual Docker Hub cleanup were skipped. CI success does not override
the additional local catalog study's failed completion check.

## Random PR trial

Fresh enumeration found two open PRs. Random selection chose
[client typings #555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`. Applied its exact manifest/lockfile
diff: Node declarations 24.19.1 to 26.6.4, undici-types 7.24.6 to 8.9.0.
The unchanged runtime-major test failed exactly on the client Node-26 declaration.
Reverted only the trial diff before installation; no retained dependency update
and no PR merge. Registry metadata confirms the proposed undici-types range.

## Next decision

Follow-up: the [separate comparison retry policy](comparison-resource-retry-outcome.md)
has now passed mixed-failure regression tests and the unchanged full catalog study
through revalidation. That later run did not encounter comparison pressure, so it
does not replace this failed trace or prove natural comparison-pressure recovery.
Native/anonymous-allocation attribution remains the next memory investigation.

1. Separate bounded comparison resource-deferral timing from actual build/provider
   failure backoff, as already done for representative fitting. Preserve existing
   admission, TTL/revision checks, cancellation and genuine-failure budgets. This
   addresses a reproduced delay; its cost is explicit retry state and more frequent
   bounded admission checks, not more work while memory is unsafe.
2. Test mixed invalidation/failure/pressure sequences deterministically, then rerun
   this unchanged full-catalog profile through recovery **and** revalidation. Do not
   increase its deadline to manufacture a pass. Treat this as a pre-release follow-up.
3. Continue controlled native/anonymous-allocation attribution on synthetic data
   before choosing an allocator/V8-flag change or another cache refactor. This costs
   more measurement time but avoids mistaking temporary residency for a live-object
   leak. Keep memory safeguards unchanged; do not subtract PostgreSQL/cache or force GC.

The study instrumentation is retained for diagnosis; no broad runtime fix, release,
tag, dependency major update, new branch or Unraid mutation was made.
