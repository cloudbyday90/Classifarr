# Queue enrichment write fencing outcome

## Implemented behavior

The former completion check protected task status but allowed a replaced worker
to persist enrichment first. The new per-task write session uses short,
database-only claim-locked transactions for ratings, resolved IDs, provider
recovery leases, fallback retries and item workflow state. Final metadata,
source-library history, task completion and derived state commit together.
Source snapshots, typed movie/TV identity and provider leases remain mandatory.

An expired, replaced, cancelled or missing claim cannot publish final results.
Claim loss is a debug-level discard, not a provider error or a failure of the
replacement task. Recovery/completion messages follow successful commit.
Database errors remain failures and are not relabeled as provider outages.

The implementation adds small ESM guard/session modules and explicit transaction
collaborators. It does not add dependencies, migrations, workers, timers or UI
controls. Queue limits, provider cooldowns, retention, routing and music exclusion
are unchanged. No release or live deployment has been performed.

## Validation record

Focused PostgreSQL tests pass for source changes, stale-worker races, expiry while
waiting for a lock, expiry during writes, missing authority, final-batch rollback,
and recovery after a lost commit reply. A separate overlap test proves that a
provider lease is preserved after task replacement and that ordinary backfill
captures the observation after that lease expires, without duplicate history.

Initial validation found outdated completion mocks and a recursive test spy.
The mocks now distinguish orchestration-only unit tests from real PostgreSQL
claims; SQL fixtures use actual claims/completion and transaction savepoints.
The recursive spy was corrected and its disposable test process was stopped;
Testcontainers removed its resources. No live application process was stopped.

Final validation on the implementation:

| Gate | Result |
| --- | --- |
| Backend with coverage | 1,527 suites; 46,169 tests passed |
| PostgreSQL integration | 193 suites; 2,253 tests passed; one existing opt-in suite/test skipped |
| Frontend with coverage | 403 files; 5,674 tests passed |
| Frontend production build | Passed |
| Server/client lint and type checks | Passed |
| Copyright, dependency and ownership preflight | Passed |
| ESM static imports and mock shapes | Passed |
| Coverage ratchet | Passed; no baseline lowered |
| Policy naming, product language, delivery and maintenance gates | Passed |
| Markdown, migration naming, schema snapshot integrity and diff checks | Passed |
| Isolated installation acceptance | All 12 checks passed; cleanup passed |

These tests use synthetic providers and disposable databases; they do not prove
the quality of live upstream metadata or all external-writer safety.

## Clean-source installation acceptance

The isolated drill completed at `2026-09-29T02:52:13.807Z` against clean commit
`af93cc78ed43c405a3f9491a3935e2e9d0ddd4d4`. It verified published baseline
`v0.48.4-beta`, fresh installation, actual startup scheduler progress, backfill
crash recovery, persisted-volume migrations, interruption during restore,
rejection of unverified startup, rollback/verified retry, movie/TV recovery to
profiles and normal restart. Fresh and upgraded candidates both had 298
migrations on PostgreSQL 18.6.

The generated, Git-ignored receipt is
`.tmp/ci/runtime-installation-acceptance.json`. The candidate image was
`sha256:503295781d886ea4d69b3760e577034873de7c2bb445e9c6a5f95c37baa4a370`.
Disposable containers and data were cleaned up. This was not a published-image
release or the optional CPU/PID-budget profile.

The live Classifarr container remained `95557b17c965`, started at
`2026-09-29T01:16:51.534281224Z`, healthy with zero restarts and no OOM kill.
Its image, persistent data and routing configuration were not changed.

## Research, PR availability and recommendation

The separate [design document](queue-enrichment-write-fencing-design.md) records
official PostgreSQL, node-postgres, Microsoft and W3C sources, alternatives and
tradeoffs. Retain the current ESM/PostgreSQL stack: short transactions provide a
verifiable boundary with extra database round trips, without adding a broker.

Two GitHub MCP searches returned zero open PRs for `cloudbyday90/Classifarr`.
There was no eligible random PR to apply locally; none was substituted or merged.

## Next independently testable component

Fence **independent enrichment retry workers** using their own received claims,
then couple their metadata/result writes to terminal retry state. Acceptance:
a paused retry worker must not overwrite a successor; crash/reclaim must recover
without duplicate history; source drift, disabled providers and existing retry
budgets must retain their current behavior. This is a separate boundary, not a
claim that all platform side effects are now exactly-once or safely cancellable.
