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

## Evidence so far

| Check | Result |
| --- | --- |
| Original success fixture, 60 repetitions, normal cadence | 72/72 including other cases |
| Original fixture, one-second autovacuum cadence | 70/72; one warning-based unverified attempt, one admission deferral |
| Revised fixture, same accelerated cadence | 74/74 including deterministic contention and cleanup |
| Focused queue unit tests | 140/140 |
| Backend test lint | Passed |

The one-second cluster setting and 60-repeat expansion were temporary experiments
only in disposable Testcontainers PostgreSQL 18 databases. Neither remains in
the committed test. A first helper draft exceeded the task-type length limit;
the fixture identifier was shortened. Initial assertions also needed to allow
read-only inspection of unrelated settings and the existing `cooldown` ledger
state. These were test-development failures, not production defects.

The historic failure in source run 37677016163 saved only the generic error.
Its exact cause cannot be reconstructed conclusively from the reproduction.
Full-suite, image and CI results will be recorded after they finish; these local
focused passes are not release acceptance evidence.

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
