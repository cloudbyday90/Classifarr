# Database Migrations

This directory contains database migration scripts for updating existing Classifarr installations.

## Running Migrations

Migrations should be run manually against your PostgreSQL database in order:

```bash
# Connect to your database
psql -U classifarr -d classifarr

# Run the migration
\i database/migrations/001_add_arr_settings.sql
```

## Available Migrations

### 001_add_arr_settings.sql
Adds support for full Radarr and Sonarr integration settings per library:
- Adds `radarr_settings` JSONB column to `libraries` table
- Adds `sonarr_settings` JSONB column to `libraries` table
- Creates `arr_profiles_cache` table for caching profiles from Radarr/Sonarr

**Required for:** Version 1.1.0+

## Migration Strategy

- Migrations use `IF NOT EXISTS` clauses to be idempotent
- Legacy fields are retained for backward compatibility
- New features should use the new JSONB fields
