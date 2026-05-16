/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

-- Migration: 20260516_183500_reconcile_pg_stat_statements_state.sql
--
-- Why this exists:
--   1. Existing databases may already have recorded
--      20260305_200000_enable_pg_stat_statements.sql in schema_migrations.
--   2. Applied versioned migrations should be treated as immutable once they
--      have been shared with other environments.
--   3. The real startup fix for missing pg_stat_statements runtime files lives
--      in docker-entrypoint.sh because PostgreSQL must be able to boot before
--      SQL migrations can run.
--
-- What this migration does:
--   - If pg_stat_statements is available in this PostgreSQL image AND already
--     preloaded via shared_preload_libraries, install it if still missing.
--   - Otherwise emit a NOTICE and succeed. This keeps the migration ledger
--     consistent without making pg_stat_statements a hard runtime dependency.

DO $$
DECLARE
    preload_setting text;
BEGIN
    SELECT setting INTO preload_setting
    FROM pg_settings
    WHERE name = 'shared_preload_libraries';

    IF EXISTS (
        SELECT 1
        FROM pg_available_extensions
        WHERE name = 'pg_stat_statements'
    ) AND position('pg_stat_statements' IN COALESCE(preload_setting, '')) > 0 THEN
        CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;
        COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';
    ELSE
        RAISE NOTICE 'Skipping pg_stat_statements reconciliation because the runtime is unavailable or not preloaded.';
    END IF;
END $$;
