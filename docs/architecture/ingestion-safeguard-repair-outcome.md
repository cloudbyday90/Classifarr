# Guided ingestion safeguard repair outcome

Date: 2026-10-05. Branch: main. No release, PR merge or Unraid deployment.

## Implementation

The [design](ingestion-safeguard-repair-design.md) now has a bounded implementation.
Command Center directs an affected library to **Check repair options**. The library
screen previews the database-wide changes and requires explicit confirmation before
**Back up and repair**. Healthy libraries do not start this service or create backups.

Small ESM modules separate strict catalog verification, backup subprocess/storage,
repair admission/transaction, administrator-only HTTP routes, and the maintenance
CLI. No migration, database grants, template edits or worker loop were added.
The recovery-change skill guided the refusal cases and actual PostgreSQL tests;
the dependency and release-evidence skills keep PR and image results separate.

Successful repair restores only disabled matching triggers. It does not replace
definitions, claim a library, erase inventory, alter migration history, or announce
import/backfill completion. Import-table writes are briefly blocked by database
locks, not by trusting an administrator's guess about running processes. Current
runtime admission remains active; exclusive schema/restore maintenance is excluded.
The compatibility fence still does not contain a deliberately privileged writer.

Private custom-format backups retain the pre-repair database snapshot. The archive
is fully read before DDL; this is not a live restore rehearsal or a replacement
for regular backups, external secrets, roles or app-data backups. At most three
attempt directories are retained; failed/partial attempts consume a slot too.
No automatic deletion or HTTP download of these sensitive files was added.

## How an administrator uses it

1. Open the affected library from Command Center and select **Check repair options**.
2. If repair is available, review the named safeguards and database-wide pause.
   Confirm, then select **Back up and repair** once. No Compose or Unraid template
   update is needed for an existing owner-capable image with writable app-data.
3. Wait for the result. A completed result gives a retained backup identifier and
   lets normal import recovery continue. A timeout or lost response requires a new
   status check, not resending the old confirmation.
4. If refused, follow that specific reason: missing migration, changed definitions,
   restore quarantine, permissions, tools, backup capacity or storage safety.
   Do not grant the web process additional privileges to make a repair available.

Authorized maintenance environments can use the same implementation from `/app`
in the image or `server/` in the repository. Replace `ADMIN_USER_ID` with an active
Classifarr administrator's numeric ID; existing database credentials stay in the
maintenance environment, not command arguments:

```sh
node src/scripts/runIngestionSafeguardRepair.mjs --preview --actor ADMIN_USER_ID
node src/scripts/runIngestionSafeguardRepair.mjs --apply --actor ADMIN_USER_ID
```

The second command previews again and requires an interactive `REPAIR` confirmation.
No `--force` or arbitrary SQL/target option exists. The database connection must
already have the required authority and PostgreSQL utilities; this command does
not create it. The current backup adapter deliberately refuses unsupported TLS
pool configuration rather than silently changing transport security.

Backups are under `/app/data/ingestion-repair-backups/<backup-id>/database.dump`.
Keep the directory owner-only and archive files private: they contain sensitive
database data. If three slots are occupied, securely copy and inspect the retained
attempts before explicitly removing an obsolete attempt directory. An incomplete
archive is not a backup. No cleanup of existing user backups was performed here.

## Validation

Focused PostgreSQL validation passed 109 tests across the repair, compatibility,
legacy reconciliation and ingestion suites. It includes observed table-lock
contention, late legacy-write refusal, audit rollback, a lost commit response,
stale plans, cross-actor refusal, restricted roles and concurrent repair exclusion.
The ownership inventory gained one explicitly reviewed entry for the repair's
indirect fixed SQL call; no existing unresolved writer was reclassified.

Full regression, final browser and exact-image results are pending the final
validation pass. No release-readiness claim is made by these focused results.

## Open PR trial

GitHub MCP enumerated open PRs 555 and 556; cryptographic random selection chose
[556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Applied its exact manifest/lock changes
locally, ran the reviewed install, audit, tooling guard and server typecheck.
The proposed Node 26.6.4 declarations / undici-types 8.9.0 failed the Node 24
runtime-major policy and Discord `BodyInit` type compatibility. npm audit found no
known vulnerabilities; that does not establish runtime/type compatibility.
Reverted only the trial changes, restored dependencies, and all 30 tooling checks
passed. The PR remains open and unmerged; no dependency update is retained.

## Recommendation stack

1. Keep this narrow confirmed repair for verified disabled safeguards: practical
   with current deployments; backup size/time bounds can require separate maintenance.
2. Keep missing/changed definitions blocked: safer than generic migration replay;
   requires a reviewed software repair rather than a universal "fix" button.
3. Next, add durable sanitized startup-failure receipts with the actual migration
   filename/error code. A missing history row cannot establish why startup failed.
4. Continue privilege isolation and sustained resource testing separately. Short
   local observations and catalog checks are not release-wide security guarantees.
