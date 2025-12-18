# Database Migrations

This directory contains SQL migration files for Classifarr database schema updates.

## Migration Files

- `001_add_arr_settings.sql` - Adds comprehensive *arr integration settings to libraries table

## Running Migrations

### Option 1: Manual Execution

Connect to your PostgreSQL database and run the migration file:

```bash
psql -U your_user -d classifarr_db -f database/migrations/001_add_arr_settings.sql
```

### Option 2: Using Docker

If running Classifarr with Docker:

```bash
docker exec -i classifarr_db psql -U classifarr_user -d classifarr_db < database/migrations/001_add_arr_settings.sql
```

### Option 3: From Running Container

```bash
docker exec -it classifarr_db psql -U classifarr_user -d classifarr_db
\i /migrations/001_add_arr_settings.sql
```

## Migration Order

Migrations should be run in numerical order (001, 002, etc.). Each migration is idempotent and can be safely run multiple times using `IF NOT EXISTS` clauses.

## New Installations

For new installations, use `database/init.sql` which contains the complete schema including all migrations. The migration files are only needed for existing databases.
