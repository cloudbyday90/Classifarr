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

import { describe, expect, jest, test } from '@jest/globals';

import { buildDatabaseHealthSummary } from '../../services/databaseHealthSummary.mjs';
import {
  loadDatabaseHealthSummary,
} from '../../services/databaseHealthSummaryRepository.mjs';
import {
  createDatabaseHealthSummaryService,
} from '../../services/databaseHealthSummaryService.mjs';

describe('databaseHealthSummary', () => {
  test('projects fixed aggregate buckets and freshness while dropping source dimensions', () => {
    const summary = buildDatabaseHealthSummary({
      observedAt: '2026-09-09T12:00:00.000Z',
      row: {
        read_operations: '00042',
        write_operations: '1000',
        cache_hit_count: '100000',
        estimated_dead_tuples: '0',
        tables_with_dead_tuples: '7',
        statistics_reset_at: '2026-09-08T12:00:00.000Z',
        query: 'private query text',
        query_id: '99',
        library_name: 'private library',
        provider: 'private provider',
      },
    });

    expect(summary).toEqual({
      version: 'database.health_summary.v1',
      observedAt: '2026-09-09T12:00:00.000Z',
      statisticsResetAt: '2026-09-08T12:00:00.000Z',
      io: {
        readOperations: 'low',
        writeOperations: 'moderate',
        cacheHits: 'high',
      },
      tableStatistics: {
        estimatedDeadTuples: 'none',
        tablesWithDeadTuples: 'low',
      },
    });
    expect(JSON.stringify(summary)).not.toContain('private');
    expect(JSON.stringify(summary)).not.toContain('query_id');
  });

  test('fails closed to empty buckets and null freshness for malformed source data', () => {
    expect(buildDatabaseHealthSummary({
      observedAt: 'not-a-timestamp',
      row: {
        read_operations: '-1',
        write_operations: 'not-a-count',
        cache_hit_count: null,
        estimated_dead_tuples: 'NaN',
        tables_with_dead_tuples: '-7',
        statistics_reset_at: 'not-a-timestamp',
      },
    })).toEqual({
      version: 'database.health_summary.v1',
      observedAt: null,
      statisticsResetAt: null,
      io: {
        readOperations: 'none',
        writeOperations: 'none',
        cacheHits: 'none',
      },
      tableStatistics: {
        estimatedDeadTuples: 'none',
        tablesWithDeadTuples: 'none',
      },
    });
  });

  test('uses one fixed aggregate query with no caller dimensions or sensitive views', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({
        rows: [{ read_operations: '2', write_operations: '1' }],
      }),
    };

    await expect(loadDatabaseHealthSummary(database)).resolves.toEqual(
      expect.objectContaining({ read_operations: '2' }),
    );

    expect(database.query).toHaveBeenCalledWith(expect.stringContaining('FROM pg_stat_io'));
    const [sql, parameters] = database.query.mock.calls[0];
    expect(parameters).toBeUndefined();
    expect(sql).toContain('FROM pg_stat_user_tables');
    expect(sql).not.toContain('pg_stat_activity');
    expect(sql).not.toContain('pg_stat_statements');
    expect(sql).not.toContain('settings');
    expect(sql).not.toContain('classification');
  });

  test('binds observation freshness to the service-owned read time', async () => {
    const loadSummary = jest.fn().mockResolvedValue({
      read_operations: '1',
      write_operations: '0',
      cache_hit_count: '0',
      estimated_dead_tuples: '0',
      tables_with_dead_tuples: '0',
      statistics_reset_at: '2026-09-08T00:00:00.000Z',
    });
    const service = createDatabaseHealthSummaryService({
      database: {},
      loadSummary,
      now: () => new Date('2026-09-09T12:00:00.000Z'),
    });

    await expect(service.getSummary()).resolves.toMatchObject({
      observedAt: '2026-09-09T12:00:00.000Z',
      io: { readOperations: 'low' },
    });
    expect(loadSummary).toHaveBeenCalledWith({});
  });
});
