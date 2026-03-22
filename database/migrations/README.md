# Database Migrations

This directory contains SQL migration files for Classifarr database schema updates.

Migrations are automatically run on application startup by `server/src/config/migrations.js`.

## Quick Reference

**Naming:**
- Legacy files: `XXX_descriptive_name.sql`
- New files: `YYYYMMDD_HHMMSS_descriptive_name.sql` (required for all new migrations)

**Key Requirements:**
1. ✅ **Idempotent** - Safe to run multiple times
2. ✅ **Preserve data** - Never lose user config/settings
3. ✅ **Test both scenarios** - Fresh install AND existing data

## Migration Runbook

See `MIGRATION_GUIDE.md` for comprehensive guidelines including:
- Idempotency patterns
- Data preservation techniques
- Common patterns (tables, indexes, constraints, data migration)
- Anti-patterns to avoid
- Testing checklist
- Troubleshooting

Related files:
- `LEGACY_MIGRATIONS.md` - allowlisted legacy numeric filenames
- `../../scripts/create-migration.js` - timestamp-based migration generator
- `../../scripts/check-migrations.js` - filename validation used in CI

## Automatic Migration System

The migration runner (`server/src/config/migrations.js`) automatically:
- Tracks applied migrations in `schema_migrations` table
- Uses `database/schema/current.sql` for fresh-install bootstrap when available
- Runs pending migrations in deterministic order on startup
- Logs all migration activity
- Stops on first error to prevent partial migrations

Execution order:
1. Legacy numeric migrations run first in numeric order
2. Timestamp migrations run next in chronological order

This lets the repo keep historical numeric migrations while requiring timestamp-based names for all new work.

## Running Migrations

### Development (Local)
Migrations run automatically when you start the application:
```bash
npm --prefix server run dev
# or
npm --prefix server start
```

### Production
Migrations run on container startup. Check logs:
```bash
docker logs classifarr | grep Migration
```

### Manual Execution (Emergency Recovery)
```bash
# Connect to database
docker exec -it classifarr psql -U classifarr_user -d classifarr_db

# Run specific migration
\i /app/database/migrations/20260314_213000_add_task_queue_task_type_status_index.sql
```

## Migration Order

Do not create new numeric migrations.

Use:
```bash
npm run migration:create "describe the schema change"
```

Validate naming with:
```bash
npm run migration:check
```

The repo currently contains a mix of legacy numeric migrations and newer timestamp-based migrations. The runner and CI tooling enforce the supported filename patterns automatically.

## Idempotency Examples

**Tables:**
```sql
CREATE TABLE IF NOT EXISTS my_table (...);
```

**Indexes:**
```sql
CREATE INDEX IF NOT EXISTS idx_name ON table(col);
```

**Data Seeding:**
```sql
INSERT INTO config (id, value)
SELECT 1, 'default'
WHERE NOT EXISTS (SELECT 1 FROM config WHERE id = 1);
```

See `MIGRATION_GUIDE.md` and recent timestamped migrations in this directory for complete examples of idempotent, data-preserving patterns.
