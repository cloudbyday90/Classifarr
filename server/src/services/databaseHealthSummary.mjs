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

export const DATABASE_HEALTH_SUMMARY_VERSION = 'database.health_summary.v1';

const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+$/;
const LOW_ACTIVITY_MAXIMUM = 999n;
const MODERATE_ACTIVITY_MAXIMUM = 99_999n;

function normalizeNonNegativeDecimal(value) {
  const normalized = String(value ?? '').trim();
  if (!NON_NEGATIVE_DECIMAL_PATTERN.test(normalized)) return 0n;

  try {
    return BigInt(normalized);
  } catch {
    return 0n;
  }
}

function bucketCumulativeCount(value) {
  const count = normalizeNonNegativeDecimal(value);
  if (count === 0n) return 'none';
  if (count <= LOW_ACTIVITY_MAXIMUM) return 'low';
  if (count <= MODERATE_ACTIVITY_MAXIMUM) return 'moderate';
  return 'high';
}

function normalizeTimestamp(value) {
  if (!value) return null;

  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

/**
 * Projects PostgreSQL cumulative statistics into a deliberately small,
 * content-free contract. It never forwards table, library, provider, query,
 * configuration, policy, AI, or routing data from a database result.
 */
export function buildDatabaseHealthSummary({ row = null, observedAt = null } = {}) {
  return Object.freeze({
    version: DATABASE_HEALTH_SUMMARY_VERSION,
    observedAt: normalizeTimestamp(observedAt),
    statisticsResetAt: normalizeTimestamp(
      row?.statistics_reset_at ?? row?.statisticsResetAt,
    ),
    io: Object.freeze({
      readOperations: bucketCumulativeCount(row?.read_operations ?? row?.readOperations),
      writeOperations: bucketCumulativeCount(row?.write_operations ?? row?.writeOperations),
      cacheHits: bucketCumulativeCount(row?.cache_hit_count ?? row?.cacheHitCount),
    }),
    tableStatistics: Object.freeze({
      estimatedDeadTuples: bucketCumulativeCount(
        row?.estimated_dead_tuples ?? row?.estimatedDeadTuples,
      ),
      tablesWithDeadTuples: bucketCumulativeCount(
        row?.tables_with_dead_tuples ?? row?.tablesWithDeadTuples,
      ),
    }),
  });
}
