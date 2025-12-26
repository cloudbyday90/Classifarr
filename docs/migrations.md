# Database Migrations

## Overview

Classifarr uses a migration system to manage database schema changes. Migrations are automatically applied on server startup.

## Migration System Location

| Component | Path |
|-----------|------|
| Migration Runner | `server/src/config/migrations.js` |
| Migration Files | `server/database/migrations/` (optional) |
| Tracking Table | `schema_migrations` (auto-created) |

## How It Works

### 1. Tracking Table

The migration runner creates a `schema_migrations` table to track applied migrations:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMP DEFAULT NOW()
)
```

### 2. Migration Files

Place SQL files in `server/database/migrations/` directory:
- Files must have `.sql` extension
- Files are sorted alphabetically (use numeric prefixes)
- Each file is run in a transaction

**Naming Convention:**
```
001_initial_schema.sql
002_add_user_table.sql
003_add_indexes.sql
```

### 3. Inline Schema (Alternative)

For dynamic tables that are created on-demand, services can create tables directly:

```javascript
// Example from reclassificationBatchService.js
async ensureTables() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS my_table (...)
    `);
}
```

## Current Tables

### Core Tables (created by setup)
- `users` - User accounts
- `media_servers` - Plex/Jellyfin/Emby connections
- `libraries` - Media libraries
- `library_arr_mappings` - Library to *arr root folder mappings
- `classification_history` - Classification audit log
- `classification_corrections` - User corrections
- `learned_corrections` - Learned patterns from corrections

### Queue Tables
- `task_queue` - AI classification queue
- `task_results` - Queue task results

### Configuration Tables
- `radarr_config` - Radarr instances
- `sonarr_config` - Sonarr instances
- `settings` - Application settings (JSON storage)

### Batch Tables (auto-created)
- `reclassification_batches` - Batch job tracking
- `reclassification_batch_items` - Individual items in batches

## Creating New Migrations

### Option 1: SQL File Migration

```bash
# Create migration file
echo "-- Description of changes" > server/database/migrations/004_my_change.sql
```

```sql
-- server/database/migrations/004_my_change.sql
ALTER TABLE libraries ADD COLUMN new_field VARCHAR(50);
CREATE INDEX idx_libraries_new_field ON libraries(new_field);
```

### Option 2: Service-Level Table Creation

```javascript
// In your service's constructor or initialization
async ensureTables() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS my_table (
            id SERIAL PRIMARY KEY,
            ...
        )
    `);
}
```

## Best Practices

1. **Always use `IF NOT EXISTS`** - Makes migrations idempotent
2. **Test migrations** - Run locally before deploying
3. **Keep migrations small** - One logical change per file
4. **Never modify applied migrations** - Create new ones instead
5. **Document breaking changes** - Note in CHANGELOG.md

## Troubleshooting

### Migration stuck/failed
```sql
-- Check applied migrations
SELECT * FROM schema_migrations ORDER BY applied_at;

-- Manually mark as applied (if already done manually)
INSERT INTO schema_migrations (filename) VALUES ('004_my_migration.sql');
```

### Reset all migrations (DANGER!)
```sql
-- Only for development!
DROP TABLE schema_migrations;
```
