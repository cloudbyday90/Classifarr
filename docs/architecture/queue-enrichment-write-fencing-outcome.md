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

An isolated clean-commit installation acceptance run remains to be recorded
before push. These tests use synthetic providers and disposable databases; they
do not prove the quality of live upstream metadata or all external-writer safety.

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
