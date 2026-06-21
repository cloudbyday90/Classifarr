/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  WebSearchProviderRouter,
  WebSearchProviderRoutingError,
} from '../../services/webSearchProviderRouter.mjs';
import { webSearchProviderRegistry } from '../../services/webSearchProviderRegistry.mjs';

function createConfig(overrides = {}) {
  return {
    providerKey: 'tavily',
    displayName: 'Tavily',
    isEnabled: true,
    configured: true,
    priority: 10,
    apiKey: 'secret',
    config: { searchDepth: 'basic' },
    softDailyLimit: null,
    softMonthlyLimit: null,
    cooldownUntil: null,
    ...overrides,
  };
}

function createAdapter(providerKey = 'tavily') {
  return {
    contractVersion: 1,
    providerKey,
    displayName: providerKey,
    capabilities: {
      generalSearch: true,
      answerSummary: true,
      siteSearch: true,
      safeSearch: true,
    },
    testConnection: jest.fn(),
    search: jest.fn(),
  };
}

function createStorage(configs, summaries = new Map()) {
  return {
    listProviderConfigs: jest.fn(async () => configs),
    getProviderUsageSummaries: jest.fn(async () => summaries),
  };
}

function createRegistry(adapters = {}) {
  return {
    getAdapter: jest.fn((providerKey) => adapters[providerKey] || null),
  };
}

function createRequest() {
  return {
    purpose: 'classification',
    query: 'Mulan 1998 reviews',
    media: { title: 'Mulan', year: 1998, mediaType: 'movie' },
    options: { maxResults: 5, includeAnswer: true, safeSearch: true, domains: [] },
    traceContext: { correlationId: 'trace-1' },
  };
}

describe('webSearchProviderRouter', () => {
  test('selects the first available adapter-backed provider by priority', async () => {
    const brave = createConfig({ providerKey: 'brave', displayName: 'Brave', priority: 5 });
    const tavily = createConfig({ providerKey: 'tavily', displayName: 'Tavily', priority: 10 });
    const braveAdapter = createAdapter('brave');
    const router = new WebSearchProviderRouter({
      storage: createStorage([tavily, brave]),
      registry: createRegistry({ brave: braveAdapter, tavily: createAdapter('tavily') }),
      nowFn: () => new Date('2026-06-18T12:00:00.000Z'),
    });

    const route = await router.selectRoute();

    expect(route.selected.providerKey).toBe('brave');
    expect(route.selected.adapter).toBe(braveAdapter);
    expect(route.candidates.map((candidate) => candidate.providerKey)).toEqual(['brave', 'tavily']);
  });

  test('selects the activated Brave adapter from the production registry', async () => {
    const router = new WebSearchProviderRouter({
      storage: createStorage([
        createConfig({ providerKey: 'brave', displayName: 'Brave Search', priority: 5 }),
      ]),
      registry: webSearchProviderRegistry,
    });

    const route = await router.selectRoute();

    expect(route.selected.providerKey).toBe('brave');
    expect(route.selected.adapter).toBe(webSearchProviderRegistry.getAdapter('brave'));
    expect(route.selected.adapter.providerKey).toBe('brave');
  });

  test('skips unavailable providers and selects the next eligible provider', async () => {
    const summaries = new Map([
      ['brave', { dailyCostUnits: 10, monthlyCostUnits: 10 }],
      ['tavily', { dailyCostUnits: 1, monthlyCostUnits: 1 }],
    ]);
    const router = new WebSearchProviderRouter({
      storage: createStorage([
        createConfig({ providerKey: 'brave', displayName: 'Brave', priority: 5, softDailyLimit: 10 }),
        createConfig({ providerKey: 'serper', displayName: 'Serper', priority: 7 }),
        createConfig({ providerKey: 'tavily', displayName: 'Tavily', priority: 10 }),
      ], summaries),
      registry: createRegistry({ brave: createAdapter('brave'), tavily: createAdapter('tavily') }),
      nowFn: () => new Date('2026-06-18T12:00:00.000Z'),
    });

    const route = await router.selectRoute();

    expect(route.selected.providerKey).toBe('tavily');
    expect(route.candidates.find((candidate) => candidate.providerKey === 'brave').skipReason)
      .toBe('daily_quota_exhausted');
    expect(route.candidates.find((candidate) => candidate.providerKey === 'serper').skipReason)
      .toBe('adapter_unavailable');
  });

  test('delegates selected provider to cache-aware executor', async () => {
    const tavily = createConfig({ providerKey: 'tavily' });
    const tavilyAdapter = createAdapter('tavily');
    const executor = {
      search: jest.fn(async () => ({
        response: { provider: 'tavily', results: [] },
        cache: { hit: false },
      })),
    };
    const router = new WebSearchProviderRouter({
      storage: createStorage([tavily]),
      registry: createRegistry({ tavily: tavilyAdapter }),
      executor,
    });

    const result = await router.search(createRequest(), {
      cacheTtlMs: 1000,
      cacheMetadata: { route: 'test' },
    });

    expect(result.route.selected.providerKey).toBe('tavily');
    expect(executor.search).toHaveBeenCalledWith(expect.objectContaining({
      provider: tavilyAdapter,
      config: tavily,
      cacheTtlMs: 1000,
      cacheMetadata: expect.objectContaining({
        route: 'test',
        routedProvider: 'tavily',
      }),
    }));
  });

  test('throws a structured routing error when no provider is available', async () => {
    const router = new WebSearchProviderRouter({
      storage: createStorage([
        createConfig({ providerKey: 'tavily', configured: false, apiKey: null }),
      ]),
      registry: createRegistry({ tavily: createAdapter('tavily') }),
    });

    await expect(router.selectRoute()).rejects.toThrow(WebSearchProviderRoutingError);
    await expect(router.selectRoute()).rejects.toMatchObject({
      code: 'WEB_SEARCH_PROVIDER_ROUTE_UNAVAILABLE',
      candidates: [expect.objectContaining({
        providerKey: 'tavily',
        skipReason: 'unconfigured',
      })],
    });
  });
});
