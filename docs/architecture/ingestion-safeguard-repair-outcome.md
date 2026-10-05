# Guided ingestion safeguard repair outcome

Date: 2026-10-05. Branch: main. No release, PR merge or Unraid deployment.

## Implementation

The [design](ingestion-safeguard-repair-design.md) now has a bounded implementation.
Command Center directs an affected library to **Check repair options**. The library
screen previews the database-wide changes and requires explicit confirmation before
**Back up and repair**. Healthy libraries do not request repairs or create backups.

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

- Frontend coverage: 439 files / 6,359 tests passed; 88.60% lines, 79.62% branches,
  86.26% functions. Two Chromium scenarios passed, including keyboard confirmation,
  prevention of duplicate submission, focus return and a 390-pixel layout.
- Focused backend guards: 32,925 tests passed; final backup/route/CLI rerun passed
  14 tests after adding sanitized storage-error guidance.
- Lint, server/client typechecks, ESM static imports, ownership/dependency
  preflight, Markdown and staged secret checks passed. Existing coverage and
  security baselines were not relaxed.
- Full backend coverage: 1,703 suites / 52,923 tests passed, with one Linux-only
  directory-fsync test skipped on Windows and exercised below in the Linux image.
  Coverage was 89.78% lines/statements, 85.62% branches and 91.17% functions.
  The combined server/client coverage ratchet passed without baseline changes.

### Exact local image

Built with `--no-cache --require-provenance` from clean commit
`ab7e87879ecc04ed8142326cf30bc4b04f73b588`, using the existing AVX2 selection.
Docker's local image identity is
`sha256:9a51b3d86af2fc8333b6f68c5e7523cc2235dfd0faff9820027e0bf4ff077093`.
This is local build evidence, not published multi-platform provenance.

A network-isolated, disposable PostgreSQL 18 fixture ran the image's production
repair service and actual `pg_dump`/`pg_restore` tools. Repair retained inventory,
produced owner-only files, and restored the pre-repair archive into a second
database with its original inventory and disabled trigger intact. Further checks
refused unsafe directory permissions, a symlinked root, unsupported TLS options,
and a fourth retained backup. A cancelled attempt retained its private partial
file rather than claiming success or deleting evidence. All fixture containers
were removed; no caller data was mounted.

After the build, `dump-schema` ran against an isolated database using this image.
Loading and redumping the snapshot produced zero drift; `current.sql` is unchanged.
The actual Linux image also passed exclusive migration-tree copy, directory fsync,
source preservation and refusal to overwrite an existing candidate. This exercises
the platform-specific behavior that Windows cannot test directly.

### Local replacement and observation

Recreated only the local Compose `classifarr` service with the tested image and
`--no-build --wait`. Health returned 200; anonymous library access remained 401.
All ten library imports remained complete, including Family and Movies; unfinished
legacy markers were zero, all 12 safeguards were enabled, and the new strict repair
check returned `not_needed`. No local safeguards were disabled for demonstration.
No repair or backup was requested against the real local database. Unraid and its
separate database were not changed.

Short post-startup observations found no ownership warnings, structured warning/error
entries, restarts or OOMs. Memory settled from approximately 723 MiB to 396 MiB;
sampled CPU fell from 35.12% to 4.72%. The saved container retains a 2 GiB memory
limit, but no CPU quota or PID cap. Observed processes were the supervisor,
application and PostgreSQL; this is not a sustained load/leak test or proof that
every deployed environment has the same behavior.

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
