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
  applyDeferredCounts,
  aggregateStatsRows,
  createEmptyStats,
} from '../services/enrichmentRetryStats.mjs';
import {
  failExhaustedPendingRetries,
  recoverStaleProcessingRetries,
  resolveRetriesWithExistingMetadata,
} from '../services/enrichmentRetryMaintenance.mjs';
import {
  buildOmdbFallbackReason,
  enrichWithOmdb,
  handleOmdbFallback,
  isExpectedOmdbMiss,
  isTransientOmdbTransportError,
} from '../services/enrichmentRetryOmdb.mjs';
import { processRetryQueue } from '../services/enrichmentRetryProcessing.mjs';
import { extractImdbData } from '../services/webSearchEnrichmentEvidence.mjs';

function createDb(handler = () => ({ rows: [], rowCount: 0 })) {
  return { query: jest.fn(async (...args) => handler(...args)) };
}

function createLogger() {
  return {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

function createStateService() {
  return {
    syncItemState: jest.fn().mockResolvedValue(),
    syncItemStates: jest.fn().mockResolvedValue(),
  };
}

function createProcessingDeps(overrides = {}) {
  return {
    db: createDb(),
    logger: createLogger(),
    enrichmentItemStateService: createStateService(),
    recoverStaleProcessingRetries: jest.fn().mockResolvedValue(0),
    normalizeTavilyMonthlyDeferredRows: jest.fn().mockResolvedValue(0),
    resolveRetriesWithExistingMetadata: jest.fn().mockResolvedValue(0),
    failExhaustedPendingRetries: jest.fn().mockResolvedValue(0),
    enrichWithOmdb: jest.fn(),
    enrichWithWebSearch: jest.fn(),
    hasAvailableWebSearchProvider: jest.fn().mockResolvedValue(true),
    handleOmdbFallback: jest.fn().mockResolvedValue(false),
    isExpectedOmdbMiss,
    ...overrides,
  };
}

describe('enrichment retry statistics', () => {
  test('keeps current web-search and historical Tavily counters separate', () => {
    const stats = aggregateStatsRows([
      { enrichment_type: 'web_search', status: 'pending', count: '3' },
      { enrichment_type: 'tavily', status: 'pending', count: '2' },
      { enrichment_type: 'omdb', status: 'completed', count: '4' },
    ]);

    applyDeferredCounts(stats, 1);

    expect(stats.web_search).toEqual(expect.objectContaining({
      pending: 3,
      actionablePending: 3,
    }));
    expect(stats.tavily).toEqual(expect.objectContaining({
      pending: 2,
      deferred: 1,
      actionablePending: 1,
    }));
    expect(stats.total).toEqual(expect.objectContaining({
      pending: 5,
      completed: 4,
      deferred: 1,
      actionablePending: 4,
    }));
  });

  test('uses a stable empty shape for all supported types', () => {
    expect(createEmptyStats()).toEqual(expect.objectContaining({
      tavily: expect.objectContaining({ pending: 0 }),
      web_search: expect.objectContaining({ pending: 0 }),
      omdb: expect.objectContaining({ pending: 0 }),
      total: expect.objectContaining({ actionablePending: 0 }),
    }));
  });
});

describe('enrichment retry maintenance', () => {
  test('auto-resolves both historical and current web-search retry rows when evidence exists', async () => {
    const db = createDb(() => ({
      rowCount: 2,
      rows: [
        { id: 1, media_item_id: 20, enrichment_type: 'tavily' },
        { id: 2, media_item_id: 21, enrichment_type: 'web_search' },
      ],
    }));
    const state = createStateService();
    const logger = createLogger();

    await expect(resolveRetriesWithExistingMetadata({
      db,
      enrichmentItemStateService: state,
      logger,
    })).resolves.toBe(2);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("msi.metadata->'web_search_imdb' IS NOT NULL"),
      []
    );
    expect(state.syncItemStates).toHaveBeenCalledWith([20, 21]);
  });

  test('filters stale processing recovery by requested enrichment type', async () => {
    const db = createDb(() => ({
      rowCount: 1,
      rows: [{ id: 4, media_item_id: 42, enrichment_type: 'web_search' }],
    }));
    const state = createStateService();
    const logger = createLogger();

    await expect(recoverStaleProcessingRetries({
      db,
      enrichmentItemStateService: state,
      logger,
    }, 'web_search')).resolves.toBe(1);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('AND enrichment_type = $2'),
      [20 * 60 * 1000, 'web_search']
    );
    expect(state.syncItemStates).toHaveBeenCalledWith([42]);
  });

  test('does not auto-fail a historical monthly-quota deferred Tavily row', async () => {
    const db = createDb(() => ({ rowCount: 0, rows: [] }));

    await failExhaustedPendingRetries({
      db,
      enrichmentItemStateService: createStateService(),
      logger: createLogger(),
    }, 'tavily');

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("NOT (enrichment_type = 'tavily' AND reason = $1)"),
      ['tavily_monthly_quota_deferred', 'tavily']
    );
  });
});

describe('OMDb fallback bridge', () => {
  test.each([
    ['OMDb not found', true],
    ['Movie not found!', true],
    ['Error getting data from OMDb', true],
    ['Invalid API key', false],
  ])('classifies OMDb miss messages safely: %s', (message, expected) => {
    expect(isExpectedOmdbMiss(message)).toBe(expected);
  });

  test.each([408, 429, 502, 503, 504, 520, 527])(
    'recognizes transient OMDb HTTP %i failures',
    (status) => {
      expect(isTransientOmdbTransportError({
        response: { status },
        message: `HTTP ${status}`,
      })).toBe(true);
    }
  );

  test('does not classify a permanent OMDb authentication error as transient', () => {
    expect(isTransientOmdbTransportError({
      response: { status: 401 },
      message: 'Unauthorized',
    })).toBe(false);
  });

  test('builds bounded generic fallback reasons', () => {
    expect(buildOmdbFallbackReason('OMDb not found')).toBe('OMDb not found');
    expect(buildOmdbFallbackReason('x'.repeat(200))).toHaveLength(102);
  });

  test('tries IMDb before title and persists successful OMDb data', async () => {
    const db = createDb(() => ({ rowCount: 1, rows: [] }));
    const omdbService = {
      getByIMDBId: jest.fn().mockResolvedValue({ Title: 'The Matrix' }),
      getByTitle: jest.fn(),
    };

    const result = await enrichWithOmdb({
      db,
      omdbService,
      logger: createLogger(),
    }, {
      media_item_id: 91,
      imdb_id: 'tt0133093',
      title: 'The Matrix',
      year: 1999,
      media_type: 'movie',
    });

    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(omdbService.getByIMDBId).toHaveBeenCalledWith('tt0133093');
    expect(omdbService.getByTitle).not.toHaveBeenCalled();
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("'{omdb}'"),
      [91, expect.any(String)]
    );
  });

  test('moves an OMDb miss to the generic web-search queue', async () => {
    const db = createDb((sql) => (
      String(sql).includes('SELECT id, status, reason')
        ? { rows: [{ id: 15, status: 'pending', reason: 'OMDb not found' }], rowCount: 1 }
        : { rows: [], rowCount: 1 }
    ));
    const queueForRetry = jest.fn().mockResolvedValue();
    const state = createStateService();

    await expect(handleOmdbFallback({
      db,
      logger: createLogger(),
      enrichmentItemStateService: state,
      queueForRetry,
    }, {
      queue_id: 10,
      media_item_id: 20,
    }, 'OMDb not found')).resolves.toBe(true);

    expect(queueForRetry).toHaveBeenCalledWith(20, 'web_search', 'OMDb not found', 5);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("enrichment_type = 'web_search'"),
      [20]
    );
  });
});

describe('provider-neutral retry processing', () => {
  test('does not query work when no provider route is available', async () => {
    const deps = createProcessingDeps({
      hasAvailableWebSearchProvider: jest.fn().mockResolvedValue(false),
    });

    await expect(processRetryQueue(deps, 50, 'web_search')).resolves.toEqual({
      processed: 0,
      success: 0,
      failed: 0,
      autoFailed: 0,
      skipped: true,
      reason: 'No web search provider is available',
    });
    expect(deps.db.query).not.toHaveBeenCalledWith(
      expect.stringContaining('JOIN media_server_items'),
      expect.anything()
    );
  });

  test('marks a successful generic provider retry complete', async () => {
    const item = {
      queue_id: 3,
      media_item_id: 77,
      attempts: 0,
      max_attempts: 3,
      title: 'Example',
    };
    const deps = createProcessingDeps({
      db: createDb((sql) => (
        String(sql).includes('JOIN media_server_items')
          ? { rows: [item], rowCount: 1 }
          : { rows: [], rowCount: 1 }
      )),
      enrichWithWebSearch: jest.fn().mockResolvedValue({ success: true }),
    });

    const result = await processRetryQueue(deps, 50, 'web_search');

    expect(result).toEqual(expect.objectContaining({ processed: 1, success: 1, failed: 0 }));
    expect(deps.enrichWithWebSearch).toHaveBeenCalledWith(item, {
      enrichmentType: 'web_search',
    });
    expect(deps.enrichmentItemStateService.syncItemState).toHaveBeenCalledWith(77);
  });

  test('preserves monthly deferral only for a historical Tavily retry', async () => {
    const item = {
      queue_id: 4,
      media_item_id: 78,
      attempts: 1,
      max_attempts: 3,
      title: 'Historical record',
    };
    const deps = createProcessingDeps({
      db: createDb((sql) => (
        String(sql).includes('JOIN media_server_items')
          ? { rows: [item], rowCount: 1 }
          : { rows: [], rowCount: 1 }
      )),
      enrichWithWebSearch: jest.fn().mockResolvedValue({
        success: false,
        deferUntilMonthlyReset: true,
        error: 'quota exhausted',
      }),
    });

    const result = await processRetryQueue(deps, 50, 'tavily');

    expect(result).toEqual(expect.objectContaining({ processed: 1, failed: 0 }));
    expect(deps.db.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'pending'"),
      [4, 'tavily_monthly_quota_deferred', 'Tavily monthly quota reached; deferred until next month reset']
    );
  });

  test('hands an expected OMDb miss to the generic fallback before consuming all attempts', async () => {
    const item = {
      queue_id: 5,
      media_item_id: 79,
      attempts: 0,
      max_attempts: 3,
      title: 'No match',
    };
    const handleOmdbFallback = jest.fn().mockResolvedValue(true);
    const deps = createProcessingDeps({
      db: createDb((sql) => (
        String(sql).includes('JOIN media_server_items')
          ? { rows: [item], rowCount: 1 }
          : { rows: [], rowCount: 1 }
      )),
      enrichWithOmdb: jest.fn().mockResolvedValue({
        success: false,
        error: 'OMDb not found',
      }),
      handleOmdbFallback,
    });

    const result = await processRetryQueue(deps, 50, 'omdb');

    expect(result).toEqual(expect.objectContaining({ processed: 1, failed: 0 }));
    expect(handleOmdbFallback).toHaveBeenCalledWith(item, 'OMDb not found', {
      exhausted: false,
    });
  });

  test('fails an item if enrichment unexpectedly throws', async () => {
    const item = {
      queue_id: 6,
      media_item_id: 80,
      attempts: 2,
      max_attempts: 3,
      title: 'Failure',
    };
    const deps = createProcessingDeps({
      db: createDb((sql) => (
        String(sql).includes('JOIN media_server_items')
          ? { rows: [item], rowCount: 1 }
          : { rows: [], rowCount: 1 }
      )),
      enrichWithOmdb: jest.fn().mockRejectedValue(new Error('unexpected failure')),
    });

    await expect(processRetryQueue(deps, 50, 'omdb')).resolves.toEqual(
      expect.objectContaining({ processed: 1, success: 0, failed: 1 })
    );
    expect(deps.db.query).toHaveBeenCalledWith(
      expect.stringContaining("CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END"),
      [6, 'unexpected failure']
    );
  });
});

describe('legacy IMDb extraction compatibility', () => {
  test('accepts historical Tavily result arrays while labeling their source accurately', () => {
    expect(extractImdbData([{
      url: 'https://www.imdb.com/title/tt0133093/',
      content: 'The Matrix is Action, Sci-Fi, Thriller and rated 8.7/10.',
    }])).toEqual(expect.objectContaining({
      imdb_id: 'tt0133093',
      source: 'tavily',
      rating: 8.7,
      genres: expect.arrayContaining(['Action', 'Thriller']),
    }));
  });
});
