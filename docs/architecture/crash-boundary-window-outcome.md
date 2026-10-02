# Bounded crash-boundary verification outcome

Date: 2026-10-02. Scope: isolated installation qualification; no release or live deployment.

## Decision

The complete no-cache, frozen-image rehearsal passed at
`2026-10-02T11:35:06.615Z`. The interrupted-backfill release-test blocker is
cleared for this candidate. This does not grant overall release approval or
prove the exact cause of the historical failed run. The separate
[design](crash-boundary-window-design.md) records official research, alternatives
and limits; the [release audit](release-readiness-audit.md) records remaining gates.

The implementation resolves the owned container and completes preparation before
the final database check, measures a conservative remaining fixture window, sends
SIGKILL directly to that container and requires an observed non-OOM exit within
the window. Fixed-stage, bounded diagnostics distinguish an invalid injection
from an application recovery failure. Production deadlines and exact task-count
assertions were not relaxed. New code is modular ESM.

## Negative experiment

An isolated real-Docker diagnostic delayed a successful readiness response by
nine seconds, then independently checked the same boundary again. The second
check failed the exact task snapshot assertion: the earlier checkpoint had
changed. The host measured a 10,223.766 ms verification round trip against only
5,253 ms of reported remaining hold time and rejected it as
`upgrade_crash_window_expired` before sending SIGKILL or starting recovery.

The diagnostic's own expected-failure assertions passed. Its owned resources were
cleaned. This establishes the stale-readiness mechanism and the safeguard's
response; it does not retroactively establish the cause of the older failure.
This diagnostic was a development build, not the frozen acceptance candidate.

## Frozen candidate and matrix

- Source: `a56e3f0f05b16520356837fb655df6b2f0323e38`, clean throughout the matrix.
- Image: `sha256:4871ab61fd473f436e2b03bdc73b30e4a059d0a78f7710e0d70a61b1768567ea`.
- One production image built with `--no-cache`, reused for every profile.
- Provenance-verified baseline: `v0.48.4-beta`, image digest
  `sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f`.
- PostgreSQL 18.6: 222 baseline migrations, 312 candidate/fresh migrations.
- Aggregate local receipt: `.tmp/release-rehearsal/receipt.json`; human-readable
  companion: `.tmp/release-rehearsal/summary.md`. These are regenerated local
  artifacts, not publication attestations or committed media data.

| Saved profile | Fresh + published upgrade | Recovery and 12 required checks | Saved configuration | Owned cleanup |
| --- | --- | --- | --- | --- |
| Standard | Passed | Passed | Unchanged | Passed |
| Unraid-style | Passed | Passed | Unchanged | Passed |
| Custom IDs | Passed | Passed | Unchanged | Passed |

Each profile passed interrupted-restore rejection, rollback, explicit verified
retry, movie/TV handoff and normal scheduler recovery. Each fresh and upgraded
installation also passed connection-pressure recovery and a separate 600-item
unfinished-backfill test. In each of those six backlog cases:

- all 600 original tasks completed, with five interrupted claims reclaimed;
- exactly 605 starts, zero duplicate completions and zero early reclaims;
- original inventory, committed ingestion, checkpoint and task identities retained;
- profiles current, TV progress before the interrupted claims expired;
- original 600,000 ms visibility leases preserved, music excluded, zero routing.

Recovery observation lasted 588,805–590,994 ms after restart; that is not a
shortened lease. Claims were already held before restart and observation began.

### Measured crash windows

The following diagnostics use the host monotonic clock. Charged elapsed time
starts **before** the readiness request and ends when container exit is observed.
It includes the complete verification round trip, not just kill-command time.

| Profile / storage | Reported remaining window (ms) | Charged time to observed exit (ms) |
| --- | ---: | ---: |
| Standard / fresh | 5,343 | 1,121.772 |
| Standard / upgraded | 6,330 | 1,027.634 |
| Unraid-style / fresh | 4,706 | 1,338.449 |
| Unraid-style / upgraded | 4,418 | 1,422.114 |
| Custom IDs / fresh | 5,444 | 989.183 |
| Custom IDs / upgraded | 5,644 | 1,118.395 |

All six passed exit-code 137 and `OOMKilled=false` checks before recovery.
These timing diagnostics supplement, rather than replace, the durable assertions.

## Resource and isolation observations

All scenarios verified two CPUs, two GiB and 128 PIDs. Across 36 recorded cgroup
snapshots, maximum observed memory was 345,378,816 bytes and maximum PIDs was 77.
Recorded OOM-kill, memory-limit-hit and PID-denial counters were zero. CPU
throttling counters were nonzero. These are point-in-time observations with
container-lifetime counters, not continuous peaks, minimum hardware requirements
or a sustained-load result.

Each connection-pressure exercise held 16 fixture connections for at least five
seconds against the isolated 32-connection configuration, observed the expected
`53300` denial and recovered a fresh connection in 32.6–84.0 ms. Health remained
healthy. These fixture settings did not alter the live database configuration.

All three owned project containers, networks and volumes were absent after the
run; the owned candidate tag was removed. The live Classifarr container retained
its `2026-10-01T22:50:37.214386504Z` start time, healthy status and zero restarts.
Unrelated containers, live data, permissions and deployment templates were untouched.

## Validation and scope

- Full backend unit run: 1,616 suites, 49,451 passed tests, one existing skip.
- Focused crash/backlog/rehearsal regression run: eight suites, 271 passed tests.
- Server lint, type checks, dependency-boundary checks, static ESM import and
  mock-shape checks passed; scoped Markdown and whitespace checks passed.
- Ownership drift check passed without database/provider access or writes. Its
  existing unresolved paths remain unresolved; it does not authorize takeover.
- [Exact-source CI/CD](https://github.com/cloudbyday90/Classifarr/actions/runs/36993068277)
  passed build/tests, database tests, ordinary installation acceptance and release
  readout. Same-source CodeQL, Gitleaks, OSV, Trivy, copyright and resource-capacity
  checks passed. Publication jobs were skipped.
- GitHub MCP discovery and repeated saved-login CLI queries returned no open PRs.
  No random open PR was available; no closed PR was substituted or merged.

The final documentation commit is separate from the image-tested source above.
No production behavior, API, schema, dependency, UI, version or release tag changed.
No W3C conformance claim follows from a CLI-only change; the design links the
relevant status-message guidance for any future UI projection.

## Recommendation stack

1. Keep the measured-window protocol and strict recovery invariants. Benefit:
   trustworthy fault injection without changing production behavior. Cost:
   sufficiently slow hosts can conservatively reject a run and require retry.
2. Next, connect the existing 30-minute resource soak to the frozen-candidate
   lifecycle. `runResourceStudyCompose` already accepts `candidateImageId`;
   collect same-image workload, recovery and settled-idle evidence before cleanup.
   This costs time but closes the continuous-resource-observation gap without
   inventing another service or treating smoke/snapshots as a soak.
3. Perform actual saved Unraid/Community Apps operator acceptance and define the
   supported upgrade floor. These container profiles cannot certify a real host
   or older unsupported upgrade paths.
4. Only after those gates and an explicit release decision, select a version,
   freeze/recheck the release source and use protected publication plus consumer
   digest smoke. Do not publish from this maintenance commit.
