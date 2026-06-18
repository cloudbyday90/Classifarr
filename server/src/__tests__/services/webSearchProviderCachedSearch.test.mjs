/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import { WebSearchProviderCachedSearchExecutor } from '../../services/webSearchProviderCachedSearch.mjs';
import { WebSearchProviderError, WEB_SEARCH_PROVIDER_ERROR_CODES } from '../../services/webSearchProviderErrorTaxonomy.mjs';

function createResponse(overrides = {}) {
  return {
    provider: 'tavily',
    providerRequestId: 'req-1',
    query: 'Mulan 1998',
    answer: 'Mulan is a 1998 animated family adventure film.',
    results: [
      {
        title: 'Mulan',
        url: 'https://example.com/mulan',
        snippet: 'Animated family film.',
        rank: 1,
        score: 0.92,
        publishedAt: null,
        sourceDomain: 'example.com',
        providerMetadata: {},
      },
    ],
    usage: {
      costUnits: 1,
      quotaBucket: null,
    },
    warnings: [],
    ...overrides,
  };
}

function createProvider(searchImpl = jest.fn(async () => createResponse())) {
  return {
    contractVersion: 1,
    providerKey: 'tavily',
    displayName: 'Tavily',
    capabilities: {
      generalSearch: true,
      answerSummary: true,
      siteSearch: true,
      safeSearch: false,
    },
    testConnection: jest.fn(),
    search: searchImpl,
  };
}

function createRequest() {
  return {
    purpose: 'classification',
    query: 'Mulan 1998 family animation reviews',
    media: {
      title: 'Mulan',
      year: 1998,
      mediaType: 'movie',
      tmdbId: 10674,
    },
    options: {
      maxResults: 5,
      includeAnswer: true,
      safeSearch: true,
      domains: [],
    },
    traceContext: {
      correlationId: 'trace-1',
      classificationId: 3574,
    },
  };
}

function createDependencies({ cached = null } = {}) {
  const usageStorage = {
    recordUsage: jest.fn(async (input) => ({ ...input, id: 1 })),
    updateProviderAfterUsage: jest.fn(async () => null),
  };
  const cacheStore = {
    getFreshResponse: jest.fn(async () => cached),
    recordHit: jest.fn(async () => cached),
    storeResponse: jest.fn(async (input) => ({
      ...input,
      expiresAt: '2026-06-19T00:00:00.000Z',
    })),
  };

  return { usageStorage, cacheStore };
}

describe('webSearchProviderCachedSearch', () => {
  test('returns cached responses without calling the provider', async () => {
    const cachedResponse = createResponse({ providerRequestId: 'cached-req' });
    const dependencies = createDependencies({
      cached: {
        response: cachedResponse,
        expiresAt: '2026-06-19T00:00:00.000Z',
      },
    });
    const provider = createProvider();
    const executor = new WebSearchProviderCachedSearchExecutor(dependencies);

    const result = await executor.search({
      provider,
      request: createRequest(),
      cacheMetadata: { route: 'test' },
    });

    expect(result.response.providerRequestId).toBe('cached-req');
    expect(result.cache.hit).toBe(true);
    expect(provider.search).not.toHaveBeenCalled();
    expect(dependencies.cacheStore.recordHit).toHaveBeenCalledTimes(1);
    expect(dependencies.usageStorage.recordUsage).toHaveBeenCalledWith(expect.objectContaining({
      providerKey: 'tavily',
      operation: 'cache_hit',
      costUnits: 0,
      resultCount: 1,
      classificationId: 3574,
    }));
  });

  test('stores provider responses and records successful provider usage on cache miss', async () => {
    const dependencies = createDependencies();
    const provider = createProvider(jest.fn(async () => createResponse()));
    const executor = new WebSearchProviderCachedSearchExecutor({
      ...dependencies,
      nowFn: jest.fn()
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(145),
    });

    const result = await executor.search({
      provider,
      request: createRequest(),
      config: { apiKey: 'secret', config: { searchDepth: 'basic' } },
    });

    expect(result.cache.hit).toBe(false);
    expect(provider.search).toHaveBeenCalledTimes(1);
    expect(dependencies.cacheStore.storeResponse).toHaveBeenCalledWith(expect.objectContaining({
      providerKey: 'tavily',
      purpose: 'classification',
      response: createResponse(),
    }));
    expect(dependencies.usageStorage.recordUsage).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'search',
      status: 'success',
      costUnits: 1,
      durationMs: 45,
    }));
    expect(dependencies.usageStorage.updateProviderAfterUsage).toHaveBeenCalledWith('tavily', { status: 'success' });
  });

  test('bypassCache skips lookup but still stores the provider response', async () => {
    const dependencies = createDependencies();
    const provider = createProvider();
    const executor = new WebSearchProviderCachedSearchExecutor(dependencies);

    await executor.search({
      provider,
      request: createRequest(),
      bypassCache: true,
    });

    expect(dependencies.cacheStore.getFreshResponse).not.toHaveBeenCalled();
    expect(provider.search).toHaveBeenCalledTimes(1);
    expect(dependencies.cacheStore.storeResponse).toHaveBeenCalledTimes(1);
  });

  test('cacheTtlMs zero disables cache lookup and storage', async () => {
    const dependencies = createDependencies();
    const provider = createProvider();
    const executor = new WebSearchProviderCachedSearchExecutor(dependencies);

    const result = await executor.search({
      provider,
      request: createRequest(),
      cacheTtlMs: 0,
    });

    expect(result.cache.expiresAt).toBeNull();
    expect(dependencies.cacheStore.getFreshResponse).not.toHaveBeenCalled();
    expect(dependencies.cacheStore.storeResponse).not.toHaveBeenCalled();
  });

  test('records provider errors and preserves original failure', async () => {
    const error = new WebSearchProviderError({
      provider: 'tavily',
      operation: 'search',
      errorCode: WEB_SEARCH_PROVIDER_ERROR_CODES.RATE_LIMITED,
      httpStatus: 429,
      retryable: true,
      cooldownEligible: true,
      retryAfterSeconds: 60,
      causeCode: null,
      safeMessage: 'Too many requests',
    });
    const dependencies = createDependencies();
    const provider = createProvider(jest.fn(async () => {
      throw error;
    }));
    const executor = new WebSearchProviderCachedSearchExecutor(dependencies);

    await expect(executor.search({
      provider,
      request: createRequest(),
    })).rejects.toBe(error);

    expect(dependencies.usageStorage.recordUsage).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'search',
      error,
    }));
    expect(dependencies.usageStorage.updateProviderAfterUsage).toHaveBeenCalledWith('tavily', { error });
  });
});
