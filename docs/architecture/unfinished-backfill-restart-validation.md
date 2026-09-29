# Unfinished backfill restart validation

## Scope

Implements [the restart design](unfinished-backfill-restart-design.md) using the
existing opt-in installation-budget launcher. No production services, migration,
dependency, live library, resource limit, routing policy or release version changes.

The observer verifies original committed capture/handoff, inventory and task identities;
durable claim/completion counts; natural ten-minute visibility expiry; sibling
TV progress; current profiles; music exclusion; and separate resource snapshots.
It cannot establish exactly-once remote side effects or stale-worker fencing.

## Result — September 28, 2026

**Passed:** clean-source fresh installation and pinned published-release upgrade,
including all twelve installation checks, both resource-budget scenarios and
owned-resource cleanup. The receipt completed at `2026-09-29T00:30:05.258Z`
(September 28 in the local America/New_York timezone).

Command: `node scripts/run-runtime-installation-acceptance.mjs --ci --resource-budget`.
The launcher used the clean source revision below; subsequent changes only record
the results in documentation.

- Source: `300ada4cd6d9782e8432f07152fea047df5026c2`.
- Candidate image: `sha256:2e94801221ea1d7890443d9211aa40e2b8c62e235f3d2700962231dc569c6f54`.
- Published baseline: `v0.48.4-beta`, revision
  `a0e417fd714919bb4ca30e20f9cd2380136ca74e`.
- Verified baseline image:
  `ghcr.io/cloudbyday90/classifarr@sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f`.
- PostgreSQL: `180006` (18.6) for baseline, fresh and upgraded databases;
  migrations advanced from 222 to 297, matching the fresh installation.
- Local ignored receipts: `.tmp/ci/runtime-installation-acceptance.json` and
  `.tmp/ci/runtime-installation-acceptance.md`.

### Measured unfinished-backfill recovery

| Measurement | Fresh installation | Published-data upgrade |
| --- | --- | --- |
| Movie / TV inventory items | 300 / 300 | 300 / 300 |
| Pending / processing at crash | 595 / 5 | 595 / 5 |
| Original visibility lease | 600 s | 600 s |
| Reclaimed original tasks | 5 | 5 |
| Total claims / durable completions | 605 / 600 | 605 / 600 |
| Early reclaims / duplicate completions | 0 / 0 | 0 / 0 |
| Read-only recovery observation | 590.666 s | 590.664 s |
| Memory before crash / after recovery | 252.92 / 264.60 MiB | 247.48 / 271.77 MiB |
| PID/thread count before crash / after recovery | 51 / 50 | 51 / 50 |
| Enforced CPU / PID / memory limits | 2 CPUs / 128 / 2 GiB | 2 CPUs / 128 / 2 GiB |

In both scenarios, committed ingestion receipts, inventory and task IDs remained
unchanged. TV work completed before the interrupted movie leases expired; all
profiles became current. Music was excluded and no routing task was created.
The recovery observer neither reseeded data nor invoked workers nor repaired
statuses. Its duration begins after restart readiness, so it is shorter than
the original lease; each reclaimed task's timestamp was checked against its
original deadline.

The existing connection-pressure case also passed: PostgreSQL rejected excess
connections with `53300`, all 16 injector connections were released, and a new
connection plus HTTP health recovered in 36.24 ms (fresh) / 29.20 ms (upgrade).
The existing restore crash, rejected unverified startup, explicit verified retry
and normal-restart checks all remained passing.

### Resource interpretation and limits

Local Docker exercised **cgroup v1**. All six snapshots per scenario recorded
zero memory-limit hits, OOM kills and PID-limit denials. The final post-recovery
process epochs recorded 58 CPU-throttled periods (fresh) and 50 (upgrade): the
CPU quota was active, and recovery still completed. These are lifetime counters,
not deltas across restarts. Cgroup v1 OOM-invocation counts are unavailable.

Memory/PID readings are point observations, not peaks, a leak test or production
sizing guidance. The shared host, synthetic metadata and disabled external/AI
providers limit generalization. This new 600-item case was not dispatched on
hosted CI during this task; earlier hosted results do not establish its hosted
behavior. No live limits were changed.

### Automated checks

- Backend coverage unit suite: **1,525 suites / 46,079 tests passed**.
- Frontend CI suite: **403 suites / 5,668 tests passed**.
- Focused backlog/installation contract tests: **8 suites / 233 tests passed**.
- Server/client lint and typecheck, ESM static-import and strict mock-shape
  checks, migration/schema integrity, repository preflight and coverage ratchets
  passed. Backend statement/branch coverage: 90.21% / 84.85%; frontend:
  85.96% / 78.47%.
- Markdown lint and whitespace validation passed.

## Findings corrected during implementation

Focused contract/fixture/runner tests pass. The first disposable run correctly
rejected duplicate synthetic library names before the new crash boundary. The
backlog fixture now has distinct names; a regression test covers both fixture
profiles. The database uniqueness rule was not changed.

The next run recovered all 600 tasks (605 claims, 600 completions) but exposed an
incorrect test assumption: the normal two-minute startup scan advances the
latest ingestion attempt even when its source is offline. The observer now
checks the original completed sync/capture receipts and backfill generation,
not that mutable attempt pointer. Unit tests reject substituted committed
generations and receipts. No scheduler, retry deadline or ownership rule was
changed to accommodate the test.

Both exploratory runs were rejected rather than represented as passes. The final
clean-source acceptance above includes the corrections and their regression tests.

## PR availability

GitHub MCP returned no open pull requests in `cloudbyday90/Classifarr` at the start
and during final validation. No PR was available to select randomly or implement
locally. No closed PR was substituted and none was merged.

## Operational boundaries

The launcher removed its owned containers, volume, network and candidate image;
cleanup passed and no project-labeled container, volume or network remained.
The live Classifarr container retained its original ID/image and remained healthy.
No release, version bump, live deployment or legacy-owner reconciliation occurred.
This regression proof does not resolve the separately reviewed library 5 legacy
ownership warning or establish that an unknown external writer has stopped.

## Recommendation and next component

Keep the existing scheduler and durable PostgreSQL queue. The new opt-in drill
provides missing crash-boundary evidence without introducing another orchestrator.
Its cost is approximately ten minutes of natural lease waiting per scenario.

Next, evaluate **late-worker acknowledgement fencing**: keep an original worker
alive beyond its lease while another worker reclaims that task. Establish whether
the old worker can overwrite the new owner's completion or failure. Use that
evidence to design per-claim tokens and conditional acknowledgements if needed.
Do not treat a dead-container restart test as proof of that concurrent boundary.

The concrete review target is `server/src/services/queueService.mjs`:
`completeTask` and `failTask` currently update by task ID without a per-claim
ownership predicate. That is a reason to test the overlap, not a claim that this
run reproduced a stale-worker overwrite. Keep this follow-up separate from
another dashboard or an identical crash benchmark.

This follow-up was subsequently implemented and reproduced against real
PostgreSQL; see [queue claim fencing validation](queue-claim-fencing-validation.md)
for the results, deployment record and next component.
