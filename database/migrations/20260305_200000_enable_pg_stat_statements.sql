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
-- NOTE: This CREATE EXTENSION will fail if shared_preload_libraries is not yet
-- configured (e.g. on first run before docker-entrypoint.sh has updated the conf).
-- The migration runner will leave it as "unapplied" and retry on the next startup
-- (after the entrypoint has configured the library and (re)started postgres).
-- On subsequent startups the extension will already be loaded and this will succeed.

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
