/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import {
  WEB_SEARCH_ROUTE_DECISION_RETENTION_SETTING_KEY,
  WebSearchProviderRouteDecisionRetentionService,
  normalizeWebSearchRouteDecisionRetentionPolicy,
} from '../../services/webSearchProviderRouteDecisionRetention.mjs';

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

describe('webSearchProviderRouteDecisionRetentionService', () => {
  test('normalizes retention policy with safe defaults and bounded values', () => {
    expect(normalizeWebSearchRouteDecisionRetentionPolicy({
      retentionDays: 20_000,
      batchSize: 20_000,
    })).toEqual({
      retentionDays: 365,
      batchSize: 5000,
    });

    expect(normalizeWebSearchRouteDecisionRetentionPolicy({
      retentionDays: 'bad',
      batchSize: 0,
    })).toEqual({
      retentionDays: 30,
      batchSize: 1000,
    });
  });

  test('reads route decision retention days from settings with default fallback', async () => {
    const db = createMockDb([{ rows: [{ value: '45' }] }]);
    const service = new WebSearchProviderRouteDecisionRetentionService({
      db,
      logger: createMockLogger(),
    });

    await expect(service.readRetentionDays()).resolves.toBe(45);
    expect(db.calls[0].params).toEqual([WEB_SEARCH_ROUTE_DECISION_RETENTION_SETTING_KEY]);
  });

  test('deletes old route decisions in bounded indexed batches', async () => {
    const db = createMockDb([{ rowCount: 7 }]);
    const service = new WebSearchProviderRouteDecisionRetentionService({
      db,
      logger: createMockLogger(),
    });

    await expect(service.deleteOldRouteDecisionRows({
      now: new Date('2026-06-25T12:00:00.000Z'),
      retentionDays: 14,
      limit: 20_000,
    })).resolves.toBe(7);

    expect(db.calls[0].sql).toContain('DELETE FROM web_search_provider_route_decisions');
    expect(db.calls[0].sql).toContain('ORDER BY created_at ASC, id ASC');
    expect(db.calls[0].params).toEqual([
      new Date('2026-06-25T12:00:00.000Z'),
      14,
      5000,
    ]);
  });

  test('cleans route decisions until the final partial batch', async () => {
    const db = createMockDb([
      { rows: [{ value: '30' }] },
      { rowCount: 1000 },
      { rowCount: 12 },
    ]);
    const logger = createMockLogger();
    const service = new WebSearchProviderRouteDecisionRetentionService({ db, logger });

    const result = await service.cleanup({
      now: new Date('2026-06-25T12:00:00.000Z'),
      batchSize: 1000,
    });

    expect(result).toEqual({
      routeDecisionsDeleted: 1012,
      routeDecisionRetentionDays: 30,
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Web search provider route decision retention cleanup complete',
      result
    );
  });

  test('logs and returns a bounded failure summary instead of throwing', async () => {
    const db = {
      query: jest.fn().mockRejectedValue(new Error('database unavailable')),
    };
    const logger = createMockLogger();
    const service = new WebSearchProviderRouteDecisionRetentionService({ db, logger });

    await expect(service.cleanup()).resolves.toEqual(expect.objectContaining({
      routeDecisionsDeleted: 0,
      routeDecisionRetentionDays: null,
      error: 'database unavailable',
    }));
    expect(logger.error).toHaveBeenCalledWith(
      'Web search provider route decision retention cleanup failed',
      { error: 'database unavailable' }
    );
  });
});
