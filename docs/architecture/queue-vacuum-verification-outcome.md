# Queue maintenance verification outcome

Date: 2026-10-07. Design: [verification and CI diagnosis](queue-vacuum-verification-design.md).

## Finding and implementation

The integration success fixture competed with autovacuum immediately after
re-enabling it. Real PostgreSQL reproduced a skipped `VACUUM` with warning
`55P03` after admission. The executor correctly rejected completion. This is a
demonstrated fixture race, not evidence that production should ignore warnings,
retry immediately, increase budgets, or disable maintenance safeguards.

The success fixture now keeps autovacuum enabled with temporary table thresholds
above its synthetic workload. It restores only the edited options and removes
its synthetic inventory even when the callback fails. Three committed cycles
verify actual dead-row reclamation, both maintenance counters and durable state.
A separate lock inserted after reservation proves that a skipped attempt remains
unverified, keeps its attempt/cooldown, and performs no second VACUUM on retry.
Bounded test evidence includes fixed categories, counter strings and notice
codes, not raw errors, queries, credentials or row payloads.

No production code, schema, dependency, deployment template, memory admission,
retry policy or security boundary changed. The recovery-change skill kept the
fix focused on demonstrated evidence and durable no-replay behavior.

## Local verification

| Check | Result |
| --- | --- |
| Original success fixture, 60 repetitions, normal cadence | 72/72 including other cases |
| Original fixture, one-second autovacuum cadence | 70/72; one warning-based unverified attempt, one admission deferral |
| Revised fixture, same accelerated cadence | 74/74 including deterministic contention and cleanup |
| Focused queue unit tests | 140/140 |
| Backend test lint | Passed |
| Full backend unit suite | 1,743 suites, 54,129 passed; one Linux-only case skipped on Windows |
| Full PostgreSQL integration suite | 245 suites, 2,942 tests passed in 1,013.803 seconds; one opt-in provider-fault Compose suite/test not run |
| Linux directory fsync / exclusive copy | Passed against the rebuilt image's actual module |
| Backend typecheck, ESM static imports, copyright | Passed |
| No-cache Compose build | Passed; source `773f7e5e72398f012a22495d027c8290312ea9cd` |
| Disposable-image schema dump, then independent check | Both passed; no snapshot drift |

The one-second cluster setting and 60-repeat expansion were temporary experiments
only in disposable Testcontainers PostgreSQL 18 databases. Neither remains in
the committed test. A first helper draft exceeded the task-type length limit;
the fixture identifier was shortened. Initial assertions also needed to allow
read-only inspection of unrelated settings and the existing `cooldown` ledger
state. These were test-development failures, not production defects.

The historic failure in source run 37677016163 saved only the generic error.
Its exact cause cannot be reconstructed conclusively from the reproduction.
The integration skip is `ai-provider-fault-compose.test.mjs`, which requires its
dedicated isolated Compose runner; it was not enabled in this scoped round.
No queue-maintenance test was skipped. The Windows-only unit skip was evaluated
separately with the image's Linux fsync/exclusive-copy probe. Local passes are
not substitutes for the exact source's still-running CI or release acceptance.

## Local image evaluation

The no-cache image is
`sha256:157666038f5735fca644b80be1ce6a3c5e941c0e8bd9cac9e942f1988f329d91`.
Docker's inspected image identity is recorded here, not the build's config digest.
An initial check used the config digest and failed before container creation;
using the inspected runnable identity corrected the launch without a code change.

Before local replacement, a 75,588,190-byte database archive was checksum-verified
and its archive listing read successfully. The former image is retained under a
unique local rollback tag. Backups and raw logs stay in ignored `.tmp`; neither
is committed. The rebuilt local container passed Compose's health wait and the
HTTP health check, with its database connected. UID/GID `1000:1000`, read-only
root, `no-new-privileges`, existing data/media mounts and 2-GiB limit are unchanged.
Both schema operations used separately owned disposable image containers and
cleaned them up; the local or Unraid data was not used to generate the snapshot.

Five-minute observation (20:33:45–20:38:44 UTC): all 19 samples were healthy,
with no OOM, cgroup limit hit or restart. Sampled cgroup usage ranged from
320.07 to 741.22 MiB; the kernel high-water reading was 855.29 MiB. Readiness
changed from `ready` to `backfilling`; no newer comparison warning than the
pre-existing 18:04:45 UTC entry was present in the bounded check. These are
operational observations, not a controlled memory-improvement result or proof
of completing optional comparison work. The probe's helper-process memory
admission is not the application's main-process memory reading. Unraid remained
untouched, and production memory safeguards remain unchanged.

## Remote evidence

Source commit `773f7e5e72398f012a22495d027c8290312ea9cd` is pushed to `main`.
[Its CI run](https://github.com/cloudbyday90/Classifarr/actions/runs/37683016793)
is in progress at the final local readout. OSV, Trivy, CodeQL, Gitleaks, Copyright
and Resource Capacity Regression passed for this source. The main pipeline's
Fresh Install and Published Upgrade job passed; Build and Test and Tests with
Database are still running. The earlier documentation baseline run 37680263936
passed, but is not substituted for the new source's result. No
release, tag or PR merge was created. Documentation-only
follow-up commits record results and do not change the image's tested runtime.

## Random open PR trial

Fresh random selection from two open PRs chose
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`. Its exact client manifest/lock diff
upgraded Node declarations to 26.6.4 and undici-types to 8.9.0. Registry metadata
matched, but the project's Node-24 runtime contract gate failed (7/8 versus 8/8
before and after reversal). The trial was reverted; no merge, installation or
dependency upgrade was retained. Do not trade runtime accuracy for a green
dependency-version badge.

## Recommendation stack

1. Retain strict production verification and the controlled database fixtures.
   Benefit: reliable success and contention coverage; cost: small ESM test helpers.
2. Verify the exact source in CI before treating the historic failure as resolved.
   Local repetition alone cannot substitute for the complete CI pipeline.
3. Resume native/anonymous-memory attribution across full refresh/stop cycles,
   with workers, snapshots and caches measured and memory safeguards unchanged.
   This round makes no claim of fixing retained memory or recovering Unraid.
