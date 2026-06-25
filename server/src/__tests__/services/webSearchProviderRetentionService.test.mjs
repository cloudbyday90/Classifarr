/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  WebSearchProviderRetentionService,
  normalizeWebSearchProviderRetentionPolicy,
} from '../../services/webSearchProviderRetentionService.mjs';

function createMockDb(rowsByCall = []) {
  const calls = [];
  return {
    calls,
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      const next = rowsByCall.shift();
      return {
        rows: Array.isArray(next?.rows) ? next.rows : [],
        rowCount: Number.isFinite(next?.rowCount) ? next.rowCount : 0,
      };
    },
  };
}

function createMockLogger() {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  };
}

describe('webSearchProviderRetentionService', () => {
  test('normalizes retention policy with safe defaults and bounded batch sizes', () => {
    expect(normalizeWebSearchProviderRetentionPolicy({
      usageRetentionDays: 'bad',
      usageBatchSize: 20_000,
      cacheBatchSize: 0,
    })).toEqual({
      usageRetentionDays: 62,
      usageBatchSize: 5000,
      cacheBatchSize: 500,
    });
  });

  test('reads usage retention days from settings with default fallback', async () => {
    const db = createMockDb([{ rows: [{ value: '45' }] }]);
    const service = new WebSearchProviderRetentionService({
      db,
      cacheStore: { deleteExpired: jest.fn() },
      logger: createMockLogger(),
    });

    await expect(service.readUsageRetentionDays()).resolves.toBe(45);
    expect(db.calls[0].params).toEqual(['web_search_provider_usage_retention_days']);
  });

  test('deletes old usage rows without deleting the current quota month', async () => {
    const db = createMockDb([{ rowCount: 7 }]);
    const service = new WebSearchProviderRetentionService({
      db,
      cacheStore: { deleteExpired: jest.fn() },
      logger: createMockLogger(),
    });

    await expect(service.deleteOldUsageRows({
      now: new Date('2026-06-24T12:00:00.000Z'),
      retentionDays: 7,
      limit: 20_000,
    })).resolves.toBe(7);

    expect(db.calls[0].sql).toContain("date_trunc('month'");
    expect(db.calls[0].sql).toContain('LEAST(');
    expect(db.calls[0].params).toEqual([
      new Date('2026-06-24T12:00:00.000Z'),
      7,
      5000,
    ]);
  });

  test('cleans usage rows in batches and deletes expired cache rows', async () => {
    const db = createMockDb([
      { rows: [{ value: '62' }] },
      { rowCount: 1000 },
      { rowCount: 12 },
    ]);
    const cacheStore = {
      deleteExpired: jest.fn().mockResolvedValue(['cache-1', 'cache-2']),
    };
    const logger = createMockLogger();
    const service = new WebSearchProviderRetentionService({ db, cacheStore, logger });

    const result = await service.cleanup({
      now: new Date('2026-06-24T12:00:00.000Z'),
      usageBatchSize: 1000,
      cacheBatchSize: 25,
    });

    expect(result).toEqual({
      usageDeleted: 1012,
      cacheDeleted: 2,
      usageRetentionDays: 62,
    });
    expect(cacheStore.deleteExpired).toHaveBeenCalledWith({
      now: new Date('2026-06-24T12:00:00.000Z'),
      limit: 25,
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Web search provider retention cleanup complete',
      result
    );
  });

  test('logs and returns a bounded failure summary instead of throwing', async () => {
    const db = {
      query: jest.fn().mockRejectedValue(new Error('database unavailable')),
    };
    const logger = createMockLogger();
    const service = new WebSearchProviderRetentionService({
      db,
      cacheStore: { deleteExpired: jest.fn() },
      logger,
    });

    await expect(service.cleanup()).resolves.toEqual(expect.objectContaining({
      usageDeleted: 0,
      cacheDeleted: 0,
      error: 'database unavailable',
    }));
    expect(logger.error).toHaveBeenCalledWith(
      'Web search provider retention cleanup failed',
      { error: 'database unavailable' }
    );
  });
});
