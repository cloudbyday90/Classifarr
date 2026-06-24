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
import { EnrichmentRetryService } from '../services/enrichmentRetryService.mjs';
import {
  WEB_SEARCH_PROVIDER_ERROR_CODES,
  WebSearchProviderError,
} from '../services/webSearchProviderErrorTaxonomy.mjs';

function createDb() {
  return { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
}

function createLogger() {
  return {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

function createWebSearchService(overrides = {}) {
  return {
    hasAvailableProvider: jest.fn().mockResolvedValue(true),
    search: jest.fn(),
    ...overrides,
  };
}

function createService(deps = {}) {
  return new EnrichmentRetryService({
    db: deps.db || createDb(),
    logger: deps.logger || createLogger(),
    omdbService: deps.omdbService || {
      getByIMDBId: jest.fn(),
      getByTitle: jest.fn(),
      hasRemainingQuota: jest.fn().mockResolvedValue({ available: true, used: 0, limit: 1000 }),
    },
    webSearchEnrichmentService: deps.webSearchEnrichmentService || createWebSearchService(),
    enrichmentItemStateService: deps.enrichmentItemStateService || {
      syncItemState: jest.fn().mockResolvedValue(),
      syncItemStates: jest.fn().mockResolvedValue(),
    },
  });
}

function configureRetryDb(db, { pendingRows = [] } = {}) {
  db.query.mockImplementation(async (sql) => {
    const text = String(sql);
    if (text.includes('FROM enrichment_retry_queue erq') && text.includes('JOIN media_server_items')) {
      return { rows: pendingRows, rowCount: pendingRows.length };
    }
    if (text.includes('SELECT') && text.includes('COUNT(*) as count')) {
      return { rows: [] };
    }
    return { rows: [], rowCount: 1 };
  });
}

describe('EnrichmentRetryService', () => {
  test('queues new retry work with the provider-neutral type by default', async () => {
    const db = createDb();
    const service = createService({ db });

    await service.queueForRetry(123, undefined, 'OMDb not found', 5);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO enrichment_retry_queue'),
      [123, 'web_search', 'OMDb not found', 5, 'tavily_monthly_quota_deferred']
    );
  });

  test('returns separate current and historical retry counters', async () => {
    const db = createDb();
    const service = createService({ db });
    jest.spyOn(service, 'normalizeTavilyMonthlyDeferredRows').mockResolvedValue(0);
    jest.spyOn(service, 'resolveRetriesWithExistingMetadata').mockResolvedValue(0);
    jest.spyOn(service, 'failExhaustedPendingRetries').mockResolvedValue(0);
    jest.spyOn(service, 'countTavilyMonthlyDeferredRows').mockResolvedValue(1);
    db.query.mockResolvedValue({
      rows: [
        { enrichment_type: 'web_search', status: 'pending', count: '3' },
        { enrichment_type: 'tavily', status: 'pending', count: '2' },
        { enrichment_type: 'omdb', status: 'completed', count: '4' },
      ],
    });

    const stats = await service.getStats();

    expect(stats.web_search).toEqual(expect.objectContaining({ pending: 3, actionablePending: 3 }));
    expect(stats.tavily).toEqual(expect.objectContaining({ pending: 2, deferred: 1, actionablePending: 1 }));
    expect(stats.total).toEqual(expect.objectContaining({ pending: 5, deferred: 1, actionablePending: 4 }));
  });

  test('processes provider-neutral retry work through the router-backed service', async () => {
    const db = createDb();
    const webSearchEnrichmentService = createWebSearchService({
      search: jest.fn().mockResolvedValue({
        response: {
          provider: 'brave',
          providerRequestId: 'brave-request',
          results: [{
            url: 'https://www.imdb.com/title/tt0133093/',
            snippet: 'The Matrix is an Action Sci-Fi movie with a rating of 8.7/10.',
          }],
        },
      }),
    });
    const state = { syncItemState: jest.fn().mockResolvedValue(), syncItemStates: jest.fn().mockResolvedValue() };
    configureRetryDb(db, {
      pendingRows: [{
        queue_id: 7,
        media_item_id: 101,
        attempts: 0,
        max_attempts: 3,
        title: 'The Matrix',
        year: 1999,
        imdb_id: 'tt0133093',
        media_type: 'movie',
      }],
    });
    const service = createService({ db, webSearchEnrichmentService, enrichmentItemStateService: state });

    const result = await service.processRetryQueue(50, 'web_search');

    expect(result).toEqual(expect.objectContaining({ processed: 1, success: 1, failed: 0 }));
    expect(webSearchEnrichmentService.search).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'metadata_enrichment',
        query: 'IMDb tt0133093',
      }),
      expect.any(Object)
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("'{web_search_imdb}'"),
      [101, expect.stringContaining('"source":"brave"')]
    );
    expect(state.syncItemState).toHaveBeenCalledWith(101);
  });

  test('routes a historical Tavily retry through the same provider router and retains monthly deferral semantics', async () => {
    const db = createDb();
    const quotaError = new WebSearchProviderError({
      safeMessage: 'Monthly quota exhausted',
      errorCode: WEB_SEARCH_PROVIDER_ERROR_CODES.QUOTA_EXHAUSTED,
      provider: 'tavily',
      operation: 'search',
      httpStatus: 432,
      retryable: false,
      cooldownEligible: true,
      retryAfterSeconds: null,
      causeCode: null,
    });
    const webSearchEnrichmentService = createWebSearchService({
      search: jest.fn().mockRejectedValue(quotaError),
    });
    configureRetryDb(db, {
      pendingRows: [{
        queue_id: 8,
        media_item_id: 102,
        attempts: 1,
        max_attempts: 3,
        title: 'Legacy Item',
        year: 1998,
        media_type: 'movie',
      }],
    });
    const service = createService({ db, webSearchEnrichmentService });

    const result = await service.processRetryQueue(50, 'tavily');

    expect(result).toEqual(expect.objectContaining({ processed: 1, success: 0, failed: 0 }));
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'pending'"),
      [8, 'tavily_monthly_quota_deferred', 'Tavily monthly quota reached; deferred until next month reset']
    );
  });

  test('skips web-search retry work when no provider route is currently available', async () => {
    const db = createDb();
    const webSearchEnrichmentService = createWebSearchService({
      hasAvailableProvider: jest.fn().mockResolvedValue(false),
    });
    const service = createService({ db, webSearchEnrichmentService });

    await expect(service.processRetryQueue(50, 'web_search')).resolves.toEqual({
      processed: 0,
      success: 0,
      failed: 0,
      autoFailed: 0,
      skipped: true,
      reason: 'No web search provider is available',
    });
  });

  test('moves an OMDb miss into the provider-neutral fallback queue', async () => {
    const db = createDb();
    const service = createService({ db });
    jest.spyOn(service, 'queueForRetry').mockResolvedValue();
    db.query.mockResolvedValueOnce({
      rows: [{ id: 19, status: 'pending', reason: 'OMDb not found' }],
      rowCount: 1,
    }).mockResolvedValue({ rows: [], rowCount: 1 });

    const moved = await service.handleOmdbFallback({
      queue_id: 9,
      media_item_id: 103,
      title: 'No Match',
    }, 'OMDb not found');

    expect(moved).toBe(true);
    expect(service.queueForRetry).toHaveBeenCalledWith(103, 'web_search', 'OMDb not found', 5);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("enrichment_type = 'web_search'"),
      [103]
    );
  });

  test('automatically processes both new and historical web-search queue entries', async () => {
    const service = createService();
    jest.spyOn(service, 'recoverStaleProcessingRetries').mockResolvedValue(0);
    jest.spyOn(service, 'getStats')
      .mockResolvedValueOnce({
        omdb: { pending: 0 },
        web_search: { pending: 2 },
        tavily: { pending: 1 },
      });
    jest.spyOn(service, 'processRetryQueue').mockResolvedValue({ processed: 1, success: 1, failed: 0 });

    await service.triggerProcessing();

    expect(service.processRetryQueue).toHaveBeenCalledWith(50, 'web_search');
    expect(service.processRetryQueue).toHaveBeenCalledWith(50, 'tavily');
  });
});
