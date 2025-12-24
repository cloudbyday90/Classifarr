# Database Migrations

This directory contains SQL migration files for Classifarr database schema updates.

Migrations are automatically run on application startup by `server/src/config/migrations.js`.

## Quick Reference

**Naming:** `XXX_descriptive_name.sql` (e.g., `019_cleanup_omdb_config.sql`)

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

## Automatic Migration System

The migration runner (`server/src/config/migrations.js`) automatically:
- Tracks applied migrations in `schema_migrations` table
- Runs pending migrations in numerical order on startup
- Logs all migration activity
- Stops on first error to prevent partial migrations

## Running Migrations

### Development (Local)
Migrations run automatically when you start the application:
```bash
npm start
# or
docker compose up
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
\i /app/database/migrations/019_cleanup_omdb_config.sql
```

## Migration Order

Migrations MUST be run in numerical order. The system enforces this automatically.

Current migrations: `001` through `019`

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

See migration `019_cleanup_omdb_config.sql` for a complete example of data preservation.
