# Restart-safe selection of a migrated legacy database

Date: 2026-10-04. Continues the [copy-first migration](legacy-database-identity-migration-design.md).

## Scope and decision

Existing installations are the upgrade case. Preserve their source database,
inventory, settings and host paths. Do not invent owners for historical imports.
The current migration can verify a converted copy, but has no durable decision
that tells the next process which database to use. Falling back to the old copy
after new writes would lose those writes and restore old authentication.

Implement a small ESM selection contract and exercise it against the real copied
PostgreSQL cluster. This is a prerequisite, **not production activation**: ordinary
entrypoint, saved non-root templates, privileges and ingestion recovery remain
unchanged. No new startup copy, background service, API or deployment field is
introduced. Complete protected startup composition and ingestion-writer coverage
before enabling unattended recovery for deployed installations.

## Contract

- Reuse the exclusive, root-owned migration journal lease. Store a separate
  versioned `selection.json` beside `migration.json`, under the same lock.
- Bind selection to the exact migration binding (source digest, cluster identity,
  target identity and fixed layout), not a caller-provided path.
- Require all five migration phases to be durably complete before selection.
  Write `verifying` intent, recheck the actual converted boundary, then atomically
  replace that intent with `selected`. File sync precedes rename; directory sync
  follows. A failed write never permits application startup in that invocation.
- The selection API never returns a legacy fallback. Absent, incomplete,
  malformed, mismatched or unknown receipts stop selection. Even absent receipts
  could mean lost metadata around a candidate containing new writes. Ordinary
  legacy startup remains separate and unchanged, not a selection-error fallback.
- Every selected restart revalidates the boundary. A verification failure leaves
  the selection intact and stops; it never rolls back to the source.
  Re-sync the selected receipt after verification, including a retry after an
  earlier rename succeeded but directory sync failed.
- Once selection intent exists, the copy-phase runner refuses to run. This also
  prevents a missing/reset migration receipt from authorizing a destructive
  recopy of a candidate that may already contain new data.
- The trusted startup caller must own offline isolation and map the fixed
  `candidate` result to its packaged configuration. A journal lease alone does
  not stop an old PostgreSQL server or an arbitrary external writer.
- Fresh ordinary installations do no migration work. Disabled libraries stay
  disabled. Selection does not declare imports or metadata backfill complete;
  optional AI work is unrelated to this database transition.

One caller holds one existing kernel lock. Both receipts are capped at 8 KiB.
There is no retry daemon or timer. The disposable process budget remains 120
seconds per worker; PostgreSQL commands retain their existing timeouts. Restart
resumes verification after process death. Storage errors, unknown state and
changed authority stop safely; no raw credentials or provider data enter logs.

## Legacy compatibility

The public CA XML starts the image normally (root provisioning, then configured
PUID/PGID); the repository's Compose profiles explicitly force non-root startup.
Those are different deployment contracts. Keep both functioning while building
the protected path. Do not change saved appdata directories, request privileged
mode, mount Docker's socket or silently add capabilities. Image-only activation
for ordinary CA installs remains a target, not a claim proved by this increment.

## Alternatives and recommendation stack

| Option | Benefit | Cost or risk |
| --- | --- | --- |
| Choose whichever directory exists | Simple | Cannot distinguish partial conversion or post-upgrade writes |
| Rename/overwrite the legacy cluster | Fewer paths | Complicates recovery and removes the intact source |
| Protected, monotonic selection — chosen | Restart-safe decision; original retained; no implicit rollback | Additional small receipt; trusted startup integration still required |

Recommended order: verified cold copy → durable selection → protected startup and
maintenance composition → storage-enforced writer admission → automatic legacy
import and metadata backfill. Preserve backward-compatible startup until each
required boundary is tested; do not turn a partial implementation into a new
failure requirement for existing users.

## Research and acceptance

Official sources discovered through web search and opened on 2026-10-04:

- [PostgreSQL filesystem backup](https://www.postgresql.org/docs/18/backup-file.html):
  a physical copy requires a stopped cluster or a consistent snapshot. A receipt
  cannot replace that prerequisite.
- [Linux rename](https://www.man7.org/linux/man-pages/man2/rename.2.html): replacement
  is atomic, which avoids exposing a partially serialized selection document.
- [Linux fsync](https://www.man7.org/linux/man-pages/man2/fsync.2.html?from=20423&from_column=20423):
  syncing the file alone does not persist its directory entry; sync both.

Unit tests cover ordering, malformed/missing receipts, changed bindings, failed
sync, replay, refusal to recopy after selection intent and no implicit rollback.
The existing network-isolated Linux drill kills actual worker processes before
verification, after verification, after selection and after a committed candidate
write. Independent processes resume, read that write, reject the old login, and
verify the source digest is unchanged. This proves process-crash handling on the
test filesystem, not power-loss durability on every NAS filesystem, a published
image upgrade, or completed media recovery. Record results separately.
