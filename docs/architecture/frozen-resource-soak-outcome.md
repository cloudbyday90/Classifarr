# Same-image sustained resource qualification outcome

Date: 2026-10-02. Result: passed; no release or live deployment performed.

## Accepted source and scope

- Tested clean source: `03af7b5cd34c2ff309700fd7e450608907cb8454`.
- Command: `node scripts/run-frozen-release-rehearsal.mjs --no-cache`.
- One local image ID:
  `sha256:143709da63b8db7659ca997a5f06856d492d996fdfcbe529d3f7441f0c162644`.
- Aggregate receipt: `classifarr.frozen-release-rehearsal.v2`, completed at
  `2026-10-02T19:00:06.827Z`, with clean-source checks and owned cleanup passed.
- Local evidence: `.tmp/release-rehearsal/receipt.json` and `summary.md`.
  Detailed soak evidence is in
  `.tmp/resource-study/classifarr-resource-study-73e8ddcc7cf2ad4c2fb1a56bedaef6ba/`.
  These generated files remain untracked; rerunning replaces the aggregate files.

The soak and all three installation profiles used that same image, serially.
No historical passing receipt was substituted. Later documentation-only commits
do not change the identity of the tested image. See the separate
[design, research and tradeoffs](frozen-resource-soak-design.md).

## Sustained resource results

The existing synthetic service study ran a 30-minute workload, natural drain and
two-minute settled idle under enforced 2-CPU, 2-GiB and 128-PID limits. Total
observed duration was 1,925.955 seconds on cgroup v1.

| Check | Observed result |
| --- | --- |
| Unique movie/TV items completed | 1,600 / 1,600 |
| Held pressure cohort completed | 20 / 20; first dispatch 0.53 seconds after pressure cleared |
| HTTP retry cohort completed | 8 / 8; 11 attempts; two charged retries |
| HTTP attempts during pressure | 0 |
| Pending / failed / routing work at finish | 0 / 0 / 0 |
| Sampled raw container-memory peak | 436.25 MiB |
| Sampled container CPU, 95th percentile | 0.845 cores |
| Sampled PID peak | 61 |
| Maximum sampled event-loop p99 delay | 80.48 ms |
| OOM kills / memory-limit hits / PID-limit hits | 0 / 0 / 0 |
| CPU accounting periods with throttling | 4.62% (762 / 16,485 periods) |
| Settled idle observation | 120.3 seconds, 61 samples, zero pending work |

There were 853 synthetic evaluation runs using 400 rows and 768-dimensional
vectors. This exercises evaluation work, not AI accuracy. The bulk first-pass
provider data is synthetic; only the eight-item retry cohort uses loopback HTTP.
Credential repair and quota-day reset are explicit fixture actions, not automatic
production credential changes. No external provider traffic was required.

During idle, early-to-late window medians fell from 306.45 to 291.20 MiB for raw
container memory, 209.58 to 208.12 MiB for whole-probe RSS, and 70.28 to 41.48 MiB
for main-thread heap. Workers settled without forced GC or a restart to reduce
the footprint. This run does not establish a long-term leak verdict, minimum
supported hardware or capacity for a large live library. Throttled-period
percentage is not percentage of wall-clock time, and sampled peaks are not
instantaneous maxima. Cgroup v1's unavailable v2 OOM-event field remains null;
the measured OOM-kill and limit-hit counters are reported separately.

## Same-image installation and recovery results

| Saved configuration | Fresh install + recovery | Published upgrade + recovery | Configuration preserved |
| --- | --- | --- | --- |
| Standard | Passed | Passed | Yes |
| Unraid-style | Passed | Passed | Yes |
| Custom user/group | Passed | Passed | Yes |

Each of six interrupted 600-item backlogs completed all original tasks with five
expired-claim reclaims, 605 starts, zero duplicate completions, zero early
reclaims and no routing work. Music remained excluded. All crash checkpoints
were verified within their allowed windows. Connection-pressure recovery,
persisted migrations, interrupted-restore protection and verified restart also
passed. The published baseline remains `v0.48.4-beta`.

Read-only checks after completion found no containers, volumes or networks for
the four owned fixture projects and no candidate rehearsal tag. Synthetic
fixture data was discarded and can be regenerated; live inventory was not
touched. Live Classifarr remained healthy with its original
`2026-10-01T22:50:37.214386504Z` start time and zero restarts.

## Code validation and PR request

- Full backend unit suite: 1,617 suites, 49,507 passed tests and one existing skip.
- Focused rehearsal/resource suites: nine suites, 357 tests passed, including
  rejection of wrong-image, short, incomplete, malformed and unsafe evidence.
- Server lint/type checks, ESM checks, dependency analysis, Markdown lint and
  `git diff --check` passed.
- Exact-source [CI/CD run 37037105191](https://github.com/cloudbyday90/Classifarr/actions/runs/37037105191)
  passed, including database and installation tests. CodeQL, Gitleaks, OSV,
  Trivy, copyright and the resource-capacity workflow also passed for that source.
  Image publication was skipped; this was not a release.
- GitHub MCP search and the saved GitHub CLI login both returned zero open PRs,
  including a recheck after the rehearsal. No PR was applied or merged; a closed
  PR was not substituted for the requested random open PR.

## Recommendation stack

1. Keep the same-image sustained soak as a required local qualification step.
   Benefit: matched recovery/resource evidence. Cost: roughly two hours for the
   full no-cache soak and matrix on this host. Do not replace it with smoke.
2. Next, capture operator acceptance on an actual saved Unraid/Community Apps
   installation: image-only update, preserved settings, import/metadata recovery,
   disabled optional AI behavior and clear accessible status. This local profile
   proves neither physical Unraid compatibility nor operator usability.
3. Define the supported upgrade floor. Test older baselines separately if the
   release promises support beyond the currently pinned `v0.48.4-beta` baseline.
4. Only after an explicit release decision, select/freeze the version, rerun
   applicable acceptance for that final source and verify published immutable
   multi-architecture digests through the protected publication workflow.

No production limits, templates, schemas, dependencies or routing behavior were
changed. Recovery completion remains import plus metadata; optional AI work is
not a requirement, and unknown historical ownership is not automatically adopted.
