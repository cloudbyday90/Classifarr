# Incremental gateway archive evidence validation

Approved scope, 2026-10-18: remove the aggregate full-evidence allocation from
optional archive, cleanup and catalog scheduling. No production activation,
provider requests, new administration controls, schema changes or release.

## Contract

Keep a complete metadata-only history ordered by `created_at,id`, including all
attempts, revisions, identities, statuses, timestamps and protection membership.
Retain the 10,000-row / 8 MiB metadata ceiling. Fetch full evidence by exact ID,
one record at a time, rejecting a projected record above 128 KiB in PostgreSQL
before transmission. This allows JSONB serialization overhead above the existing
64 KiB file manifest / 4 KiB receipt limits; it does not raise file limits.

Each detail read must match its captured metadata, including a digest of the
manifest and receipt. Missing, oversized, changed or malformed evidence refuses
maintenance. Do not concatenate pages, cache hydrated records, trust SQL summaries
as proof of files, or carry partial verification credit across assessments.

Use the existing maintenance session lock and exact-record fences. Keep file
hashing outside write transactions; reload metadata after acknowledged local
transitions. Bare archive installations still rely on cooperating coordinators;
cleanup/catalog SQL guards independently enforce maintenance exclusion. Catalog
capture retains its separate repeatable-read snapshot and existing bounded cursor.
An advisory lock does not prevent a privileged host/owner from changing files.

Protection reconciliation retains compact group membership, not full job arrays.
It must check both members before readiness. Protection selection retains at most
the newest matching pair. Cleanup must validate every retained verified archive,
receipt and existing marker before admission. Retirement retains all current
preservation, protection and catalog-pin checks. Fresh/empty setups do no work.

Preserve the 256 MiB worker, 120-second assessment deadline, one maintenance
coordinator, shared three attempts, persisted cooldowns and 1 GiB storage budget.
Cancellation before admission consumes no attempt; admitted work keeps its
attempt. Unknown publication remains interrupted, never automatically replayed.
Restart repeats evidence checks. Timeouts and permanent evidence refusals keep
records/files intact; they do not authorize cleanup or protection expiry.

## Research and alternatives

Official sources discovered and opened through MCP on 2026-10-17 during planning:
Locking and cursor guidance were rechecked through MCP on 2026-10-18.

- [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html):
  advisory locks require application cooperation. Preserve SQL guards and the
  existing lock-owning session rather than treating read pagination as exclusion.
- [PostgreSQL transaction snapshots](https://www.postgresql.org/docs/18/sql-set-transaction.html):
  repeatable-read statements share a snapshot. Keep capture consistency, but do
  not retain an obsolete snapshot across the coordinator's own state changes.
- [PostgreSQL cursors](https://www.postgresql.org/docs/18/sql-declare.html):
  non-held cursors belong to their transaction; held cursors may materialize
  results. A long-lived cursor is not a free replacement for this writer's list.
- [node-postgres cursors](https://node-postgres.com/apis/cursor): bounded reads
  avoid loading a whole result, but returned rows are still parsed in memory.
  Bound bytes before transfer, not merely the number of rows.
- [PostgreSQL ordering](https://www.postgresql.org/docs/18/queries-limit.html):
  limited results need a unique order. Preserve the existing timestamp/ID order;
  selected exact-ID reads must not redefine which copies are newest.

| Option | Benefit | Cost / weakness | Decision |
| --- | --- | --- | --- |
| Compact history and fenced individual reads | Bounded working set; complete existing checks; no new dependency | Extra SQL round trips and unchanged file hashing cost | Implement |
| One long cursor transaction across all maintenance | Stable database view | Stale view across writes; extended transaction lifetime | Keep only in existing read-only capture |
| Persist cross-run verification checkpoints | Could reduce repeated I/O | Stale files, invalidation and crash semantics need a new contract | Defer |
| Raise memory/time limits | Simple | Leaves unbounded accumulation and changes deployed safeguards | Reject |

Recommended stack: modular ESM, existing PostgreSQL roles/session locking,
SQL-side byte guards, bounded sequential reducers and isolated exact-image tests.
This is an engineering application of the sources, not an upstream endorsement.

## Verification and completion

Prove a legitimate protected evidence set above 8 MiB can be validated without
retaining all bodies. Previous wide failed-history tests are not that proof.
Use valid bounded manifests, matching files/receipts/markers, real PostgreSQL and
isolated restore/dependency verification. Also test a single oversized record,
late corrupt evidence, changed/deleted identity, cross-record protection groups,
same-timestamp ordering, cancellation, restart, competing maintenance and inference.
No cleanup admission or retirement may follow incomplete prerequisite checks.

Run focused unit/SQL checks and quality gates, no-cache local Compose build,
immutable-image rehearsals, then replace only local Classifarr after a backup.
Document actual measurements and limitations separately. Keep every threshold
unchanged if a larger valid fixture reaches the deadline; report that limit.

Next boundary: measure repeated file-verification I/O. Durable validation caches,
checkpointed assessments and protection expiry remain separate design decisions.
