/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  WEB_SEARCH_PROVIDER_ROUTE_SKIP_REASONS,
  WEB_SEARCH_PROVIDER_ROUTE_STATUS,
  evaluateWebSearchProviderRouteCandidate,
  getWebSearchProviderQuotaState,
  isWebSearchProviderCooldownActive,
  sortWebSearchProviderRouteCandidates,
} from '../../services/webSearchProviderQuotaPolicy.mjs';

function createConfig(overrides = {}) {
  return {
    providerKey: 'tavily',
    displayName: 'Tavily',
    isEnabled: true,
    configured: true,
    priority: 10,
    apiKey: 'secret',
    config: { searchDepth: 'basic' },
    softDailyLimit: 10,
    softMonthlyLimit: 100,
    cooldownUntil: null,
    ...overrides,
  };
}

function createAdapter() {
  return {
    providerKey: 'tavily',
    search: async () => null,
  };
}

describe('webSearchProviderQuotaPolicy', () => {
  test('marks configured adapter-backed providers as available under quota', () => {
    const candidate = evaluateWebSearchProviderRouteCandidate({
      config: createConfig(),
      adapter: createAdapter(),
      usageSummary: {
        dailyCostUnits: 3,
        monthlyCostUnits: 20,
      },
      now: new Date('2026-06-18T12:00:00.000Z'),
    });

    expect(candidate).toEqual(expect.objectContaining({
      providerKey: 'tavily',
      status: WEB_SEARCH_PROVIDER_ROUTE_STATUS.AVAILABLE,
      skipReason: null,
    }));
    expect(candidate.quota.dailyRemaining).toBe(7);
    expect(candidate.quota.monthlyRemaining).toBe(80);
  });

  test.each([
    ['disabled provider', createConfig({ isEnabled: false }), createAdapter(), WEB_SEARCH_PROVIDER_ROUTE_SKIP_REASONS.DISABLED],
    ['unconfigured provider', createConfig({ configured: false, apiKey: null }), createAdapter(), WEB_SEARCH_PROVIDER_ROUTE_SKIP_REASONS.UNCONFIGURED],
    ['missing adapter', createConfig(), null, WEB_SEARCH_PROVIDER_ROUTE_SKIP_REASONS.ADAPTER_UNAVAILABLE],
    ['cooldown provider', createConfig({ cooldownUntil: '2026-06-18T13:00:00.000Z' }), createAdapter(), WEB_SEARCH_PROVIDER_ROUTE_SKIP_REASONS.COOLDOWN_ACTIVE],
  ])('skips %s', (name, config, adapter, skipReason) => {
    const candidate = evaluateWebSearchProviderRouteCandidate({
      config,
      adapter,
      usageSummary: {},
      now: new Date('2026-06-18T12:00:00.000Z'),
    });

    expect(candidate.status).toBe(WEB_SEARCH_PROVIDER_ROUTE_STATUS.SKIPPED);
    expect(candidate.skipReason).toBe(skipReason);
  });

  test('skips providers that have reached soft daily or monthly limits', () => {
    expect(evaluateWebSearchProviderRouteCandidate({
      config: createConfig({ softDailyLimit: 10 }),
      adapter: createAdapter(),
      usageSummary: { dailyCostUnits: 10, monthlyCostUnits: 20 },
    }).skipReason).toBe(WEB_SEARCH_PROVIDER_ROUTE_SKIP_REASONS.DAILY_QUOTA_EXHAUSTED);

    expect(evaluateWebSearchProviderRouteCandidate({
      config: createConfig({ softDailyLimit: null, softMonthlyLimit: 20 }),
      adapter: createAdapter(),
      usageSummary: { dailyCostUnits: 1, monthlyCostUnits: 20 },
    }).skipReason).toBe(WEB_SEARCH_PROVIDER_ROUTE_SKIP_REASONS.MONTHLY_QUOTA_EXHAUSTED);
  });

  test('calculates quota state with unlimited null limits', () => {
    expect(getWebSearchProviderQuotaState(
      createConfig({ softDailyLimit: null, softMonthlyLimit: null }),
      { dailyCostUnits: 50, monthlyCostUnits: 500 }
    )).toEqual(expect.objectContaining({
      dailyLimit: null,
      monthlyLimit: null,
      dailyExhausted: false,
      monthlyExhausted: false,
    }));
  });

  test('detects active cooldowns only when future dated', () => {
    const now = new Date('2026-06-18T12:00:00.000Z');
    expect(isWebSearchProviderCooldownActive(createConfig({
      cooldownUntil: '2026-06-18T12:01:00.000Z',
    }), now)).toBe(true);
    expect(isWebSearchProviderCooldownActive(createConfig({
      cooldownUntil: '2026-06-18T11:59:00.000Z',
    }), now)).toBe(false);
  });

  test('sorts route candidates by priority then provider key', () => {
    expect(sortWebSearchProviderRouteCandidates([
      { providerKey: 'serper', priority: 30 },
      { providerKey: 'brave', priority: 20 },
      { providerKey: 'tavily', priority: 20 },
    ]).map((candidate) => candidate.providerKey)).toEqual(['brave', 'tavily', 'serper']);
  });
});
