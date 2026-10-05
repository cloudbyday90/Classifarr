# Guided ingestion safeguard repair

Date: 2026-10-05. Scope: explicitly requested repair of disabled, otherwise
unchanged import safeguards. No release or production recovery is authorized.

## Decision

Add an administrator-only preview and confirmation in the library screen. The
operation is database-wide, not a claim of human library ownership. Healthy setups
do nothing. Missing migrations, missing/changed definitions, incompatible protocol,
restore quarantine, or insufficient existing database permissions refuse repair.
Do not add credentials, grants, Docker socket access, or a privileged broker.

Use a short-lived server-side plan bound to the administrator and the exact
catalog fingerprint. Plans expire after five minutes, are single-use, and are
bounded in memory. Restart invalidates them. Recheck the plan immediately before
backup and again while holding locks. Never accept table names or SQL from HTTP.

The operation makes a bounded custom-format database backup in a private directory
on existing app-data storage, verifies that the archive can be fully read, then
locks the six fixed import tables in SHARE ROW EXCLUSIVE mode. This drains writes
and excludes trigger DDL without asking the operator to identify or kill processes.
Reads may continue. Backup occurs before those write-blocking locks; it is a
consistent earlier snapshot, not a promise that other application activity stops.
No library inventory is changed by repair. All trigger changes and the success
audit record commit together. Normal import/backfill admission continues afterward.

One repair runs per process and per database (session advisory lock). A shared
runtime-maintenance lock excludes restore/schema maintenance without disrupting a
normal runtime's shared admission. Use fixed SQL identifiers, a pinned client,
5-second lock/statement bounds for DDL, a 15-second transaction timeout, and no SQL
retry. A lost commit is unknown: refresh diagnosis; never automatically resend.
Preserve completed backups after success, failure or ambiguous commit.

Backup subprocesses use argument arrays, no shell, minimal database environment,
closed stdin, bounded output, a 60-second deadline per child, and joined termination.
Allow at most three retained repair directories, at most 256 MiB per archive.
Full archive reading is not an isolated restore rehearsal. Backups contain secrets:
directories are private and files owner-only, with no new HTTP download route.
Existing deployments lacking utilities/storage/DDL authority get explicit refusal,
not an elevated web credential. A CLI uses the same preview/apply contract for a
separately managed installation's authorized maintenance environment.

## User experience and completion

Show affected safeguards, database-wide impact, bounded pause, backup location
category, and an explicit confirmation. Keep details secondary to the action.
Network uncertainty offers a fresh read, not a retry button with stale consent.
Use semantic controls, persistent polite status and fixed sanitized errors. The
banner links to this existing library screen rather than prescribing raw SQL.
Repair completes only when every safeguard passes and the audit commits. This is
not import/backfill completion; those retain their existing tracking and gates.

## Tradeoffs and recommendation stack

1. Narrow online repair: works with existing owner-capable saved deployments and
   avoids container configuration edits; briefly blocks import-table writes and
   requires bounded backup capacity.
2. Refuse definition replacement: limits accidental or hostile widening; requires
   a separately reviewed patch for missing/changed objects.
3. Preserve privilege boundaries: no new grants; isolated runtime identities need
   their established maintenance environment instead of an in-app repair.
4. Next: durable sanitized startup-failure receipts, followed by stronger writer
   isolation and sustained resource testing. No arbitrary migration replay.

## Validation

Use real isolated PostgreSQL for trigger definitions, DDL rollback, competing
writes, stale plans, restricted roles and atomic audit. Test timeout/size/output
bounds and backup refusal independently, then run the production image's actual
backup utilities on synthetic data. Browser fixtures must identify themselves as
synthetic; never break a healthy local library to show the button.

## Official sources

Discovered through web search and read October 5, 2026:

- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html):
  named trigger enablement and locking; ALWAYS also applies in replica mode.
- [PostgreSQL pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html):
  consistent database snapshots and custom archives; backup is not restore proof.
- [OWASP transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html):
  server-side scope, ordered confirmation, expiry and execution-time revalidation.
- [W3C error prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html):
  offer review and confirmation before consequential changes.
