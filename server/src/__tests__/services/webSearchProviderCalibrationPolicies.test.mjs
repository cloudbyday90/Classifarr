/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  WebSearchProviderCalibrationPolicyService,
  normalizeWebSearchProviderCalibrationPolicy,
  normalizeWebSearchProviderCalibrationPurpose,
} from '../../services/webSearchProviderCalibrationPolicies.mjs';

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

describe('webSearchProviderCalibrationPolicies', () => {
  test('normalizes bounded policy fields and purpose labels', () => {
    expect(normalizeWebSearchProviderCalibrationPurpose(' Classification_Enrichment ')).toBe('classification_enrichment');
    expect(normalizeWebSearchProviderCalibrationPolicy({
      purpose: 'classification',
      isEnabled: 'false',
      lookbackDays: 500,
      minimumSamples: 0,
      maximumPriorityPenalty: 200,
      outcomeWeight: -1,
    })).toEqual(expect.objectContaining({
      purpose: 'classification',
      isEnabled: false,
      lookbackDays: 90,
      minimumSamples: 1,
      maximumPriorityPenalty: 100,
      outcomeWeight: 0,
    }));
  });

  test('rejects unsafe purpose labels', () => {
    expect(() => normalizeWebSearchProviderCalibrationPurpose('../classification')).toThrow(
      'Invalid web search calibration purpose'
    );
  });

  test('lists persisted policies and supplies the default classification row when missing', async () => {
    const db = createMockDb([[
      {
        purpose: 'metadata_enrichment',
        is_enabled: true,
        lookback_days: 7,
        minimum_samples: 5,
        maximum_priority_penalty: 10,
        outcome_weight: 5,
        updated_at: '2026-06-25T04:00:00.000Z',
      },
    ]]);
    const service = new WebSearchProviderCalibrationPolicyService({ db });

    const policies = await service.listPolicies();

    expect(policies.map((policy) => policy.purpose)).toEqual(['classification', 'metadata_enrichment']);
    expect(policies[0]).toEqual(expect.objectContaining({
      isEnabled: true,
      lookbackDays: 14,
      minimumSamples: 3,
      maximumPriorityPenalty: 25,
      outcomeWeight: 15,
    }));
  });

  test('reports explicit versus fallback coverage for known purposes and extra policies', async () => {
    const db = createMockDb([[
      {
        purpose: 'classification',
        is_enabled: true,
        lookback_days: 14,
        minimum_samples: 3,
        maximum_priority_penalty: 25,
        outcome_weight: 15,
        updated_at: '2026-06-25T04:00:00.000Z',
      },
      {
        purpose: 'custom_review',
        is_enabled: false,
        lookback_days: 30,
        minimum_samples: 10,
        maximum_priority_penalty: 0,
        outcome_weight: 0,
        updated_at: '2026-06-25T04:00:00.000Z',
      },
    ]]);
    const service = new WebSearchProviderCalibrationPolicyService({ db });

    const report = await service.listPolicyCoverage({
      purposes: ['classification', 'metadata_enrichment'],
    });

    expect(report).toEqual(expect.objectContaining({
      totalPurposes: 3,
      knownPurposeCount: 2,
      explicitPolicyCount: 2,
      fallbackPolicyCount: 1,
    }));
    expect(report.purposes).toEqual([
      expect.objectContaining({
        purpose: 'classification',
        knownPurpose: true,
        hasExplicitPolicy: true,
        coverageSource: 'explicit',
        status: 'covered',
      }),
      expect.objectContaining({
        purpose: 'metadata_enrichment',
        knownPurpose: true,
        hasExplicitPolicy: false,
        coverageSource: 'default',
        status: 'fallback',
        fallbackReason: 'default_policy',
      }),
      expect.objectContaining({
        purpose: 'custom_review',
        knownPurpose: false,
        hasExplicitPolicy: true,
        coverageSource: 'explicit',
        status: 'covered',
      }),
    ]);
  });

  test('returns default policy for unknown persisted purpose rows', async () => {
    const db = createMockDb([[]]);
    const service = new WebSearchProviderCalibrationPolicyService({ db });

    const policy = await service.getPolicyForPurpose('anime');

    expect(policy).toEqual(expect.objectContaining({
      purpose: 'anime',
      isEnabled: true,
      lookbackDays: 14,
    }));
    expect(db.calls[0].params).toEqual(['anime']);
  });

  test('upserts normalized policy fields', async () => {
    const db = createMockDb([[
      {
        purpose: 'classification',
        is_enabled: false,
        lookback_days: 30,
        minimum_samples: 10,
        maximum_priority_penalty: 20,
        outcome_weight: 12,
        updated_at: '2026-06-25T04:00:00.000Z',
      },
    ]]);
    const service = new WebSearchProviderCalibrationPolicyService({ db });

    const policy = await service.upsertPolicy({
      purpose: 'classification',
      isEnabled: false,
      lookbackDays: 30,
      minimumSamples: 10,
      maximumPriorityPenalty: 20,
      outcomeWeight: 12,
    });

    expect(policy).toEqual(expect.objectContaining({
      purpose: 'classification',
      isEnabled: false,
      lookbackDays: 30,
      minimumSamples: 10,
      maximumPriorityPenalty: 20,
      outcomeWeight: 12,
    }));
    expect(db.calls[0].params).toEqual(['classification', false, 30, 10, 20, 12]);
  });
});
