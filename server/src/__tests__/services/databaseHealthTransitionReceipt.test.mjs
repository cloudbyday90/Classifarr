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
import {
  buildDatabaseHealthTransitionReceiptSummary,
  projectDatabaseHealthTransitionReceipt,
} from '../../services/databaseHealthTransitionReceipt.mjs';
import {
  createDatabaseHealthTransitionReceiptReadService,
} from '../../services/databaseHealthTransitionReceiptReadService.mjs';

const RECEIPT_ROW = Object.freeze({
  id: '5',
  receipt_version: 1,
  statistics_reset_at: '2026-09-09T00:00:00.000Z',
  before_read_operations: 'low',
  before_write_operations: 'none',
  before_cache_hits: 'moderate',
  before_estimated_dead_tuples: 'low',
  before_tables_with_dead_tuples: 'none',
  after_read_operations: 'moderate',
  after_write_operations: 'none',
  after_cache_hits: 'high',
  after_estimated_dead_tuples: 'low',
  after_tables_with_dead_tuples: 'none',
  confirmation_observation_count: 2,
  recorded_at: '2026-09-09T12:00:00.000Z',
});

describe('databaseHealthTransitionReceipt', () => {
  test('projects only provenance and coarse before/after states', () => {
    expect(projectDatabaseHealthTransitionReceipt(RECEIPT_ROW)).toEqual({
      receiptId: '5',
      version: 'database.health_transition_receipt.v1',
      statisticsResetAt: '2026-09-09T00:00:00.000Z',
      before: {
        io: { readOperations: 'low', writeOperations: 'none', cacheHits: 'moderate' },
        tableStatistics: { estimatedDeadTuples: 'low', tablesWithDeadTuples: 'none' },
      },
      after: {
        io: { readOperations: 'moderate', writeOperations: 'none', cacheHits: 'high' },
        tableStatistics: { estimatedDeadTuples: 'low', tablesWithDeadTuples: 'none' },
      },
      confirmationObservationCount: 2,
      recordedAt: '2026-09-09T12:00:00.000Z',
    });
  });

  test('does not construct a receipt from an invalid bucket or confirmation count', () => {
    expect(() => projectDatabaseHealthTransitionReceipt({
      ...RECEIPT_ROW,
      after_cache_hits: '1000000',
    })).toThrow('state is invalid');
    expect(() => projectDatabaseHealthTransitionReceipt({
      ...RECEIPT_ROW,
      confirmation_observation_count: 1,
    })).toThrow('confirmation is invalid');
  });

  test('uses an explicit no-transition state until a current-period receipt exists', () => {
    expect(buildDatabaseHealthTransitionReceiptSummary()).toEqual(expect.objectContaining({
      version: 'database.health_transition_receipt_summary.v1',
      status: { id: 'no_persistent_transition' },
      receipt: null,
    }));
  });
});

describe('databaseHealthTransitionReceiptReadService', () => {
  test('reads a single current-period receipt in a repeatable read-only transaction', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const loadLatestReceipt = jest.fn().mockResolvedValue(RECEIPT_ROW);
    const buildSummary = jest.fn().mockReturnValue({ status: { id: 'persistent_transition_recorded' } });
    const service = createDatabaseHealthTransitionReceiptReadService({
      database: { withTransaction: async callback => callback(client) },
      loadLatestReceipt,
      buildSummary,
    });

    await expect(service.getSummary()).resolves.toEqual({ status: { id: 'persistent_transition_recorded' } });
    expect(client.query).toHaveBeenCalledWith('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(loadLatestReceipt).toHaveBeenCalledWith(client);
    expect(buildSummary).toHaveBeenCalledWith(RECEIPT_ROW);
  });
});
