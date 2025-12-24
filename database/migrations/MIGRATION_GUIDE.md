# Database Migration Guide

This guide outlines best practices and requirements for creating database migrations in Classifarr.

## Overview

Migrations are automatically run on application startup by the `MigrationRunner` in `server/src/config/migrations.js`. All migration files are tracked in the `schema_migrations` table to prevent re-execution.

## Naming Convention

**Format:** `XXX_descriptive_name.sql`

- `XXX`: Three-digit sequential number (e.g., 001, 002, 019)
- `descriptive_name`: Lowercase with underscores, describes the change
- **Examples:**
  - `001_initial_schema.sql`
  - `019_cleanup_omdb_config.sql`
  - `020_add_user_preferences.sql`

## Critical Requirements

### 1. **Idempotency (MANDATORY)**

All migrations MUST be idempotent - safe to run multiple times without errors or duplicate data.

**Why:** Migrations may be interrupted and re-run during deployment failures, container restarts, or manual intervention.

### 2. **Preserve Existing Data**

When modifying tables with existing data:
- ✅ Preserve user configurations, API keys, usage stats
- ✅ Use `COALESCE()` for defaults when copying data
- ✅ Test on databases with existing data, not just fresh installs
- ❌ Never use `DROP TABLE` or `DELETE` without safeguards

### 3. **Test Both Scenarios**

Every migration MUST be tested in:
1. **Fresh database** (new installation)
2. **Existing database** (upgrade scenario with real data)

## Common Patterns

### Creating Tables

```sql
CREATE TABLE IF NOT EXISTS table_name (
    id SERIAL PRIMARY KEY,
    column1 VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Adding Columns

```sql
-- Safe: Won't error if column exists
ALTER TABLE table_name 
ADD COLUMN IF NOT EXISTS new_column VARCHAR(255);
```

### Creating Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_table_column 
ON table_name(column_name);
```

### Adding Constraints

```sql
-- Wrap in DO block to check existence
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'constraint_name'
    ) THEN
        ALTER TABLE table_name 
        ADD CONSTRAINT constraint_name UNIQUE (column);
    END IF;
END $$;
```

### Seeding Default Data

```sql
-- Use WHERE NOT EXISTS to prevent duplicates
INSERT INTO config_table (id, setting_name, value)
SELECT 1, 'default_setting', 'value'
WHERE NOT EXISTS (
    SELECT 1 FROM config_table WHERE id = 1
);
```

### Data Migration with Preservation

```sql
DO $$
DECLARE
    existing_record RECORD;
BEGIN
    -- Get existing data
    SELECT * INTO existing_record FROM old_table LIMIT 1;
    
    IF FOUND THEN
        -- Preserve existing data when migrating
        INSERT INTO new_table (id, preserved_field, new_field)
        VALUES (
            1,
            existing_record.preserved_field,
            COALESCE(existing_record.new_field, 'default_value')
        );
        
        -- Clean up old structure
        DELETE FROM old_table WHERE id != 1;
    ELSE
        -- No existing data, create defaults
        INSERT INTO new_table (id, preserved_field, new_field)
        VALUES (1, 'default', 'default_value');
    END IF;
END $$;
```

## Anti-Patterns (Avoid)

### ❌ Non-Idempotent Operations

```sql
-- BAD: Fails on second run
CREATE TABLE my_table (...);
CREATE INDEX idx_name ON my_table(col);
ALTER TABLE my_table ADD CONSTRAINT ...;
```

### ❌ Data Loss

```sql
-- BAD: Destroys user data
DELETE FROM config_table;
INSERT INTO config_table VALUES (1, 'default');
```

### ❌ Hardcoded IDs Without Preservation

```sql
-- BAD: Ignores existing config
UPDATE config SET value = 'new' WHERE id = 1;
```

## Testing Checklist

Before committing a migration:

- [ ] Run on fresh database (test initial setup)
- [ ] Run on database with existing data (test upgrade path)
- [ ] Verify no errors in migration logs
- [ ] Verify data preserved (API keys, settings, usage stats)
- [ ] Run migration twice (test idempotency)
- [ ] Check `schema_migrations` table contains new entry

## Migration 019 Example

See `019_cleanup_omdb_config.sql` for a reference implementation:
- ✅ Preserves existing API key and usage stats
- ✅ Handles both fresh and existing databases
- ✅ Idempotent (safe to run multiple times)
- ✅ Uses `DO` block for complex logic
- ✅ Uses `COALESCE` for safe defaults

## Troubleshooting

### Migration Failed Mid-Way

1. Check logs: `docker logs classifarr | grep Migration`
2. Inspect `schema_migrations` table to see what ran
3. If migration is idempotent, fix issue and restart container
4. If not idempotent, may need to manually rollback and fix

### Duplicate Data After Migration

- Cause: Missing `WHERE NOT EXISTS` or `IF NOT EXISTS`
- Fix: Update migration to be idempotent, increment version number

### Lost Configuration Data

- Cause: Migration didn't preserve existing data
- Prevention: Always test on database with real data before merging
