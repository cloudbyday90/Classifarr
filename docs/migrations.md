# Database migrations

Classifarr applies pending migrations during normal startup. Separately managed
database deployments can use the explicit maintenance command below. The bundled
Docker image requires startup maintenance; unchanged valid saved Compose/Unraid
configurations use that default without adding a new environment variable.

## Implementation

| Component | Location |
| --- | --- |
| Migration runner | `server/src/config/migrations.mjs` |
| Guarded maintenance | `server/src/services/databaseSchemaMaintenance.mjs` |
| Migration files | `database/migrations/` |
| Fresh schema snapshot | `database/schema/current.sql` |
| Applied history | `schema_migrations` |

Each migration and its ledger entry commit in one transaction. Files use the
repository's numeric/timestamp ordering. Fresh databases start from the schema
snapshot, then apply pending migrations. Do not add service-level runtime DDL as
a substitute for a reviewed migration.

## Creating a migration

Use the repository generator and review its output:

```sh
npm run migration:create -- my_change
```

Keep each migration focused. Never edit an already-applied file. Explicitly define
replay safety: `IF NOT EXISTS` alone does not verify an existing object's definition,
and not every migration is safe to run twice. Test upgrades and fresh installs on
isolated databases. Update the authoritative schema snapshot using the repository
schema tools and document behavior changes under Unreleased.

## Diagnose a failed update

Startup logs name the file with `Failed to apply <filename>` and its error. A
missing ledger record alone cannot distinguish never-run from failed work.
If startup fails before HTTP is available, inspect container logs; the dashboard
cannot load. Preserve a backup and fix the reported cause before retrying.

Read-only history inspection:

```sql
SELECT filename, applied_at FROM schema_migrations ORDER BY applied_at;
```

Do not insert success records, delete migration history, or blindly rerun an
applied non-idempotent migration to clear a warning. An applied record with
missing/changed objects needs a reviewed repair, not a fabricated ledger entry.

## Separately managed migrations

Only the installation's database administrator should run this operation using
that installation's maintenance credentials, after backing up and stopping **all**
application runtimes connected to that database. From `server/` (or `/app` in the
image's maintenance environment):

```sh
node src/scripts/runDatabaseSchemaMaintenance.mjs --apply
```

The command acquires the maintenance lock, checks restore readiness, and applies
pending files. A busy result is exit 75. A restore-verification refusal is not
permission to bypass the restore guard. Keep workers stopped on failure and
inspect maintenance logs. Do not grant the web process elevated credentials.

For the bundled database, `CLASSIFARR_SCHEMA_MAINTENANCE` must be omitted (the
default) or `startup`. The staged `external` mode is for separately maintained
non-embedded runtimes, not a general workaround for Docker startup failures.

## Library import diagnostics

Command Center identifies the exact compatibility migration, its recorded state,
the connection protocol and named missing/changed/disabled import triggers. It
does not run repairs. Disabled but otherwise matching triggers require the database
administrator to restore `ENABLE ALWAYS` while writers are stopped. Missing or
changed definitions require a reviewed repair.

These checks do not reconstruct a historical migration failure or diagnose
arbitrary host mounts. See the
[guidance design](architecture/command-center-recovery-guidance-design.md).
