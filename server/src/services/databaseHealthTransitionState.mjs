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

export const DATABASE_HEALTH_BUCKET_VALUES = Object.freeze([
  'none',
  'low',
  'moderate',
  'high',
]);

export const DATABASE_HEALTH_TRANSITION_CONFIRMATION_OBSERVATION_COUNT = 2;

const DATABASE_HEALTH_BUCKET_VALUE_SET = new Set(DATABASE_HEALTH_BUCKET_VALUES);
const TRANSITION_BUCKET_KEYS = Object.freeze([
  'readOperations',
  'writeOperations',
  'cacheHits',
  'estimatedDeadTuples',
  'tablesWithDeadTuples',
]);

function normalizeBucket(value) {
  return DATABASE_HEALTH_BUCKET_VALUE_SET.has(value) ? value : null;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function freezeBucketState(state) {
  return Object.freeze({
    readOperations: state.readOperations,
    writeOperations: state.writeOperations,
    cacheHits: state.cacheHits,
    estimatedDeadTuples: state.estimatedDeadTuples,
    tablesWithDeadTuples: state.tablesWithDeadTuples,
  });
}

/**
 * Converts the public, already-redacted health summary into the five buckets
 * eligible for passive persistence. Invalid input remains unavailable instead
 * of being coerced into a trend.
 */
export function getDatabaseHealthTransitionBucketState(summary = {}) {
  const state = {
    readOperations: normalizeBucket(summary?.io?.readOperations),
    writeOperations: normalizeBucket(summary?.io?.writeOperations),
    cacheHits: normalizeBucket(summary?.io?.cacheHits),
    estimatedDeadTuples: normalizeBucket(summary?.tableStatistics?.estimatedDeadTuples),
    tablesWithDeadTuples: normalizeBucket(summary?.tableStatistics?.tablesWithDeadTuples),
  };

  return TRANSITION_BUCKET_KEYS.every(key => state[key] !== null)
    ? freezeBucketState(state)
    : null;
}

export function getDatabaseHealthTransitionResetAt(summary = {}) {
  return normalizeTimestamp(summary?.statisticsResetAt);
}

export function areDatabaseHealthTransitionBucketStatesEqual(left, right) {
  if (!left || !right) return false;
  return TRANSITION_BUCKET_KEYS.every(key => left[key] === right[key]);
}

export function projectDatabaseHealthTransitionBucketState(state) {
  if (!state || !TRANSITION_BUCKET_KEYS.every(key => normalizeBucket(state[key]) !== null)) {
    throw new TypeError('Database health transition bucket state is invalid.');
  }

  return Object.freeze({
    io: Object.freeze({
      readOperations: state.readOperations,
      writeOperations: state.writeOperations,
      cacheHits: state.cacheHits,
    }),
    tableStatistics: Object.freeze({
      estimatedDeadTuples: state.estimatedDeadTuples,
      tablesWithDeadTuples: state.tablesWithDeadTuples,
    }),
  });
}

export function normalizeStoredDatabaseHealthTransitionState(row = {}) {
  const stable = {
    readOperations: normalizeBucket(row.stable_read_operations ?? row.stableReadOperations),
    writeOperations: normalizeBucket(row.stable_write_operations ?? row.stableWriteOperations),
    cacheHits: normalizeBucket(row.stable_cache_hits ?? row.stableCacheHits),
    estimatedDeadTuples: normalizeBucket(
      row.stable_estimated_dead_tuples ?? row.stableEstimatedDeadTuples,
    ),
    tablesWithDeadTuples: normalizeBucket(
      row.stable_tables_with_dead_tuples ?? row.stableTablesWithDeadTuples,
    ),
  };
  const pending = {
    readOperations: normalizeBucket(row.pending_read_operations ?? row.pendingReadOperations),
    writeOperations: normalizeBucket(row.pending_write_operations ?? row.pendingWriteOperations),
    cacheHits: normalizeBucket(row.pending_cache_hits ?? row.pendingCacheHits),
    estimatedDeadTuples: normalizeBucket(
      row.pending_estimated_dead_tuples ?? row.pendingEstimatedDeadTuples,
    ),
    tablesWithDeadTuples: normalizeBucket(
      row.pending_tables_with_dead_tuples ?? row.pendingTablesWithDeadTuples,
    ),
  };
  const pendingObservationCount = Number(
    row.pending_observation_count ?? row.pendingObservationCount ?? 0,
  );
  const resetAt = normalizeTimestamp(row.statistics_reset_at ?? row.statisticsResetAt);
  const pendingPresent = TRANSITION_BUCKET_KEYS.every(key => pending[key] !== null);
  const pendingAbsent = TRANSITION_BUCKET_KEYS.every(key => pending[key] === null);

  if (!resetAt || TRANSITION_BUCKET_KEYS.some(key => stable[key] === null)) {
    throw new TypeError('Stored database health transition state is invalid.');
  }
  if (pendingObservationCount === 0 && pendingAbsent) {
    return Object.freeze({ statisticsResetAt: resetAt, stable: freezeBucketState(stable), pending: null });
  }
  if (
    pendingObservationCount === DATABASE_HEALTH_TRANSITION_CONFIRMATION_OBSERVATION_COUNT - 1
    && pendingPresent
  ) {
    return Object.freeze({
      statisticsResetAt: resetAt,
      stable: freezeBucketState(stable),
      pending: freezeBucketState(pending),
    });
  }

  throw new TypeError('Stored database health transition pending state is invalid.');
}
