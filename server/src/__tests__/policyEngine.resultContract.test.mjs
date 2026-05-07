/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Contract tests for normalized PolicyEngine result shapes.
 */

import { jest } from '@jest/globals';
import policyEngine from '../services/policyEngine.mjs';
import { policyCandidateRanker } from '../services/policyCandidateRanker.mjs';

describe('PolicyEngine result contract', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('evaluateItem returns normalized prompt_select fields from ranked results', async () => {
    jest.spyOn(policyEngine, 'checkAuthoritativeSignals').mockResolvedValue(null);
    jest.spyOn(policyEngine, 'getActivePolicies').mockResolvedValue([{
      id: 1,
      library_id: 12,
      name: 'Docs',
      library_name: 'Documentaries',
      presets: [{ id: 7 }],
      trust_patterns: true,
      trust_rag: false,
      trust_history: false,
      library_media_type: 'movie'
    }]);
    jest.spyOn(policyEngine, 'evaluatePolicy').mockResolvedValue({
      policy_id: 1,
      policy_name: 'Docs',
      library_id: 12,
      library_name: 'Documentaries',
      score: 64,
      scores: { preset: 70, profile: 58, pattern: 0, rag: 0, history: 0 },
      weights: { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 },
      breakdown: [{ type: 'preset', score: 70, weight: 0.35 }],
      agreement: { multiplier: 1.05, contributing: 2 },
      auto_classify_threshold: 85,
      prompt_threshold: 70
    });
    jest.spyOn(policyCandidateRanker, 'rankResults').mockResolvedValue([{
      policy_id: 1,
      policy_name: 'Docs',
      library_id: 12,
      library_name: 'Documentaries',
      score: 64,
      scores: { preset: 70, profile: 58, pattern: 0, rag: 0, history: 0 },
      weights: { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 },
      breakdown: [{ type: 'preset', score: 70, weight: 0.35 }],
      agreement: { multiplier: 1.05, contributing: 2 },
      auto_classify_threshold: 85,
      prompt_threshold: 70
    }]);

    const result = await policyEngine.evaluateItem({
      title: 'Planet Earth',
      media_type: 'movie'
    });

    expect(result.action).toBe('prompt_select');
    expect(result.topCandidate).toEqual({
      library_id: 12,
      library_name: 'Documentaries',
      policy_id: 1,
      policy_name: 'Docs',
      score: 64
    });
    expect(result.thresholds).toEqual({
      auto_classify: 85,
      prompt: 70,
      prompt_select: 40
    });
    expect(result.scores).toEqual({ preset: 70, profile: 58, pattern: 0, rag: 0, history: 0 });
    expect(result.weights).toEqual({ preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 });
    expect(result.breakdown).toEqual([{ type: 'preset', score: 70, weight: 0.35 }]);
    expect(result.library).toBeUndefined();
  });
});
