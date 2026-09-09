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

import { describe, expect, test } from '@jest/globals';
import {
  DATABASE_HEALTH_TRANSITION_CONFIRMATION_OBSERVATION_COUNT,
  areDatabaseHealthTransitionBucketStatesEqual,
  getDatabaseHealthTransitionBucketState,
  normalizeStoredDatabaseHealthTransitionState,
  projectDatabaseHealthTransitionBucketState,
} from '../../services/databaseHealthTransitionState.mjs';

const HEALTH_SUMMARY = Object.freeze({
  statisticsResetAt: '2026-09-09T00:00:00.000Z',
  io: Object.freeze({ readOperations: 'low', writeOperations: 'none', cacheHits: 'moderate' }),
  tableStatistics: Object.freeze({ estimatedDeadTuples: 'low', tablesWithDeadTuples: 'none' }),
});

describe('databaseHealthTransitionState', () => {
  test('derives the complete bucket state from the already-redacted summary', () => {
    expect(getDatabaseHealthTransitionBucketState(HEALTH_SUMMARY)).toEqual({
      readOperations: 'low',
      writeOperations: 'none',
      cacheHits: 'moderate',
      estimatedDeadTuples: 'low',
      tablesWithDeadTuples: 'none',
    });
    expect(DATABASE_HEALTH_TRANSITION_CONFIRMATION_OBSERVATION_COUNT).toBe(2);
  });

  test('fails closed when any persisted candidate bucket is invalid', () => {
    expect(getDatabaseHealthTransitionBucketState({
      ...HEALTH_SUMMARY,
      io: { ...HEALTH_SUMMARY.io, cacheHits: 'raw:1234' },
    })).toBeNull();
  });

  test('normalizes only a complete fixed pending state', () => {
    const state = normalizeStoredDatabaseHealthTransitionState({
      statistics_reset_at: '2026-09-09T00:00:00.000Z',
      stable_read_operations: 'low',
      stable_write_operations: 'none',
      stable_cache_hits: 'moderate',
      stable_estimated_dead_tuples: 'low',
      stable_tables_with_dead_tuples: 'none',
      pending_read_operations: 'moderate',
      pending_write_operations: 'none',
      pending_cache_hits: 'high',
      pending_estimated_dead_tuples: 'low',
      pending_tables_with_dead_tuples: 'none',
      pending_observation_count: 1,
    });

    expect(state.pending).toEqual({
      readOperations: 'moderate',
      writeOperations: 'none',
      cacheHits: 'high',
      estimatedDeadTuples: 'low',
      tablesWithDeadTuples: 'none',
    });
    expect(areDatabaseHealthTransitionBucketStatesEqual(state.stable, state.pending)).toBe(false);
    expect(projectDatabaseHealthTransitionBucketState(state.stable)).toEqual({
      io: { readOperations: 'low', writeOperations: 'none', cacheHits: 'moderate' },
      tableStatistics: { estimatedDeadTuples: 'low', tablesWithDeadTuples: 'none' },
    });
  });

  test('rejects partial pending state instead of inferring a transition', () => {
    expect(() => normalizeStoredDatabaseHealthTransitionState({
      statistics_reset_at: '2026-09-09T00:00:00.000Z',
      stable_read_operations: 'low',
      stable_write_operations: 'none',
      stable_cache_hits: 'moderate',
      stable_estimated_dead_tuples: 'low',
      stable_tables_with_dead_tuples: 'none',
      pending_read_operations: 'moderate',
      pending_observation_count: 1,
    })).toThrow('pending state is invalid');
  });
});
