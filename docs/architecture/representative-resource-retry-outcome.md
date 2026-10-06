# Representative resource retry outcome

Date: 2026-10-06. [Design, tradeoffs and official sources](representative-resource-retry-design.md).

## Implementation

The ESM `representativeRefreshRetry` factory separates resource eligibility from
genuine failure backoff. Typed discovery deferrals impose a fixed 60-second minimum
without increasing or clearing the failure counter. Real failures retain the
existing exponential backoff and one-hour cap. Existing successful/configuration
reset points, cache behavior, cancellation, readiness, single-flight execution,
memory thresholds/hysteresis and publication checks are unchanged. No new timer,
migration, persistent state, dependency, operator setting or forced GC.

## Verification

Against the previous refresher, the final new behavioral suite failed seven tests
and passed three. With the change, all four focused suites / 59 tests passed.
These exercise repeated pressure/unknown-memory/contention deferrals using the real
admission policy and a fixture lease, exact and late eligibility, retained genuine
failure history, readiness pauses, the unchanged scheduler registration,
cancellation and pressure at the publication checkpoint. Separate policy tests
verify the one-hour cap and ephemeral restart behavior. Fixture clocks prove logic,
not elapsed production cooldowns; the image study remains required.

Broader validation passed 178 suites / 2480 tests. Server typecheck, lint, normal
and production dependency analysis, all 40 tooling tests, static imports,
copyright, ownership and Markdown checks passed. Ownership review hashes were
not refreshed; this does not claim existing unresolved writer paths are fixed.
Image evidence is recorded below; local checks are recorded separately.

All seven GitHub workflows passed for code commit
`e0cbdb67593c87a32d9bfca239b3312a86260e41`: the
[main pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/37532106031),
resource capacity regression, OSV, Trivy, CodeQL, Gitleaks and copyright. The main
pipeline's database, fresh-install/upgrade and build/test jobs succeeded; manual
tag cleanup and the conditional synthetic replay were skipped. This is not a claim
that those two conditional jobs ran. The subsequent documentation-only commit does not
change the tested runtime source or image.

## Random PR trial

Fresh enumeration found two open PRs; random selection chose
[server typings #556](https://github.com/cloudbyday90/Classifarr/pull/556) at
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Its exact two-file manifest/lockfile
change was applied locally. The runtime-major policy rejected Node 26 declarations
for the pinned Node 24 deployment. Those trial changes alone were reverted before
installation; no merge, retained dependency change or runtime-major upgrade.
Registry metadata confirmed 26.6.4 depends on undici-types ~8.9.0. The restored
policy checks are included in broader validation.

The server outdated check also found dotenv 18.0.6, express-rate-limit 8.7.1,
js-yaml 5.4.3 and knip 6.40.0 available. These were not installed or assessed as a
security batch here. They remain separate from this retry behavior change.

## Image preparation

The local testing database backup is 75,625,484 bytes and passed checksum and
archive-list verification (not a restore rehearsal). The previous image
`sha256:da153c1df913cc06976ac134d2b1505940fafd3bc1d3b20cc9c327b9e5eb019f`
was retained as `classifarr:pre-memory-3b711508-67d5-4800-983d-efa677ff01cc`.
No Unraid or unrelated container access.

The no-cache build passed at commit
`e0cbdb67593c87a32d9bfca239b3312a86260e41`. The tested immutable image is
`sha256:880d06b7afc333b86cfce159b168908fa7d2c02c051144266976f9017219fd34`,
native manifest
`sha256:ab592a4df13e716b0afadd52902383100353978647eafd014212164c1dea685e`,
image configuration
`sha256:fca249dcab1acd4d92a41eb8d648b185d0bdea5bb0a608c6c2069bc42b5a307f`.
The OCI source label matches the commit. The isolated shared-catalog study used
the unchanged workload, limits and acceptance checks.

## Shared-catalog result and memory attribution

The study passed in 1002.115 seconds (16 minutes 42 seconds), within the unchanged
25-minute execution deadline. All 20 growth waves and 210 scans completed:
10 libraries/owners, 5776 imported and enriched items, 5776 cached description
vectors, and zero remaining pending/failed/routing/handoff tasks or service errors.

| Checkpoint | Elapsed seconds | Result |
| --- | ---: | --- |
| Import, metadata and description cache drained | 621.068 | All 5776 complete |
| Representative refresh settled | 626.916 | Published |
| Comparison refresh settled | 667.586 | Ready |
| Representative later refresh | 984.410 | Up to date |
| Comparison later refresh | 1001.108 | Revalidated, 333.522 seconds after ready |

All nine workers exited; active workers and all admission-class reservations were
zero at shutdown. Discovery admitted 11 attempts, with zero discovery pressure,
unknown-memory or contention refusals. Queue admission correctly refused 39
pressure attempts and subsequently completed the workload. No OOM kills, memory
limit hits or PID-limit hits occurred. The 2 GiB, two-CPU, 128-PID budget remained
unchanged, and exact owned-resource cleanup passed.

**Scope of the pass:** `pressureRecoveryObserved` is false. This execution proves
workload completion and later revalidation, not the stricter post-drain discovery
pressure-to-ready-to-revalidated sequence. The prior failed run remains preserved
in the [snapshot lifetime outcome](representative-snapshot-lifetime-outcome.md).
Repeated admission refusal and recovery are covered by the before/after regression
tests, but no claim of naturally reproduced pressure recovery is made here.

One-second sampled maxima were RSS 857.32 MiB, main heap used 703.65 MiB, external
39.33 MiB (including 39.18 MiB array buffers), worker heap 211.88 MiB and cgroup
usage 1229.64 MiB. The kernel high-water mark was 1236.72 MiB. These maxima are not
necessarily simultaneous; worker heap is not additional process RSS, and array
buffers must not be added again to external memory. Natural scheduling/admission
and GC differed from the prior run, so this is not causal proof of a memory saving
from the retry-only patch.

The complete-catalog comparison still raised main heap from 275.78 MiB at community
entry to 475.52 MiB at build end and 692.18 MiB at the fresh-read checkpoint. By
695.910 seconds, weak references to old snapshots, decoded vectors, owned inputs
and community rows were gone; the intended live cache handle and two shared
community vectors remained. By 935.921 seconds, main heap was 217.20 MiB and
cgroup usage 675.09 MiB. This supports transient allocation plus retained active
cache, not a stuck worker or a demonstrated permanent snapshot leak.

The final revalidation allocated new snapshots, still weakly observable at shutdown.
This profile has no post-stop natural-GC observation window, so their final
reclamation is not proven. It exercises real import/queue services and production
refresh registration through the study scheduler, with synthetic providers and
deterministic vectors; it is not the full application scheduler or a live-provider
rehearsal. Its fitting fixture does not install the real shadow/recovery callbacks;
the separate callback lifetime regressions remain relevant.

The 86-record trace is retained at
`.tmp/resource-study/classifarr-resource-study-0b4cd2b69ae1e1f40b46d6bb7db7be32/comparison-trace.json`,
SHA-256 `da26ba68816130181ff8a3397829233d095c70c6f32e9fefb0c07c762f075b7b`.
The adjacent `result.json` contains the successful receipt. These are local,
regenerable intermediates, not committed release evidence.

## Local deployment checks

Local testing Compose was recreated from the tested immutable image and became
healthy. The source label matches `e0cbdb67593c87a32d9bfca239b3312a86260e41`.
The existing mounts, 2 GiB memory limit, user `1000:1000`, read-only root and
`no-new-privileges` setting were preserved. Schema generation (`--dump`) and an
independent fresh-container schema check both passed and cleaned up; the committed
schema remained unchanged. The five-minute health sampler completed with 19 healthy
samples, zero OOM kills or memory-limit hits, cgroup usage 476.66–612.51 MiB
(521.46 MiB at the final sample), and a 960.02 MiB kernel high-water mark since
container startup. Samples span 21:35:54.700–21:40:49.499 UTC; this short observation
is not a sustained production soak.

Read-only diagnostics still reported `backfilling`. The most recent stored
comparison warning was at 21:32:45.030 UTC, before the new container started at
21:33:13.578 UTC. No new comparison warning appeared in the bounded check. A
separate-process memory-admission probe is not evidence of the main application's
cache state or successful comparison refresh while readiness is blocked. Unraid
and the unrelated container were untouched.

## Recommendation

Keep the separated retry accounting and unchanged admission safeguards. Next,
investigate the comparison build/fresh-read allocation overlap, preserving source
validation and atomic publication. The benefit would be lower transient peaks;
the risk is retaining stale or partial comparison state if lifetime changes are
incorrect. Establish a targeted before/after regression and repeat this workload
before accepting an optimization. Do not raise limits, force GC or relax completion
to obtain a pass. No release, tag, new branch or Unraid access.
