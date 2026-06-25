/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  WebSearchProviderQualityCalibrationService,
  applyWebSearchProviderQualityCalibration,
  calculateWebSearchProviderQuality,
  sortWebSearchProviderCandidatesByQuality,
} from '../../services/webSearchProviderQualityCalibration.mjs';

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

function createOutcomeFeedbackService(summaries = new Map()) {
  return {
    calls: [],
    getProviderOutcomeFeedbackSummaries: async function getProviderOutcomeFeedbackSummaries(providerKeys, options) {
      this.calls.push({ providerKeys, options });
      return summaries;
    },
  };
}

function createCalibrationPolicyService(policy = {}) {
  return {
    calls: [],
    getPolicyForPurposeSafely: async function getPolicyForPurposeSafely(purpose) {
      this.calls.push({ purpose });
      return {
        purpose,
        isEnabled: true,
        lookbackDays: 14,
        minimumSamples: 3,
        maximumPriorityPenalty: 25,
        outcomeWeight: 15,
        ...policy,
      };
    },
  };
}

describe('webSearchProviderQualityCalibration', () => {
  test('keeps providers neutral until enough purpose-specific samples exist', () => {
    expect(calculateWebSearchProviderQuality({
      totalSearches: 2,
      successfulSearches: 0,
      nonEmptySuccesses: 0,
      averageDurationMs: 12000,
    }, { minimumSamples: 3 })).toEqual(expect.objectContaining({
      score: 100,
      priorityPenalty: 0,
      status: 'insufficient_data',
      sampleCount: 2,
    }));
  });

  test('calculates bounded quality penalties from success, result, and latency signals', () => {
    const quality = calculateWebSearchProviderQuality({
      totalSearches: 10,
      successfulSearches: 5,
      nonEmptySuccesses: 3,
      averageDurationMs: 10000,
    }, { minimumSamples: 3, maximumPriorityPenalty: 25 });

    expect(quality).toEqual(expect.objectContaining({
      score: 47,
      priorityPenalty: 13,
      status: 'calibrated',
      successRate: 0.5,
      nonEmptyResultRate: 0.6,
      latencyScore: 0,
      outcomePositiveRate: null,
      outcomePenalty: 0,
    }));
  });

  test('applies bounded outcome feedback penalty when enough downstream signals exist', () => {
    const quality = calculateWebSearchProviderQuality({
      totalSearches: 10,
      successfulSearches: 10,
      nonEmptySuccesses: 10,
      averageDurationMs: 1200,
      positiveOutcomes: 6,
      negativeOutcomes: 4,
      outcomeSignalCount: 10,
    }, { minimumSamples: 3, outcomeWeight: 15 });

    expect(quality).toEqual(expect.objectContaining({
      score: 94,
      priorityPenalty: 2,
      status: 'calibrated',
      outcomePositiveRate: 0.6,
      outcomeSignalCount: 10,
      outcomePenalty: 6,
    }));
  });

  test('applies calibration as an effective priority without mutating raw priority', () => {
    const candidate = applyWebSearchProviderQualityCalibration({
      providerKey: 'brave',
      priority: 10,
    }, {
      score: 80,
      priorityPenalty: 5,
      sampleCount: 8,
      status: 'calibrated',
    });

    expect(candidate.priority).toBe(10);
    expect(candidate.effectivePriority).toBe(15);
    expect(candidate.qualityCalibration).toEqual(expect.objectContaining({
      score: 80,
      priorityPenalty: 5,
      sampleCount: 8,
    }));
  });

  test('sorts by calibrated effective priority, then raw priority', () => {
    const sorted = sortWebSearchProviderCandidatesByQuality([
      { providerKey: 'tavily', priority: 10, effectivePriority: 20 },
      { providerKey: 'brave', priority: 15, effectivePriority: 15 },
      { providerKey: 'serper', priority: 10, effectivePriority: 10 },
    ]);

    expect(sorted.map((candidate) => candidate.providerKey)).toEqual(['serper', 'brave', 'tavily']);
  });

  test('loads purpose-specific summaries and returns neutral calibrations for missing providers', async () => {
    const db = createMockDb([[
      {
        provider_key: 'tavily',
        total_searches: 10,
        successful_searches: 10,
        failed_searches: 0,
        non_empty_successes: 10,
        zero_result_successes: 0,
        average_duration_ms: '1200',
      },
    ]]);
    const outcomeFeedbackService = createOutcomeFeedbackService(new Map([
      ['tavily', {
        positiveOutcomes: 4,
        negativeOutcomes: 0,
        pendingOutcomes: 1,
        neutralOutcomes: 0,
        outcomeSignalCount: 4,
      }],
    ]));
    const calibrationPolicyService = createCalibrationPolicyService({
      lookbackDays: 21,
      minimumSamples: 4,
      outcomeWeight: 12,
    });
    const service = new WebSearchProviderQualityCalibrationService({
      db,
      outcomeFeedbackService,
      calibrationPolicyService,
      nowFn: () => new Date('2026-06-25T02:00:00.000Z'),
    });

    const result = await service.getProviderQualityCalibrations(['tavily', 'brave', 'bad key!'], {
      purpose: 'classification_enrichment',
      lookbackDays: 7,
    });

    expect([...result.keys()]).toEqual(['tavily', 'brave']);
    expect(result.get('tavily').calibration).toEqual(expect.objectContaining({
      status: 'healthy',
      sampleCount: 10,
      priorityPenalty: 0,
      outcomePositiveRate: 1,
      outcomeSignalCount: 4,
    }));
    expect(result.get('brave').calibration).toEqual(expect.objectContaining({
      status: 'insufficient_data',
      sampleCount: 0,
    }));
    expect(db.calls[0].params).toEqual([
      ['tavily', 'brave'],
      'classification_enrichment',
      new Date('2026-06-25T02:00:00.000Z'),
      7,
    ]);
    expect(db.calls[0].sql).toContain("purpose = $2");
    expect(db.calls[0].sql).toContain("operation = 'search'");
    expect(outcomeFeedbackService.calls[0]).toEqual({
      providerKeys: ['tavily', 'brave'],
      options: {
        purpose: 'classification_enrichment',
        now: new Date('2026-06-25T02:00:00.000Z'),
        lookbackDays: 7,
      },
    });
    expect(calibrationPolicyService.calls[0]).toEqual({
      purpose: 'classification_enrichment',
    });
  });

  test('returns neutral calibrations when purpose-specific calibration is disabled', async () => {
    const db = createMockDb([[
      {
        provider_key: 'tavily',
        total_searches: 20,
        successful_searches: 0,
        failed_searches: 20,
        non_empty_successes: 0,
        zero_result_successes: 0,
        average_duration_ms: '12000',
      },
    ]]);
    const service = new WebSearchProviderQualityCalibrationService({
      db,
      outcomeFeedbackService: createOutcomeFeedbackService(),
      calibrationPolicyService: createCalibrationPolicyService({ isEnabled: false }),
      nowFn: () => new Date('2026-06-25T02:00:00.000Z'),
    });

    const result = await service.getProviderQualityCalibrations(['tavily']);

    expect(result.get('tavily').calibration).toEqual(expect.objectContaining({
      status: 'disabled',
      score: 100,
      priorityPenalty: 0,
      sampleCount: 20,
    }));
  });
});
