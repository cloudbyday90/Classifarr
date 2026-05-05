import { jest } from '@jest/globals';

import { PolicyDecisionBuilder } from '../../services/policyDecisionBuilder.mjs';

describe('PolicyDecisionBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new PolicyDecisionBuilder();
  });

  test('normalizeResult derives topCandidate, thresholds, scores, weights, and breakdown from ranked results', () => {
    const result = builder.normalizeResult({
      action: 'prompt_select',
      ranked: [{
        library_id: 12,
        library_name: 'Documentaries',
        policy_id: 99,
        policy_name: 'Docs',
        score: 64,
        scores: { preset: 70, profile: 58 },
        weights: { preset: 0.35, profile: 0.25 },
        breakdown: [{ type: 'preset', score: 70, weight: 0.35 }],
        agreement: { multiplier: 1.05, contributing: 2 },
        auto_classify_threshold: 85,
        prompt_threshold: 60
      }]
    });

    expect(result.topCandidate).toEqual({
      library_id: 12,
      library_name: 'Documentaries',
      policy_id: 99,
      policy_name: 'Docs',
      score: 64
    });
    expect(result.thresholds).toEqual({
      auto_classify: 85,
      prompt: 60,
      prompt_select: 40
    });
    expect(result.scores).toEqual({ preset: 70, profile: 58 });
    expect(result.weights).toEqual({ preset: 0.35, profile: 0.25 });
    expect(result.breakdown).toEqual([{ type: 'preset', score: 70, weight: 0.35 }]);
    expect(result.agreement).toEqual({ multiplier: 1.05, contributing: 2 });
  });

  test('buildPolicyDecision preserves library only for direct policy actions', () => {
    const ranked = [{
      library_id: 12,
      library_name: 'Documentaries',
      policy_id: 99,
      policy_name: 'Docs',
      score: 91,
      scores: {},
      weights: {},
      breakdown: [],
      agreement: null,
      auto_classify_threshold: 85,
      prompt_threshold: 60
    }];

    const autoResult = builder.buildPolicyDecision({
      action: 'auto_classify',
      top: ranked[0],
      ranked
    });
    const selectResult = builder.buildPolicyDecision({
      action: 'prompt_select',
      top: ranked[0],
      ranked
    });

    expect(autoResult.library).toEqual({
      library_id: 12,
      library_name: 'Documentaries',
      policy_id: 99,
      policy_name: 'Docs'
    });
    expect(selectResult.library).toBeUndefined();
    expect(selectResult.topCandidate.library_id).toBe(12);
  });

  test('normalizeResult exposes normalized threshold metadata from ranked results', () => {
    const result = builder.normalizeResult({
      action: 'prompt_select',
      ranked: [{
        library_id: 9,
        library_name: 'Kids',
        policy_id: 21,
        policy_name: 'Family',
        score: 74,
        auto_classify_threshold: 120,
        prompt_threshold: null,
      }]
    });

    expect(result.thresholds).toEqual({
      auto_classify: 95,
      prompt: 95,
      prompt_select: 40,
    });
  });
});
