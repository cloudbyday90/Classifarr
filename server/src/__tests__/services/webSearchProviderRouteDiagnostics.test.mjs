/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildWebSearchProviderRouteDiagnostics,
  serializeWebSearchProviderRouteCandidate,
} from '../../services/webSearchProviderRouteDiagnostics.mjs';

describe('webSearchProviderRouteDiagnostics', () => {
  const availableCandidate = {
    providerKey: 'tavily',
    displayName: 'Tavily',
    priority: 10,
    effectivePriority: 13,
    status: 'available',
    skipReason: null,
    adapter: { providerKey: 'tavily' },
    config: {
      isEnabled: true,
      configured: true,
      cooldownUntil: null,
      apiKey: 'sensitive-api-key',
      config: { projectId: 'sensitive-project' },
    },
    quota: {
      dailyLimit: 100,
      monthlyLimit: 1000,
      dailyCostUnits: 4,
      monthlyCostUnits: 21,
      dailyRemaining: 96,
      monthlyRemaining: 979,
    },
    usageSummary: {
      dailyRequestCount: 4,
      monthlyRequestCount: 21,
      dailyCacheHits: 2,
      monthlyCacheHits: 8,
    },
    qualityCalibration: {
      score: 88,
      priorityPenalty: 3,
      sampleCount: 12,
      status: 'calibrated',
      successRate: 0.9,
      nonEmptyResultRate: 0.8,
      latencyScore: 1,
      outcomePositiveRate: 0.75,
      outcomeSignalCount: 8,
      outcomePenalty: 4,
      lookbackDays: 14,
      minimumSamples: 3,
    },
  };

  test('projects only safe route state for settings diagnostics', () => {
    const diagnostic = serializeWebSearchProviderRouteCandidate(availableCandidate);

    expect(diagnostic).toEqual({
      providerKey: 'tavily',
      displayName: 'Tavily',
      priority: 10,
      effectivePriority: 13,
      status: 'available',
      skipReason: null,
      isEnabled: true,
      configured: true,
      adapterAvailable: true,
      cooldownUntil: null,
      quota: {
        dailyLimit: 100,
        monthlyLimit: 1000,
        dailyCostUnits: 4,
        monthlyCostUnits: 21,
        dailyRemaining: 96,
        monthlyRemaining: 979,
      },
      usage: {
        dailyRequestCount: 4,
        monthlyRequestCount: 21,
        dailyCacheHits: 2,
        monthlyCacheHits: 8,
      },
      quality: {
        score: 88,
        priorityPenalty: 3,
        sampleCount: 12,
        status: 'calibrated',
        successRate: 0.9,
        nonEmptyResultRate: 0.8,
        latencyScore: 1,
        outcomePositiveRate: 0.75,
        outcomeSignalCount: 8,
        outcomePenalty: 4,
        lookbackDays: 14,
        minimumSamples: 3,
      },
    });
    expect(JSON.stringify(diagnostic)).not.toContain('sensitive');
  });

  test('selects the first available candidate and preserves skipped reasons', () => {
    const diagnostics = buildWebSearchProviderRouteDiagnostics([
      {
        ...availableCandidate,
        providerKey: 'brave',
        displayName: 'Brave Search',
        priority: 5,
        status: 'skipped',
        skipReason: 'adapter_unavailable',
        adapter: null,
      },
      availableCandidate,
    ], { now: new Date('2026-06-19T12:00:00.000Z') });

    expect(diagnostics).toEqual(expect.objectContaining({
      evaluatedAt: '2026-06-19T12:00:00.000Z',
      selectedProviderKey: 'tavily',
    }));
    expect(diagnostics.candidates[0]).toEqual(expect.objectContaining({
      providerKey: 'brave',
      status: 'skipped',
      skipReason: 'adapter_unavailable',
      adapterAvailable: false,
    }));
  });
});
