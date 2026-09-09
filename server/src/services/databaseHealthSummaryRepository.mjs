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

export const LOAD_DATABASE_HEALTH_SUMMARY_SQL = `
  WITH io_statistics AS (
    SELECT
      COALESCE(SUM(reads), 0)::text AS read_operations,
      COALESCE(SUM(writes), 0)::text AS write_operations,
      COALESCE(SUM(hits), 0)::text AS cache_hit_count,
      MAX(stats_reset) AS statistics_reset_at
    FROM pg_stat_io
    WHERE object = 'relation'
  ), table_statistics AS (
    SELECT
      COALESCE(SUM(n_dead_tup), 0)::text AS estimated_dead_tuples,
      COUNT(*) FILTER (WHERE n_dead_tup > 0)::text AS tables_with_dead_tuples
    FROM pg_stat_user_tables
  )
  SELECT
    io_statistics.read_operations,
    io_statistics.write_operations,
    io_statistics.cache_hit_count,
    io_statistics.statistics_reset_at,
    table_statistics.estimated_dead_tuples,
    table_statistics.tables_with_dead_tuples
  FROM io_statistics
  CROSS JOIN table_statistics
`;

/**
 * Reads one fixed aggregate from PostgreSQL's cumulative views. The query has
 * no caller-controlled dimensions and never reads query text, identifiers,
 * configuration, policy, media, library, provider, AI, or routing state.
 */
export async function loadDatabaseHealthSummary(database) {
  if (!database || typeof database.query !== 'function') {
    throw new TypeError('Database health summary requires a query-capable database.');
  }

  const result = await database.query(LOAD_DATABASE_HEALTH_SUMMARY_SQL);
  return result?.rows?.[0] || null;
}
