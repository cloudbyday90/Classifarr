# Supervised schema maintenance

Date: 2026-10-04. Scope: embedded compatible startup, not privilege separation.

## Decision and sequence

Extend the existing optional-profiling startup worker into one fixed startup
maintenance command. It runs the existing schema-maintenance service first, then
optional profiling. The parent joins that child before launching the web process.
Restore-only startup never starts this worker. Saved Compose and Unraid templates
stay unchanged; no host option or persistent maintenance daemon is introduced.

Database ready → exclusive schema maintenance → optional profiling → child joined
→ shared runtime admission → read-only schema verification → normal services.

The parent passes an internal, versioned environment routing hint only to its
normal child. The hint is not proof of maintenance or authorization. The web
process must independently compare the actual ledger to the packaged migration
set while holding shared runtime admission. Missing, pending, future or unreadable
schema fails before normal service constructors; it never falls back to runtime
migrations. External mode still requires its existing restricted-role checks.
Direct host development without a handoff retains the existing startup behavior.

## Safety and bounds

- Reuse the pinned migration session and exclusive runtime/restore lock 2024.
  Contention defers mandatory schema work and prevents application startup.
  Existing restore verification, unknown-ledger refusal and per-migration
  transactions remain. Never clear a restore gate to make startup succeed.
- Fresh images retain their schema-snapshot fast path in the entrypoint; the
  worker normally finds no pending migrations. Already-current schemas receive
  no migration DDL. No library, provider or AI job is launched in this phase.
- One child, one attempt per startup, one database connection at a time, fixed
  executable/arguments/environment and 512 MiB V8 old-space limit. Keep SQL's
  existing 10-minute statement, 5-second lock and 30-second idle-transaction
  limits for migration work; optional profiling retains its shorter SQL limits.
  Bound the whole child to 15 minutes and the parent's join to 15 minutes plus
  20 seconds. Host cancellation still uses the existing short TERM/KILL join.
- No SQL/provider data in parent logs. Child output remains capped and discarded;
  only fixed schema/profiling statuses escape. Mandatory failure or unknown exit
  cannot be normalized to optional deferral or successful startup.
- Completed migration ledger entries survive restart. A failed/unknown attempt
  re-reads that ledger next startup; there is no in-process retry, counter reset
  or invented completion. Existing historical SQL transaction behavior is not
  rewritten or claimed globally atomic. Confirmed child exit precedes app start.
- Maintenance and runtime checks share the same fixed packaged migration paths
  in the embedded handoff. Untrusted environment overrides cannot make the web
  process verify a smaller migration set than the worker applied.
- This preserves today's shared OS/SQL authority. It neither fences all existing
  writers nor repairs legacy ownership. No Unraid or live library recovery.

## Options and recommendation stack

| Option | Benefit | Cost / limitation | Recommendation |
| --- | --- | --- | --- |
| Keep migrations in web startup | No new handoff | Administrative work remains coupled to services | Replace for packaged startup |
| Supervised compatible worker plus independent ledger check | Existing templates work; failures stop before services | Startup can wait for migrations; shared authority remains | Implement now |
| Separate OS identities, protected files/HBA and restricted runtime role | Enforced privilege boundary | Requires remaining writer adapters and deployment compatibility work | Follow next |

Do not offer a new public “skip migrations” flag. Complete the protected identity
composition and remaining operation adapters before claiming runtime privilege
isolation or enabling automatic legacy ingestion retirement.

## Research

Official pages discovered through search and opened on 2026-10-04:

- [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html):
  session advisory locks survive transaction rollback and end with their session;
  shared/exclusive locks coordinate participating processes, not arbitrary writers.
- [Read-only transactions](https://www.postgresql.org/docs/current/sql-set-transaction.html):
  use an actual read-only transaction for ledger checks, not a naming convention.
- [PostgreSQL timeouts](https://www.postgresql.org/docs/18/runtime-config-client.html):
  lock, statement and idle-transaction deadlines cover different failure modes.
- [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html):
  fixed no-shell spawning and close/exit distinction support joined maintenance.

These sources inform the design; they do not establish this application's
permissions or prove tests passed. No UI/HTTP contract changes are planned.

## Required verification

Unit tests: exact handoff parsing, unchanged external authority, failure before
service loading, no preflight fallback, fixed environment, sequential operations,
result-code handling, cancellation and confirmed joins. Real PostgreSQL: current,
pending/future/absent ledger, legacy seed, restore/runtime exclusion and rollback.
Image: fresh startup, a synthetic pending migration on an existing database,
no remaining child, clean shutdown, local no-cache rebuild and isolated schema dump.
