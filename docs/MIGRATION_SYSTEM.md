# Classifarr Migration System Documentation

> **Version:** 0.42+  
> **Last Updated:** 2026-02-01

## Table of Contents

1. [Overview](#overview)
2. [Migration Formats](#migration-formats)
3. [Quick Start Guide](#quick-start-guide)
4. [How It Works](#how-it-works)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)
7. [Maintenance Tasks](#maintenance-tasks)

---

## Overview

Classifarr uses an advanced database migration system that supports:

- ⚡ **Fast fresh installs** via schema snapshots (13x faster than legacy)
- 🔢 **Dual migration formats** (numeric legacy + timestamp modern)
- 🚫 **Conflict-free development** (no more merge conflicts on migration files)
- ♾️ **Infinite scalability** (no 999 migration limit)
- 🔄 **Full backward compatibility** (all legacy migrations still work)

### Performance Comparison

| Method | Time | Use Case |
|--------|------|----------|
| **Legacy (76 migrations)** | ~7.6s | Existing installations |
| **Schema Snapshot** | ~0.6s | Fresh installations |
| **Speedup** | **13x faster** | New users benefit immediately |

---

## Migration Formats

### Legacy Numeric Format (v0.1 - v0.41)

**Pattern:** `XXX_descriptive_name.sql`

```
001_initial_schema.sql
076_remove_duplicate_discord_thresholds.sql
```

**Characteristics:**
- ✅ Still fully supported for backward compatibility
- ❌ Limited to 999 migrations
- ❌ Causes merge conflicts in parallel development
- ❌ **DO NOT create new numeric migrations**

### Timestamp Format (v0.42+)

**Pattern:** `YYYYMMDD_HHMMSS_descriptive_name.sql`

```
20260201_140000_add_user_preferences.sql
20260201_150000_add_discord_options.sql
```

**Characteristics:**
- ✅ Auto-generated timestamps prevent conflicts
- ✅ Infinitely scalable
- ✅ Self-documenting (creation date embedded)
- ✅ **REQUIRED for all new migrations**

---

## Quick Start Guide

### Creating a New Migration

```bash
# 1. Generate migration file with timestamp
npm run migration:create "add user preferences table"

# Output:
# ✅ Migration created: 20260201_150322_add_user_preferences_table.sql
# 📝 Edit: database/migrations/20260201_150322_add_user_preferences_table.sql

# 2. Edit the migration file (add your SQL)
vim database/migrations/20260201_150322_add_user_preferences_table.sql

# 3. Test the migration
npm --prefix server run dev  # Migrations auto-run on startup

# 4. Verify it worked
docker exec -it classifarr psql -U classifarr_user -d classifarr_db \
  -c "SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 5;"

# 5. Test idempotency (restart server - should not error)
npm --prefix server run dev

# 6. Update schema snapshot for fresh installs
npm run db:dump-schema

# 7. Commit everything
git add database/migrations/20260201_150322_*.sql
git add database/schema/current.sql
git commit -m "feat(db): add user preferences table"
```

### Migration Template

Every generated migration includes helpful examples:

```sql
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- Migration: add user preferences table
-- Created: 2026-02-01T15:03:22.000Z
-- ═══════════════════════════════════════════════════════════════════════════

-- Example: Create table
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  preference_key VARCHAR(100) NOT NULL,
  preference_value TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Example: Create index
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id 
ON user_preferences(user_id);
```

---

## How It Works

### Migration Execution Order

```
┌─────────────────────────────────────────────────────────┐
│ Startup: Check for pending migrations                   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │ schema_migrations   │
              │ table exists?       │
              └─────────────────────┘
                     │         │
              NO     │         │  YES
              ┌──────┘         └──────┐
              ▼                       ▼
    ┌─────────────────────┐   ┌─────────────────────┐
    │ FRESH INSTALL       │   │ EXISTING INSTALL    │
    │ Load schema         │   │ Run pending         │
    │ snapshot (fast!)    │   │ migrations only     │
    └─────────────────────┘   └─────────────────────┘
              │                       │
              └───────────┬───────────┘
                          ▼
              ┌─────────────────────┐
              │ Database up to date │
              └─────────────────────┘
```

### Sorting Algorithm

Migrations execute in this order:

1. **All numeric migrations** (001-999) in numerical order
2. **All timestamp migrations** (20260101_000000+) in chronological order

**Example:**
```
Execution Order:
  1. 001_initial_schema.sql
  2. 002_add_arr_settings.sql
  ...
  76. 076_remove_duplicate_discord.sql
  77. 20260201_000000_convert_to_timestamp_migrations.sql
  78. 20260201_010000_add_discord_display_options.sql
  79. 20260205_143022_add_user_notifications.sql
```

This guarantees:
- ✅ Legacy migrations always run first
- ✅ New timestamp migrations run in creation order
- ✅ No conflicts between old and new systems

### Schema Snapshot System

**When to use:**
- ✅ Fresh installations (no existing database)
- ❌ Existing installations (use migrations)

**How it works:**
1. `npm run db:dump-schema` generates `database/schema/current.sql`
2. Snapshot contains complete database structure + all seed data
3. Snapshot includes INSERT statements to mark all migrations as applied
4. Fresh installs load snapshot instead of running 76+ individual migrations

**Regeneration triggers:**
- After merging any new migration to main
- Before releasing a new version
- When onboarding new developers

---

## Best Practices

### ✅ DO

- **Use timestamp-based migrations for all new changes**
  ```bash
  npm run migration:create "your change description"
  ```

- **Make migrations idempotent** (safe to run multiple times)
  ```sql
  CREATE TABLE IF NOT EXISTS ...
  ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
  CREATE INDEX IF NOT EXISTS ...
  ```

- **Preserve existing data when modifying tables**
  ```sql
  -- Good: Preserves data
  ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}';
  
  -- Bad: Loses data
  DROP TABLE users;
  CREATE TABLE users (...);
  ```

- **Test on both fresh AND existing databases**
  ```bash
  # Test fresh install
  docker-compose down -v && docker-compose up -d
  
  # Test existing install (your dev DB)
  npm --prefix server run dev
  ```

- **Update schema snapshot after merging migrations**
  ```bash
  npm run db:dump-schema
  git add database/schema/current.sql
  git commit -m "chore(db): update schema snapshot"
  ```

### ❌ DON'T

- **Never edit already-merged migrations**
  ```bash
  # ❌ BAD - Other developers may have already applied it
  vim database/migrations/076_remove_discord.sql
  
  # ✅ GOOD - Create new migration to fix issues
  npm run migration:create "fix discord settings cleanup"
  ```

- **Never create numeric migrations** (use timestamp format)
  ```bash
  # ❌ BAD
  touch database/migrations/077_new_feature.sql
  
  # ✅ GOOD
  npm run migration:create "new feature"
  ```

- **Never use DROP or DELETE without safeguards**
  ```sql
  -- ❌ BAD
  DELETE FROM settings;
  
  -- ✅ GOOD
  DELETE FROM settings WHERE setting_key = 'deprecated_setting';
  
  -- ✅ BETTER - Preserve in case of rollback
  UPDATE settings SET is_active = false 
  WHERE setting_key = 'deprecated_setting';
  ```

### Handling Merge Conflicts

**Scenario:** Two PRs create migrations simultaneously

**Old System (Numeric):**
```
PR #1: Creates 077_feature_a.sql
PR #2: Creates 077_feature_b.sql  ← CONFLICT! 💥
```

**New System (Timestamp):**
```
PR #1: Creates 20260201_140000_feature_a.sql
PR #2: Creates 20260201_150000_feature_b.sql  ← No conflict! ✅
```

Both migrations coexist peacefully and execute in timestamp order.

---

## Troubleshooting

### Migration Failed Mid-Way

**Symptoms:** Server won't start, error in migration logs

**Solution:**
```bash
# 1. Check logs
docker logs classifarr | grep Migration

# 2. Connect to database
docker exec -it classifarr psql -U classifarr_user -d classifarr_db

# 3. Check which migrations ran
SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 10;

# 4. If migration is idempotent, fix issue and restart
# If not idempotent, may need manual rollback
```

### Duplicate Data After Migration

**Cause:** Migration not idempotent (missing `WHERE NOT EXISTS`)

**Prevention:**
```sql
-- ❌ BAD - Creates duplicates on retry
INSERT INTO settings VALUES (1, 'my_setting', 'value');

-- ✅ GOOD - Idempotent
INSERT INTO settings (id, key, value)
VALUES (1, 'my_setting', 'value')
ON CONFLICT (id) DO NOTHING;

-- ✅ ALSO GOOD
INSERT INTO settings (key, value)
SELECT 'my_setting', 'value'
WHERE NOT EXISTS (
  SELECT 1 FROM settings WHERE key = 'my_setting'
);
```

### Schema Snapshot Fails

**Symptoms:** `npm run db:dump-schema` errors

**Common Causes:**
1. Database not running
2. Wrong database name
3. Insufficient permissions

**Solution:**
```bash
# Check database is running
docker ps | grep classifarr

# Check environment variables
echo $DB_NAME  # Should be 'classifarr_db'

# Test database connection
docker exec -it classifarr psql -U classifarr_user -d classifarr_db -c "SELECT 1;"
```

### Migration Not Running

**Symptoms:** New migration file exists but doesn't execute

**Checklist:**
- [ ] Migration file ends with `.sql`
- [ ] Migration filename follows format: `YYYYMMDD_HHMMSS_description.sql`
- [ ] Migration is not already in `schema_migrations` table
- [ ] Server was restarted after adding migration
- [ ] No syntax errors in migration SQL

---

## Maintenance Tasks

### Regular Tasks

**After merging any migration:**
```bash
# Update schema snapshot for fresh installs
npm run db:dump-schema
git add database/schema/current.sql
git commit -m "chore(db): update schema snapshot"
git push
```

**Before major releases:**
```bash
# 1. Verify all migrations are idempotent
for file in database/migrations/*.sql; do
  echo "Testing: $file"
  docker exec classifarr psql -U classifarr_user -d classifarr_db -f "$file"
done

# 2. Test fresh install
docker-compose down -v
docker-compose up -d
# Should complete in <1 second

# 3. Regenerate schema snapshot
npm run db:dump-schema

# 4. Test that snapshot includes all migrations
grep "schema_migrations" database/schema/current.sql | grep INSERT
```

### Monitoring

**Check migration health:**
```sql
-- How many migrations are applied?
SELECT COUNT(*) FROM schema_migrations;

-- When was last migration applied?
SELECT filename, applied_at 
FROM schema_migrations 
ORDER BY applied_at DESC 
LIMIT 5;

-- Find unapplied migrations
-- (Compare filesystem vs database)
```

### Rollback Strategy

⚠️ **Important:** Classifarr doesn't support automatic rollback.

**Manual rollback process:**
1. Create a NEW migration that reverses the changes
2. Test thoroughly before deploying
3. Document the rollback in PR description

**Example:**
```sql
-- Original migration: 20260201_140000_add_notifications.sql
CREATE TABLE notifications (...);

-- Rollback migration: 20260201_160000_remove_notifications.sql
DROP TABLE IF EXISTS notifications;
DELETE FROM schema_migrations 
WHERE filename = '20260201_140000_add_notifications.sql';
```

---

## Advanced Topics

### Custom Migration Logic

For complex migrations requiring application code:

```javascript
// database/migrations/20260201_140000_complex_migration.js
module.exports = {
  async up(db) {
    // Your migration logic
    await db.query('...');
  },
  
  async down(db) {
    // Rollback logic
    await db.query('...');
  }
};
```

> **Note:** JavaScript migrations not yet implemented. File a feature request if needed.

### Migration Performance

**Optimization tips:**
- Use `CREATE INDEX CONCURRENTLY` for large tables (doesn't lock)
- Batch large data migrations (commit every 10,000 rows)
- Add indexes AFTER bulk inserts, not before
- Use `ANALYZE` after large data changes

**Example:**
```sql
-- Slow: Locks table
CREATE INDEX idx_users_email ON users(email);

-- Fast: Doesn't lock (Postgres 11+)
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
```

---

## Reference

### File Structure

```
Classifarr/
├── database/
│   ├── migrations/           # All migration files
│   │   ├── 001_initial.sql
│   │   ├── 076_latest_legacy.sql
│   │   ├── 20260201_000000_conversion.sql
│   │   └── 20260201_010000_discord_options.sql
│   ├── schema/
│   │   └── current.sql      # Schema snapshot for fresh installs
│   └── MIGRATION_GUIDE.md   # Developer guide (this file)
├── scripts/
│   ├── create-migration.js  # Generate new migrations
│   └── dump-schema.js       # Update schema snapshot
└── server/
    └── src/
        └── config/
            └── migrations.js # Migration runner (auto-runs on startup)
```

### npm Scripts

| Command | Description |
|---------|-------------|
| `npm run migration:create "description"` | Generate new timestamp-based migration |
| `npm run db:dump-schema` | Update schema snapshot from current DB |
| `npm --prefix server run dev` | Start server (auto-runs migrations) |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_NAME` | `classifarr_db` | Database name for migrations |
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `5432` | Database port |
| `DB_USER` | `classifarr_user` | Database user |

---

## Support

**Questions?** Check:
1. This documentation
2. `database/migrations/MIGRATION_GUIDE.md`
3. GitHub Issues with label `database`
4. Discord #development channel

**Found a bug?** Open an issue with:
- Migration filename
- Error message
- Database state (output of `SELECT * FROM schema_migrations;`)
- Steps to reproduce

---

**Last Updated:** 2026-02-01  
**Maintainer:** Classifarr Core Team  
**License:** GPL-3.0
