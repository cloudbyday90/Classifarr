/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  MAX_WEB_SEARCH_PROVIDER_CACHE_TTL_MS,
  buildWebSearchProviderCacheIdentity,
  normalizeWebSearchProviderCacheConfig,
  normalizeWebSearchProviderCacheQuery,
  normalizeWebSearchProviderCacheTtlMs,
  stableStringify,
} from '../../services/webSearchProviderCachePolicy.mjs';

function createRequest(overrides = {}) {
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
      domains: ['imdb.com'],
    },
    traceContext: {
      correlationId: 'trace-1',
      classificationId: 3574,
    },
    ...overrides,
  };
}

describe('webSearchProviderCachePolicy', () => {
  test('normalizes equivalent query whitespace and case for cache identity', () => {
    expect(normalizeWebSearchProviderCacheQuery('  Mulan   1998  ')).toBe('mulan 1998');

    const first = buildWebSearchProviderCacheIdentity({
      providerKey: 'tavily',
      request: createRequest({ query: 'Mulan 1998 family animation reviews' }),
      config: { searchDepth: 'basic' },
    });
    const second = buildWebSearchProviderCacheIdentity({
      providerKey: 'tavily',
      request: createRequest({ query: '  MULAN  1998 family animation reviews  ' }),
      config: { searchDepth: 'basic' },
    });

    expect(second.cacheKey).toBe(first.cacheKey);
    expect(second.queryHash).toBe(first.queryHash);
  });

  test('excludes secrets and transport-only fields from cache config identity', () => {
    const first = buildWebSearchProviderCacheIdentity({
      providerKey: 'tavily',
      request: createRequest(),
      config: {
        apiKey: 'secret-a',
        projectId: 'project-a',
        timeout: 30000,
        config: { searchDepth: 'basic' },
      },
    });
    const second = buildWebSearchProviderCacheIdentity({
      providerKey: 'tavily',
      request: createRequest(),
      config: {
        apiKey: 'secret-b',
        projectId: 'project-b',
        timeout: 1000,
        config: { searchDepth: 'basic' },
      },
    });

    expect(second.cacheKey).toBe(first.cacheKey);
    expect(normalizeWebSearchProviderCacheConfig({ apiKey: 'secret', config: { maxResults: 5 } }))
      .toEqual({ config: { maxResults: 5 } });
  });

  test('keeps behavior-changing request and config values in cache identity', () => {
    const first = buildWebSearchProviderCacheIdentity({
      providerKey: 'tavily',
      request: createRequest(),
      config: { config: { searchDepth: 'basic' } },
    });
    const second = buildWebSearchProviderCacheIdentity({
      providerKey: 'tavily',
      request: createRequest({
        options: {
          maxResults: 5,
          includeAnswer: true,
          safeSearch: true,
          domains: ['rottentomatoes.com'],
        },
      }),
      config: { config: { searchDepth: 'basic' } },
    });
    const third = buildWebSearchProviderCacheIdentity({
      providerKey: 'tavily',
      request: createRequest(),
      config: { config: { searchDepth: 'advanced' } },
    });

    expect(second.cacheKey).not.toBe(first.cacheKey);
    expect(third.cacheKey).not.toBe(first.cacheKey);
  });

  test('uses deterministic stable stringification for nested objects', () => {
    expect(stableStringify({
      b: 2,
      a: { d: 4, c: 3 },
      apiKey: 'secret',
    })).toBe('{"a":{"c":3,"d":4},"b":2}');
  });

  test('bounds cache TTL to prevent accidental long-lived provider results', () => {
    expect(normalizeWebSearchProviderCacheTtlMs(0)).toBe(0);
    expect(normalizeWebSearchProviderCacheTtlMs(MAX_WEB_SEARCH_PROVIDER_CACHE_TTL_MS * 2))
      .toBe(MAX_WEB_SEARCH_PROVIDER_CACHE_TTL_MS);
    expect(normalizeWebSearchProviderCacheTtlMs('bad', { fallback: 1000 })).toBe(1000);
  });

  test('rejects unknown provider keys before producing shared cache keys', () => {
    expect(() => buildWebSearchProviderCacheIdentity({
      providerKey: 'not a provider',
      request: createRequest(),
    })).toThrow('Invalid web search provider cache key provider');
  });
});
