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
import {
  WEB_SEARCH_PROVIDER_ERROR_CODES,
  WebSearchProviderError,
} from '../../services/webSearchProviderErrorTaxonomy.mjs';
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

function createRouteHistory() {
  return {
    recordDecisionSafely: jest.fn(async () => ({
      id: 1,
      routeId: '29994c13-e52d-4813-8051-0960ed27d495',
    })),
  };
}

function createQualityCalibrationService(calibrations = new Map()) {
  return {
    getProviderQualityCalibrations: jest.fn(async () => calibrations),
  };
}

const neutralQualityCalibrationService = createQualityCalibrationService();

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
      qualityCalibrationService: neutralQualityCalibrationService,
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
      qualityCalibrationService: neutralQualityCalibrationService,
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
      qualityCalibrationService: neutralQualityCalibrationService,
      nowFn: () => new Date('2026-06-18T12:00:00.000Z'),
    });

    const route = await router.selectRoute();

    expect(route.selected.providerKey).toBe('tavily');
    expect(route.candidates.find((candidate) => candidate.providerKey === 'brave').skipReason)
      .toBe('daily_quota_exhausted');
    expect(route.candidates.find((candidate) => candidate.providerKey === 'serper').skipReason)
      .toBe('adapter_unavailable');
  });

  test('uses purpose-aware quality calibration to order eligible providers', async () => {
    const qualityCalibrationService = createQualityCalibrationService(new Map([
      ['brave', { calibration: { score: 50, priorityPenalty: 20, sampleCount: 10, status: 'calibrated' } }],
      ['tavily', { calibration: { score: 100, priorityPenalty: 0, sampleCount: 10, status: 'healthy' } }],
    ]));
    const executor = {
      search: jest.fn(async () => ({
        response: { provider: 'tavily', results: [] },
        cache: { hit: false },
      })),
    };
    const router = new WebSearchProviderRouter({
      storage: createStorage([
        createConfig({ providerKey: 'brave', displayName: 'Brave', priority: 5 }),
        createConfig({ providerKey: 'tavily', displayName: 'Tavily', priority: 10 }),
      ]),
      registry: createRegistry({ brave: createAdapter('brave'), tavily: createAdapter('tavily') }),
      executor,
      routeHistory: createRouteHistory(),
      qualityCalibrationService,
      nowFn: () => new Date('2026-06-18T12:00:00.000Z'),
    });

    const result = await router.search(createRequest());

    expect(result.route.selected.providerKey).toBe('tavily');
    expect(result.route.candidates.map((candidate) => candidate.providerKey)).toEqual(['tavily', 'brave']);
    expect(result.route.candidates.find((candidate) => candidate.providerKey === 'brave')).toEqual(expect.objectContaining({
      effectivePriority: 25,
      qualityCalibration: expect.objectContaining({ priorityPenalty: 20 }),
    }));
    expect(qualityCalibrationService.getProviderQualityCalibrations).toHaveBeenCalledWith(
      ['brave', 'tavily'],
      expect.objectContaining({ purpose: 'classification' })
    );
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
    const routeHistory = createRouteHistory();
    const router = new WebSearchProviderRouter({
      storage: createStorage([tavily]),
      registry: createRegistry({ tavily: tavilyAdapter }),
      executor,
      routeHistory,
      qualityCalibrationService: neutralQualityCalibrationService,
    });

    const result = await router.search(createRequest(), {
      cacheTtlMs: 1000,
      cacheMetadata: { route: 'test' },
    });

    expect(result.route.selected.providerKey).toBe('tavily');
    expect(result.route.decision).toEqual(expect.objectContaining({
      routeId: '29994c13-e52d-4813-8051-0960ed27d495',
    }));
    expect(routeHistory.recordDecisionSafely).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'success',
      selectedProviderKey: 'tavily',
      finalProviderKey: 'tavily',
      attempts: [expect.objectContaining({ providerKey: 'tavily', outcome: 'success' })],
      metadata: { cacheHit: false },
    }));
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

  test('falls back to the next eligible provider after a classified provider failure', async () => {
    const brave = createConfig({ providerKey: 'brave', priority: 5 });
    const tavily = createConfig({ providerKey: 'tavily', priority: 10 });
    const executor = {
      search: jest.fn()
        .mockRejectedValueOnce(new WebSearchProviderError({
          safeMessage: 'Brave quota exhausted',
          errorCode: WEB_SEARCH_PROVIDER_ERROR_CODES.QUOTA_EXHAUSTED,
          provider: 'brave',
          operation: 'search',
          httpStatus: 429,
          retryable: false,
          cooldownEligible: true,
          retryAfterSeconds: null,
          causeCode: null,
        }))
        .mockResolvedValueOnce({
          response: { provider: 'tavily', results: [] },
          cache: { hit: false },
        }),
    };
    const routeHistory = createRouteHistory();
    const router = new WebSearchProviderRouter({
      storage: createStorage([brave, tavily]),
      registry: createRegistry({ brave: createAdapter('brave'), tavily: createAdapter('tavily') }),
      executor,
      routeHistory,
      qualityCalibrationService: neutralQualityCalibrationService,
    });

    const result = await router.search(createRequest());

    expect(result.response.provider).toBe('tavily');
    expect(result.route.selected.providerKey).toBe('tavily');
    expect(routeHistory.recordDecisionSafely).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'success',
      selectedProviderKey: 'tavily',
      finalProviderKey: 'tavily',
      attempts: [
        expect.objectContaining({ providerKey: 'brave', outcome: 'failed', errorCode: 'quota_exhausted' }),
        expect.objectContaining({ providerKey: 'tavily', outcome: 'success' }),
      ],
    }));
    expect(result.route.attempts).toEqual([
      expect.objectContaining({ providerKey: 'brave', outcome: 'failed', errorCode: 'quota_exhausted' }),
      expect.objectContaining({ providerKey: 'tavily', outcome: 'success' }),
    ]);
    expect(executor.search).toHaveBeenCalledTimes(2);
  });

  test('does not retry another provider for an invalid caller request', async () => {
    const brave = createConfig({ providerKey: 'brave', priority: 5 });
    const tavily = createConfig({ providerKey: 'tavily', priority: 10 });
    const invalidRequest = new WebSearchProviderError({
      safeMessage: 'Invalid request',
      errorCode: WEB_SEARCH_PROVIDER_ERROR_CODES.INVALID_REQUEST,
      provider: 'brave',
      operation: 'search',
      httpStatus: 400,
      retryable: false,
      cooldownEligible: false,
      retryAfterSeconds: null,
      causeCode: null,
    });
    const executor = { search: jest.fn().mockRejectedValue(invalidRequest) };
    const routeHistory = createRouteHistory();
    const router = new WebSearchProviderRouter({
      storage: createStorage([brave, tavily]),
      registry: createRegistry({ brave: createAdapter('brave'), tavily: createAdapter('tavily') }),
      executor,
      routeHistory,
      qualityCalibrationService: neutralQualityCalibrationService,
    });

    await expect(router.search(createRequest())).rejects.toBe(invalidRequest);
    expect(executor.search).toHaveBeenCalledTimes(1);
    expect(routeHistory.recordDecisionSafely).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'error',
      selectedProviderKey: 'brave',
      errorCode: 'invalid_request',
      errorHttpStatus: 400,
    }));
  });

  test('throws a structured routing error when no provider is available', async () => {
    const router = new WebSearchProviderRouter({
      storage: createStorage([
        createConfig({ providerKey: 'tavily', configured: false, apiKey: null }),
      ]),
      registry: createRegistry({ tavily: createAdapter('tavily') }),
      qualityCalibrationService: neutralQualityCalibrationService,
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

  test('records no-provider decisions before throwing route unavailable', async () => {
    const routeHistory = createRouteHistory();
    const router = new WebSearchProviderRouter({
      storage: createStorage([
        createConfig({ providerKey: 'tavily', configured: false, apiKey: null }),
      ]),
      registry: createRegistry({ tavily: createAdapter('tavily') }),
      routeHistory,
      qualityCalibrationService: neutralQualityCalibrationService,
    });

    await expect(router.search(createRequest())).rejects.toThrow(WebSearchProviderRoutingError);
    expect(routeHistory.recordDecisionSafely).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'no_provider',
      errorCode: 'no_available_provider',
      attempts: [],
    }));
  });
});
