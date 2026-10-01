# Compatible image-index worker outcome

Date: October 1, 2026. Validation complete; no release or live deployment.

## Delivered design

The [design and official research](compatible-image-index-worker-design.md)
connects the existing claimed image-index job to a fixed on-demand child. Small
ES modules own the protocol, descriptor client, launcher, environment, boundary
checks and command. Existing SQL ownership, restore and catalog protections are
retained. The offline command and isolated-role launcher remain separate.

## Validation record

Final focused lifecycle, worker, startup, queue-adapter and ownership tests: 300
passed. Real PostgreSQL index/vacuum/handoff regression: 30 passed across three
suites. Frontend: 5,795 tests across 411 suites and production build passed.

The final-source disposable embedded-isolation drill passed all eight existing
separate-identity/schema/restore/crash checks. Its production profiles also passed
stale-claim refusal, restore quarantine, killed concurrent build, invalid-index
recovery and completion through the actual application queue and supervisor.
The existing compatible vacuum scenarios passed alongside them. All owned drill
containers, images and volumes were cleaned up; no live data was used.

| Profile | UID:GID | Worker scenarios | Clean stop including verification |
| --- | --- | --- | --- |
| Standard | 1000:1000 | Passed | 2.67 seconds |
| Custom | 2345:2345 | Passed | 2.56 seconds |
| Community Apps-style | 99:100 | Passed | 2.41 seconds |

Saved-template behavior and the ten-second host stop timeout were unchanged.
These are representative Linux profiles, not runs on an actual Unraid host.
The small synthetic workload does not establish production capacity or loaded
shutdown latency. Forced unresponsive-process termination remained nonzero and
recovered committed data; it was not reported as a clean stop.

Lint, type checks, Markdown lint, Knip, copyright, policy and ESM gates passed.
The ownership review preserves 19 owned, 199 separately coordinated and 490
unresolved paths; none of that unresolved debt was waived. Full-backend final
coverage run: 48,620 tests passed, one existing skip, across 1,591 passing suites
in 516.99 seconds. The combined frontend/backend coverage ratchet passed without
changing its baseline.

The real-container cancellation fixture was corrected to preserve its live
synthetic claims and wait for PostgreSQL cancellation before releasing a writer
blocker. Child exit is not proof of immediate SQL termination. Production SQL
timeouts and session locks were not relaxed.

An initial full backend run found one stale ownership fingerprint during the
fixture edit. The reviewed fingerprint was refreshed, its suite passed, and a
full final-source run passed. The gate itself was not bypassed.

## Recommendation stack

1. Keep the fixed index contract, restore gate, claim fencing and SQL budgets.
2. Use compatible workers for bounded execution without saved-template updates.
   Benefit: independent process cleanup. Cost: temporary process overhead and
   unchanged shared administrator authority.
3. Next, add **criteria-based index reconciliation**. Inspection found that
   `healthCheckRAG.mjs` checks name existence, not catalog validity, and no current
   production producer enqueues `rebuild_hnsw_index` automatically. Reuse the
   catalog inspector, wait for ingestion/backfill readiness, and deduplicate one
   repair job only when the enabled feature needs a missing or invalid expected
   index. Preserve unexpected definitions, bound retries, log one actionable
   outcome, and keep healthy/disabled installations idle. Measure large-fixture
   build progress before changing maintenance budgets.
4. Complete protected persistent storage before full production privilege
   separation. A child process with the same login is not that boundary.

## Delivery scope

Both GitHub MCP and the saved-login GitHub CLI returned no open PRs. No random PR
could be selected; none was invented, merged or closed. No release, version bump,
published image, live-container restart or persistent-data operation is included.
