/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

-- Migration: Enable pg_stat_statements for production query profiling
--
-- pg_stat_statements tracks cumulative execution statistics for all SQL statements:
-- call count, total/min/mean/max execution time, rows returned, cache hit rates, etc.
--
-- REQUIREMENT: shared_preload_libraries must include 'pg_stat_statements' in
-- postgresql.conf BEFORE PostgreSQL starts. docker-entrypoint.sh configures this
-- automatically for both new and existing installations.
--
-- USAGE (connect to DB and run):
--   -- Top slowest queries by cumulative time:
--   SELECT query, calls, total_exec_time, mean_exec_time, rows
--   FROM pg_stat_statements
--   ORDER BY total_exec_time DESC
--   LIMIT 20;
--
--   -- Most frequently called queries:
--   SELECT query, calls, mean_exec_time
--   FROM pg_stat_statements
--   ORDER BY calls DESC
--   LIMIT 20;
--
--   -- Reset stats after profiling session:
--   SELECT pg_stat_statements_reset();
--
-- NOTE:
--   pg_stat_statements is optional observability. Do not let it block startup.
--   Only install the extension when both conditions are true:
--   1. the extension files are present in this PostgreSQL image
--   2. shared_preload_libraries already includes pg_stat_statements
--
-- If either condition is false, skip with a NOTICE. Startup preflight will
-- install the extension automatically on a later boot if the runtime becomes
-- available again.

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
    ELSE
        RAISE NOTICE 'Skipping pg_stat_statements extension install because the runtime is unavailable or not preloaded.';
    END IF;
END $$;
