/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  WebSearchProviderStorage,
  normalizeWebSearchProviderConfigRow,
  normalizeWebSearchProviderUsageSummaryRow,
  normalizeWebSearchProviderUsageRow,
  projectLegacyTavilyConfig,
} from '../../services/webSearchProviderStorage.mjs';
import { WEB_SEARCH_PROVIDER_ERROR_CODES, WebSearchProviderError } from '../../services/webSearchProviderErrorTaxonomy.mjs';

function createMockDb(rowsByCall = []) {
  const calls = [];
  return {
    calls,
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      const next = rowsByCall.shift();
      return { rows: Array.isArray(next) ? next : [] };
    },
  };
}

function createAsyncSpy(returnValue = null) {
  const spy = async (...args) => {
    spy.calls.push(args);
    return returnValue;
  };
  spy.calls = [];
  return spy;
}

function createConfigRow(overrides = {}) {
  return {
    id: 1,
    provider_key: 'tavily',
    display_name: 'Tavily',
    is_enabled: true,
    priority: 10,
    api_key: 'secret-key',
    config: { searchDepth: 'advanced', maxResults: 5 },
    soft_daily_limit: 100,
    soft_monthly_limit: 1000,
    cooldown_until: null,
    last_success_at: null,
    last_error_at: null,
    last_error_code: null,
    last_error_message: null,
    last_error_http_status: null,
    legacy_source: null,
    created_at: '2026-06-14T00:00:00.000Z',
    updated_at: '2026-06-14T00:00:00.000Z',
    ...overrides,
  };
}

function createUsageRow(overrides = {}) {
  return {
    id: 10,
    provider_key: 'tavily',
    purpose: 'classification',
    operation: 'search',
    status: 'success',
    cost_units: 1,
    result_count: 2,
    duration_ms: 125,
    searched_at: '2026-06-14T00:01:00.000Z',
    correlation_id: null,
    classification_id: 13300,
    error_code: null,
    http_status: null,
    retryable: false,
    cooldown_eligible: false,
    retry_after_seconds: null,
    metadata: { route: 'test' },
    ...overrides,
  };
}

describe('webSearchProviderStorage', () => {
  test('normalizes and masks provider config rows for read models', () => {
    expect(normalizeWebSearchProviderConfigRow(createConfigRow())).toEqual(expect.objectContaining({
      providerKey: 'tavily',
      displayName: 'Tavily',
      isEnabled: true,
      priority: 10,
      apiKey: '••••••••-key',
      configured: true,
      softDailyLimit: 100,
      softMonthlyLimit: 1000,
      config: { searchDepth: 'advanced', maxResults: 5 },
    }));
  });

  test('can expose unmasked provider config internally when requested', () => {
    expect(normalizeWebSearchProviderConfigRow(createConfigRow(), { maskSecrets: false }).apiKey).toBe('secret-key');
  });

  test('projects legacy Tavily config into provider-neutral shape', () => {
    const projected = projectLegacyTavilyConfig({
      id: 4,
      api_key: 'legacy-key',
      is_active: true,
      search_depth: 'advanced',
      max_results: 3,
      include_domains: ['imdb.com'],
      exclude_domains: ['spam.example'],
      updated_at: '2026-06-14T00:00:00.000Z',
    });

    expect(projected).toEqual(expect.objectContaining({
      providerKey: 'tavily',
      displayName: 'Tavily',
      legacySource: 'tavily_config',
      apiKey: '••••••••-key',
      config: {
        searchDepth: 'advanced',
        maxResults: 3,
        includeDomains: ['imdb.com'],
        excludeDomains: ['spam.example'],
      },
    }));
  });

  test('lists generic provider configs and adds legacy Tavily only when missing', async () => {
    const db = createMockDb([
      [createConfigRow({ provider_key: 'brave', display_name: 'Brave Search', priority: 20, api_key: null })],
      [{
        api_key: 'legacy-key',
        is_active: true,
        search_depth: 'basic',
        max_results: 5,
        include_domains: ['imdb.com'],
        exclude_domains: [],
      }],
    ]);
    const storage = new WebSearchProviderStorage({ db });

    const configs = await storage.listProviderConfigs();

    expect(configs.map((config) => config.providerKey)).toEqual(['tavily', 'brave']);
    expect(configs[0].legacySource).toBe('tavily_config');
  });

  test('does not add legacy Tavily projection when generic Tavily exists', async () => {
    const db = createMockDb([[createConfigRow()]]);
    const storage = new WebSearchProviderStorage({ db });

    const configs = await storage.listProviderConfigs();

    expect(configs).toHaveLength(1);
    expect(db.calls).toHaveLength(1);
  });

  test('gets provider config with Tavily legacy bridge fallback', async () => {
    const db = createMockDb([
      [],
      [{ api_key: 'legacy-key', is_active: true, max_results: 5 }],
    ]);
    const storage = new WebSearchProviderStorage({ db });

    const config = await storage.getProviderConfig('tavily');

    expect(config.providerKey).toBe('tavily');
    expect(config.legacySource).toBe('tavily_config');
  });

  test('upserts provider config using bounded provider keys and JSON config', async () => {
    const db = createMockDb([[createConfigRow({
      provider_key: 'brave',
      display_name: 'Brave Search',
      priority: 20,
      api_key: 'brave-secret',
      config: { safeSearch: true },
    })]]);
    const storage = new WebSearchProviderStorage({ db });

    const config = await storage.upsertProviderConfig({
      providerKey: 'brave',
      isEnabled: true,
      apiKey: 'brave-secret',
      config: { safeSearch: true },
    });

    expect(config).toEqual(expect.objectContaining({
      providerKey: 'brave',
      displayName: 'Brave Search',
      apiKey: '••••••••cret',
      config: { safeSearch: true },
    }));
    expect(db.calls[0].params[0]).toBe('brave');
    expect(db.calls[0].params[5]).toBe(JSON.stringify({ safeSearch: true }));
    expect(db.calls[0].params[9]).toBe(false);
  });

  test('can intentionally clear a stored provider API key', async () => {
    const db = createMockDb([[createConfigRow({
      provider_key: 'tavily',
      api_key: null,
    })]]);
    const storage = new WebSearchProviderStorage({ db });

    const config = await storage.upsertProviderConfig({
      providerKey: 'tavily',
      isEnabled: false,
      clearApiKey: true,
    });

    expect(config.configured).toBe(false);
    expect(db.calls[0].params[4]).toBeNull();
    expect(db.calls[0].params[9]).toBe(true);
    expect(db.calls[0].sql).toContain('WHEN $10::boolean THEN NULL');
  });

  test('rejects invalid provider keys before SQL execution', async () => {
    const db = createMockDb();
    const storage = new WebSearchProviderStorage({ db });

    await expect(storage.getProviderConfig('bad provider!')).rejects.toThrow('Invalid web search provider key');
    expect(db.calls).toHaveLength(0);
  });

  test('normalizes usage rows into route-ready shape', () => {
    expect(normalizeWebSearchProviderUsageRow(createUsageRow())).toEqual(expect.objectContaining({
      providerKey: 'tavily',
      purpose: 'classification',
      status: 'success',
      costUnits: 1,
      resultCount: 2,
      durationMs: 125,
      classificationId: 13300,
      metadata: { route: 'test' },
    }));
  });

  test('records successful usage with normalized defaults', async () => {
    const db = createMockDb([[createUsageRow()]]);
    const storage = new WebSearchProviderStorage({ db });

    const usage = await storage.recordUsage({
      providerKey: 'tavily',
      resultCount: 2,
      classificationId: 13300,
      metadata: { route: 'test' },
    });

    expect(usage.status).toBe('success');
    expect(db.calls[0].params).toEqual([
      'tavily',
      'classification',
      'search',
      'success',
      1,
      2,
      null,
      null,
      13300,
      null,
      null,
      false,
      false,
      null,
      JSON.stringify({ route: 'test' }),
    ]);
  });

  test('normalizes provider usage summaries for quota routing', () => {
    expect(normalizeWebSearchProviderUsageSummaryRow({
      provider_key: 'tavily',
      daily_cost_units: '4',
      monthly_cost_units: '20',
      daily_request_count: '5',
      monthly_request_count: '25',
      daily_cache_hits: '1',
      monthly_cache_hits: '3',
    })).toEqual({
      providerKey: 'tavily',
      dailyCostUnits: 4,
      monthlyCostUnits: 20,
      dailyRequestCount: 5,
      monthlyRequestCount: 25,
      dailyCacheHits: 1,
      monthlyCacheHits: 3,
    });
  });

  test('aggregates provider usage summaries for configured provider keys', async () => {
    const db = createMockDb([[
      {
        provider_key: 'tavily',
        daily_cost_units: 2,
        monthly_cost_units: 8,
        daily_request_count: 3,
        monthly_request_count: 9,
        daily_cache_hits: 1,
        monthly_cache_hits: 4,
      },
    ]]);
    const storage = new WebSearchProviderStorage({ db });

    const summaries = await storage.getProviderUsageSummaries(['tavily', 'tavily'], {
      now: new Date('2026-06-18T12:00:00.000Z'),
    });

    expect(summaries.get('tavily')).toEqual(expect.objectContaining({
      dailyCostUnits: 2,
      monthlyCostUnits: 8,
      dailyCacheHits: 1,
    }));
    expect(db.calls[0].sql).toContain("operation = 'cache_hit'");
    expect(db.calls[0].params[0]).toEqual(['tavily']);
  });

  test('records taxonomy errors as storage-ready usage fields', async () => {
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
    const db = createMockDb([[createUsageRow({
      status: 'rate_limited',
      error_code: 'rate_limited',
      http_status: 429,
      retryable: true,
      cooldown_eligible: true,
      retry_after_seconds: 60,
    })]]);
    const storage = new WebSearchProviderStorage({ db });

    const usage = await storage.recordUsage({ providerKey: 'tavily', error });

    expect(usage).toEqual(expect.objectContaining({
      status: 'rate_limited',
      errorCode: 'rate_limited',
      httpStatus: 429,
      retryable: true,
      cooldownEligible: true,
      retryAfterSeconds: 60,
    }));
  });

  test('updates provider success state after successful usage', async () => {
    const db = createMockDb([[createConfigRow({ last_success_at: '2026-06-14T00:02:00.000Z' })]]);
    const healthHistory = { recordUsageEventSafely: createAsyncSpy() };
    const storage = new WebSearchProviderStorage({ db, healthHistory });

    const config = await storage.updateProviderAfterUsage('tavily', { status: 'success' });

    expect(config.providerKey).toBe('tavily');
    expect(db.calls[0].sql).toContain('last_success_at = NOW()');
    expect(healthHistory.recordUsageEventSafely.calls).toEqual([['tavily', { status: 'success' }, config]]);
  });

  test('does not fail provider state updates when health history recording fails', async () => {
    const db = createMockDb([[createConfigRow({ last_success_at: '2026-06-14T00:02:00.000Z' })]]);
    const healthHistory = {
      recordUsageEventSafely: async () => {
        throw new Error('history unavailable');
      },
    };
    const storage = new WebSearchProviderStorage({ db, healthHistory });

    await expect(storage.updateProviderAfterUsage('tavily', { status: 'success' }))
      .resolves.toEqual(expect.objectContaining({ providerKey: 'tavily' }));
  });

  test('updates provider error state and cooldown after taxonomy error', async () => {
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
    const db = createMockDb([[createConfigRow({
      last_error_code: 'rate_limited',
      last_error_http_status: 429,
    })]]);
    const healthHistory = { recordUsageEventSafely: createAsyncSpy() };
    const storage = new WebSearchProviderStorage({ db, healthHistory });

    await storage.updateProviderAfterUsage('tavily', { error });

    expect(db.calls[0].params).toEqual([
      'tavily',
      'rate_limited',
      'Too many requests',
      429,
      60,
    ]);
    expect(healthHistory.recordUsageEventSafely.calls).toEqual([['tavily', { error }, expect.objectContaining({
      providerKey: 'tavily',
      lastErrorCode: 'rate_limited',
    })]]);
  });
});
