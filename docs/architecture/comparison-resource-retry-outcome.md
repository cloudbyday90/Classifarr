# Comparison resource retry outcome

Date: 2026-10-06. [Design, tradeoffs and official sources](comparison-resource-retry-design.md).

## Implementation

The comparison refresher now uses a small ESM retry-policy factory. Typed resource
deferrals wait at least 60 seconds without increasing or resetting genuine failure
history. Independent deadlines cannot shorten a pending true-failure delay. The
existing exponential sequence, jitter, cap, successful-refresh schedule, clock and
configuration reset boundaries remain. No timer, persistent record, migration,
memory-limit change, allocator change or forced collection was introduced.
Success resets now wait until admission's final checkpoint returns; a new failing
regression exposed the previous reset-before-checkpoint edge case.

Every attempt still needs real admission, cancellation and fresh source/provider
verification. Pressure clears cached context; contention retains it only within
the existing TTL/revision rules. Ordinary retrieval remains available without
optional comparison context. This fixes retry accounting, not a demonstrated leak.

## Code and image validation

The added mixed-failure regressions failed all three typed-refusal cases against
the original refresher (24 other tests passed). After the fix, 10 focused suites /
153 tests pass, including real admission with a fixture lease, repeated refusals,
retained fourth-failure backoff, jitter bounds, reset boundaries, cancellation,
late ticks and cache expiry. Injected clocks prove logic, not elapsed recovery.
The final-checkpoint regression separately failed before moving the success reset
and passes afterward. Server lint, typecheck, both dependency checks, copyright,
static-import/mock-shape checks and Markdown pass. All eight restored runtime-major
checks pass. The full rerun on the final checkpoint-adjusted source passes 1727
suites / 53,686 tests with one Windows-only Linux-fsync skip. The same
complete/exclusive-copy and unchanged-source assertions pass against the candidate
image's module in a non-root, read-only, no-network Linux container, without an
appdata mount.

The no-cache build passes, including the client production build. A separate
non-root/no-network probe of the image's production refresher proves three genuine
failures followed by repeated 60-second resource cooldowns and retained 480-second
fourth-failure backoff, with zero provider calls. Its clock is injected; it is not
elapsed recovery evidence. The unchanged full catalog study passed; its scope
and limitations are recorded below.

## Measured artifact and preparation

- Source: `d5ecc6aece8bab195ea40aff2900b6e1856aa47b`, clean `main` at build.
- Image/index: `sha256:54eee36f94f6e4867ab6a63508d5189102408c1f22643ea2c909d52d5e3337dd`.
- Native manifest: `sha256:2993b721cc4c096e6a52ebd1bb53f77df8f4237b5e614a5c68c26377658249c0`.
- Config: `sha256:342bdcfc15019adb7293f34da9cb9c7ad9c87f353fc10104f11785fdce27dce8`.

The OCI revision matches the source. The fresh local database backup is 75,606,613 bytes,
with checksum and archive readability verified (not a restore rehearsal). The prior
image `sha256:9a9969816684bde772fccb148ff40d43b3d42594eea6698c72bfdc36301fb7eb`
is retained as `classifarr:pre-memory-cd7c4697-0379-4cdf-81ec-e61246646b0a`.
The private backup is ignored, not committed. Only local testing Compose is in scope.

The catalog study retains two CPUs, 2 GiB, 128 PIDs, an internal network, synthetic
providers and real catalog/queue/refresh services. No competing local builds/tests,
forced GC, injected elapsed time, modified workload or extended deadline run during it.
The prior failed resident-memory study and its trace remain preserved separately.

## Complete catalog and refresh-cycle observation

The unchanged study passed in 1,035.711 seconds (17 minutes 15.711 seconds), within
its original deadline. It completed 20 waves, 170 scans and all 5,776 inventory,
metadata, description and cached-vector records across ten libraries. Pending,
failed, routing, handoff and service-error counts were zero. Load drained at
622.574 seconds; comparison became ready at 715.049 and revalidated at 1,035.378,
320.329 seconds later. Representative fitting published and later reported current.
All 14 workers exited, with no active admission leases at completion. No OOM kill,
memory-limit hit or PID-limit hit was recorded.

The trace contains 137 records. Its private directory is
`.tmp/resource-study/classifarr-resource-study-f8d69d4588d9feef8720b431b9fb6718/`;
the trace SHA-256 is
`79da6a55dec30f4bffded85b7c7c7efc9b9358e4248e18809a79940a41ec1209`.
The runner's owned-container, volume and network cleanup passed, and subsequent
label-scoped inventories were empty. The measured image and previous failed trace
remain available; raw traces and database archives are not committed.

Simultaneous observations below are MiB, with elapsed seconds. Container usage is
the raw cgroup total, not Docker's cache-adjusted display.

| Phase / elapsed seconds | Main heap used | Main V8 committed | Node RSS | Anonymous resident | Container total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Drained / 622.673 | 210.60 | 252.73 | 654.22 | 592.57 | 1052.39 |
| Ready / 715.049 | 585.19 | 650.23 | 789.70 | 727.15 | 1148.89 |
| Idle / 791.700 | 218.87 | 383.86 | 786.29 | 725.02 | 1146.19 |
| Idle / 911.705 | 219.41 | 231.64 | 336.67 | 275.59 | 681.45 |
| Revalidated / 1035.378 | 461.62 | 525.58 | 644.50 | 581.32 | 1000.54 |
| Stopped / 1035.701 | 463.72 | 525.58 | 643.99 | 582.52 | 1001.74 |

All listed samples had zero active workers and complete resident observations.
At the first idle sample, snapshot, decoded-vector, owned-row, community-row and
verification-metadata weak references were zero; the comparison handle and two
community-vector objects remained as intended cache. The later natural fall in
anonymous residency demonstrates release in this run, not proof of a specific
allocator cause or absence of every leak. Final publication retained one snapshot,
decoded-vector and verification-metadata reference at stop; this profile has no
post-stop collection window, so their final reclamation is unproven.

Separate, non-simultaneous peaks were Node RSS 799.02 MiB, main heap 640.85 MiB,
worker heap 209.30 MiB, raw container 1158.31 MiB and kernel container peak
1162.53 MiB. Do not sum independent peaks. Of 120 resident observations, 114 were
complete and six partial; median/p95/max collection time was 71/166/279 ms. The
250 ms observer budget is checked between reads, not by cancelling an in-flight read.

There were 16 admitted discovery attempts and **no discovery pressure refusal**;
ingestion and queue work did encounter their own memory refusals. The receipt
correctly reports `pressureRecoveryObserved=false`. This proves catalog completion
and later comparison revalidation, not natural comparison-pressure recovery or a
causal memory/performance improvement over the prior run. Refusal timing and genuine
failure history are instead covered by regressions and the image logic probe.

## Local deployment and CI

Local testing Compose was recreated from the measured artifact with no further
build. Its revision is `d5ecc6ae`, user remains `1000:1000`, root filesystem read-only,
memory limit 2 GiB, and health became healthy. Schema verification and the health
observation window passed. The isolated dump and independent check both include
migrations through `20261005_180000_ingestion_compatibility_fence.sql` and 22 data
seeds, with no change to the tracked schema snapshot. Both owned schema containers
were cleaned up.

The five-minute local observation collected 19 samples from 00:16:41 to 00:21:37
UTC on October 7: all healthy, zero memory-limit hits/OOM kills/restarts. Raw
container usage ranged from 322.16 to 788.80 MiB; the kernel's lifetime peak since
recreation was 964.43 MiB. Read-only diagnostics found no new comparison warning
since the 00:15:24 restart, but readiness remained `backfilling`; comparison was
correctly waiting for other background work. This short local check is not proof
of completed local backfill or a sustained-memory soak. The isolated catalog
study above supplies the full-refresh/revalidation evidence. Unraid and the
unrelated Harmoniarr container were not changed.

The first source CI run passed build/test and fresh-install/upgrade jobs but failed
a provider-study daily-counter assertion while crossing UTC midnight. The separate
[midnight accounting correction](provider-study-midnight-outcome.md) passed 22
targeted PostgreSQL tests and was pushed as `e559f873`. It changes tests/docs only,
excluded from the image; it does not relabel the measured image as that later commit.
The original failed run remains recorded. Follow-up checks are tracked in the
[CI run for that test-only correction](https://github.com/cloudbyday90/Classifarr/actions/runs/37551094913);
local results do not substitute for its own receipt. Later documentation-only
commits likewise do not change the measured image inputs.

## Random PR trial

Fresh enumeration found two open PRs. Random selection chose
[client typings #555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`. Applied its exact two-file diff locally:
Node declarations 24.19.1 to 26.6.4 and undici-types 7.24.6 to 8.9.0. The unchanged
runtime-major gate failed on the client Node-26 declarations (seven tests passed).
Reverted only that trial before installation. No retained dependency change or
PR merge; Node 24.21.0/npm 12.2.0 remain pinned. The restored gate passes.

## Next decision

Keep the separate cooldown: the unchanged image study verified completion and
later revalidation. Its benefit is timely reconsideration after resources recover;
its cost is more bounded admission checks during sustained pressure. Do not reset
true failures, relax admission or lengthen the study to obtain a pass. Next resume
controlled native/anonymous-residency attribution before another memory fix, with
available dependency patches handled as a separate reviewed batch.

No release, tag, new branch or Unraid change.
