# Schema maintenance and runtime startup boundary

Date: 2026-09-30. Base: `428d23d262ae5f9fcd87f08b03d9b975319b0fd8`.

## Decision and scope

Implement the first shared component of the production credential split proposed
by the [writer-fence outcome](ingestion-writer-fence-outcome.md): one-shot schema
maintenance, then read-only runtime admission. Do not activate database-enforced
ingestion recovery, assign historical owners or change live credentials.

This is a staged boundary, **not a supported restricted-role deployment yet**.
Keep `CLASSIFARR_SCHEMA_MAINTENANCE=startup` for existing installations. The embedded
entrypoint rejects `external` before changing users, files or starting PostgreSQL.
It currently shares the database OS identity with Node, uses trust authentication
and overwrites the PostgreSQL connection environment. A different SQL username
alone would not remove that authority.

## Contract

| Component | Behavior | Failure behavior |
| --- | --- | --- |
| Schema command | Explicit `--apply`, one process credential, one pinned connection | No worker imports; exits after completion |
| Maintenance admission | Exclusive session lock 2024, also used by runtime/restore | Busy returns `deferred`, CLI exit 75; no migrations |
| Schema runner | Existing snapshot/migrations and ledger, per-migration transactions | Failed transaction rolls back; earlier migrations remain recorded |
| Restore quarantine | Refuse non-ready gate, preserve existing legacy seed migration | Never clear quarantine to make an upgrade pass |
| External startup | Hold shared runtime admission, inspect role and schema before importing normal services | Missing/pending/future schema or elevated identity blocks startup |
| Default startup | Existing migrations, extension initialization and services | No deployment behavior change |

Maintenance checks the packaged migration directory before writes and refuses a
ledger containing filenames absent from that package. A modern missing restore
gate row is blocked; a genuinely pending legacy seed migration may still run its
existing evidence-aware initialization. Completion rechecks the ledger and gate.
An interrupted fresh snapshot uses the existing runner's transactional rollback
and legacy-migration fallback. This command does not invent a second ledger.

The maintenance session has a 10-minute statement timeout, 5-second lock timeout
and 30-second idle-in-transaction timeout. Each migration commits independently;
this is not a whole-upgrade time limit or all-upgrade rollback. The pinned session
is discarded on every exit, releasing its lock and any unfinished transaction.
There are no automatic retries, recurring timers or additional runtime admin pool.
The lock coordinates participating Classifarr processes, not arbitrary SQL clients;
operators must stop older instances and external scripts before maintenance.

The read-only check rejects elevated role attributes, a changed effective role,
any direct/indirect membership, database/schema CREATE privileges and ownership
of database or shared objects. Conservative membership rejection avoids accepting
a `NOINHERIT` role that can later `SET ROLE`. Ordinary application DML is not
revoked or audited by this check. Callable functions, default privileges, HBA,
filesystem authority and future grants remain separate cutover requirements.
Filename equality is a compatibility check, not a cryptographic schema attestation.

In `external` mode, normal startup never seeds the restore gate or runs migrations
or extension installation. Restore requires its own maintenance process; combining
`external` with restore mode is rejected. Administrative index rebuilding and the
remaining privileged service paths must be moved before this mode is deployed.

## Operator use and recovery

Do not use this as an instruction to change the live installation's credentials.
In an isolated or separately managed database, with all writers stopped and a
verified backup, give **only the one-shot process** its maintenance `POSTGRES_*`
environment, then run from `server/`:

```powershell
node src/scripts/runDatabaseSchemaMaintenance.mjs --apply
```

No arguments or `--help` prints usage without loading a database. Exit 0 means
complete, 75 means another participating runtime/restore owner is active, 1 means
failure, and 2 means invalid arguments. Logs from the existing migration runner
are administrator diagnostics and must not be exposed through an unauthenticated
endpoint. Do not give maintenance credentials to the normal app or store them in
runtime settings. No API endpoint or UI mutation is added.

For busy admission, stop the intended writer and rerun; never delete its lock or
kill unrelated sessions. For failure, inspect the recorded migration and gate,
fix the cause and rerun. Do not remove ledger rows or mark unverified restoration
ready. An old binary against a newer ledger must not start in external mode;
rollback requires a compatible binary or verified backup restoration.

## Research and tradeoffs

Official sources were discovered with online search and opened on September 30,
2026. PostgreSQL 18 matches the current embedded database major version.

- PostgreSQL's bootstrap superuser cannot be demoted; retire access through a
  reviewed authentication/OS cutover, not an assumed ALTER ROLE operation.
  [ALTER ROLE](https://www.postgresql.org/docs/18/sql-alterrole.html).
- Trust authentication accepts the requested role without password proof. It
  cannot serve as the restricted runtime boundary.
  [Client authentication](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html).
- Role attributes, membership and object ownership are separate authority paths.
  [Role attributes](https://www.postgresql.org/docs/18/role-attributes.html),
  [role membership](https://www.postgresql.org/docs/18/role-membership.html),
  [privilege inspection](https://www.postgresql.org/docs/18/functions-info.html).
- Session advisory locks are connection-scoped; the same pinned session must own
  maintenance until completion.
  [Administration functions](https://www.postgresql.org/docs/18/functions-admin.html).
- Future UI status must include concise text and programmatic status semantics,
  not color alone. No UI changes or WCAG-conformance claim are made here.
  [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

| Option | Advantages | Costs / limits |
| --- | --- | --- |
| Keep privileged startup | Lowest immediate compatibility risk | App retains schema authority; cannot prove writer isolation |
| Add admin pool inside app | Convenient online upgrades | Admin secret remains in the attack surface; rejected |
| Separate maintenance process (selected) | Clear privilege lifetime, exclusive upgrade window, testable idle startup | Planned downtime, role/HBA and privileged-task migration still needed |
| Separate PostgreSQL container | Stronger process/filesystem separation | Deployment/backup migration and an extra service to operate |
| Isolated identities in embedded container | Preserves current installation model | Requires careful file ownership, socket/HBA and bootstrap-login retirement |

## Final recommendation stack

1. Keep reviewed legacy recovery and current embedded defaults while landing this
   maintenance/startup component. Do not weaken unknown-owner safeguards.
2. Implement and rehearse OS/authentication/bootstrap isolation and privileged-task
   handoff, including fresh install, upgrade, backup, restore and image indexing.
3. Migrate every inventory writer to the enforced capability contract, then enable
   automatic legacy recovery only with negative reconnect/stale-writer tests.

The next acceptance milestone is a disposable embedded-container cutover in which
normal Node cannot connect as bootstrap, read maintenance credentials, write PG
data or alter executable code, while migrations, restore and indexing still work.
