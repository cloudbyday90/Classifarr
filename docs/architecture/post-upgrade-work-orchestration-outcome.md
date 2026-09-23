# Post-upgrade work orchestration: implementation outcome

Date: 2026-09-23. The design and alternatives are in
[post-upgrade work orchestration: design](post-upgrade-work-orchestration-design.md).

## Delivered

The post-upgrade runner now takes a cross-process session lock, refuses to
interpret a missing migrated ledger as no prior work, skips historical automatic
log clearing, stops dependent tasks on failure, and treats an incomplete profile
rebuild as retryable. It avoids the duplicate full profile rebuild when the
upgrade pass already attempted one. A read-only manifest shows registered
tasks as `recorded`, `pending`, or `skip_legacy_auto_clear`:

```sh
cd server
node src/scripts/runPostUpgradeTaskPlan.mjs
```

The command needs the usual database connection environment, performs a
read-only transaction with short timeouts, prints fixed task metadata only,
and exits nonzero if the migrated ledger cannot be read. Existing scheduled
retention and manual Logs cleanup are unchanged. It does not start
workers, mutate data, create a release, or update the local container.
The existing scheduler deletes errors after configured retention even if they
were never marked resolved. Resolved errors currently use the same age rule;
changing that to an earlier cleanup requires a separate retention contract and
tests, not a post-upgrade clear.

## Verification and limits

Focused unit tests cover skipped legacy automatic clear, lock contention, missing ledger,
failure ordering, profile de-duplication, and read-only plan behavior. The full
backend unit run passed 1,388 suites and 40,737 tests; the PostgreSQL
integration run passed 148 suites and 1,709 tests (one existing skip).
Server lint/typecheck and Markdown lint also passed. This is
not yet a global orchestrator: embedding, graph, rating, inventory, profile
refresh, and other scheduled services retain their existing independent
admission and retry mechanisms. The task ledger is coarse and cannot prove
per-library completeness. No live upgrade from `v0.48.4-beta` or automatic
route promotion is claimed by these tests. A release readiness exercise must
use a disposable copy of installation data, not the operator's live database.

## Next item

Build a durable per-library upgrade coordinator that plans only missing work
from a disposable old-version snapshot, records bounded cursors and source
revisions, and publishes verified profile evidence only after each dependent
stage succeeds. Exercise restart, offline provider, contention, and rollback
before wiring additional background workers into it.
