/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Contract tests for normalized PolicyEngine result shapes.
 */

import { jest } from '@jest/globals';
import { policyEngine } from '../services/policyEngine.mjs';
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

  test('calibrates shared broad purpose evidence before the ranker receives native candidates', async () => {
    const nativePolicy = (id, libraryId, purpose) => ({
      id,
      library_id: libraryId,
      name: `Policy ${id}`,
      library_name: `Library ${libraryId}`,
      enabled: true,
      library_media_type: 'tv',
      trust_patterns: false,
      trust_rag: false,
      trust_history: false,
      policy_runtime_authority: { sourceId: 'native_intent', validationOk: true },
      policy_intent_contract: {
        source: 'native_intent',
        validation: { valid: true },
        purpose: [{ signal_type: 'genres', values: { require_any: purpose } }],
      },
    });
    const specialized = nativePolicy(1, 12, ['Drama', 'Mystery']);
    const broad = nativePolicy(2, 13, ['Drama', 'Reality']);
    const evaluation = (policy) => ({
      policy_id: policy.id,
      policy_name: policy.name,
      library_id: policy.library_id,
      library_name: policy.library_name,
      score: 80,
      scores: { intent: 80 },
      weights: { intent: 1 },
      breakdown: [],
      agreement: null,
      auto_classify_threshold: 85,
      prompt_threshold: 60,
      candidate_diagnostics: {
        primary_viability: 'identity_evidence',
        evidence_class: 'identity',
        primary_anchor_eligible: true,
      },
    });

    jest.spyOn(policyEngine, 'checkAuthoritativeSignals').mockResolvedValue(null);
    jest.spyOn(policyEngine, 'getActivePolicies').mockResolvedValue([specialized, broad]);
    jest.spyOn(policyEngine, 'evaluatePolicy')
      .mockResolvedValueOnce(evaluation(specialized))
      .mockResolvedValueOnce(evaluation(broad));
    const rankResults = jest.spyOn(policyCandidateRanker, 'rankResults')
      .mockImplementation(async (candidates) => candidates);

    await policyEngine.evaluateItem({
      title: 'Mystery Drama',
      media_type: 'tv',
      genres: ['Mystery', 'Drama'],
    });

    const [received] = rankResults.mock.calls[0];
    expect(received[0].candidate_diagnostics).toEqual(expect.objectContaining({
      primary_viability: 'identity_evidence',
      evidence_class: 'specialized_identity',
      identity_evidence: expect.objectContaining({
        status_id: 'positive_specialized_evidence',
      }),
    }));
    expect(received[1].candidate_diagnostics).toEqual(expect.objectContaining({
      primary_viability: 'compatibility_only',
      evidence_class: 'broad_compatibility_overlap',
      identity_evidence: expect.objectContaining({
        status_id: 'broad_compatibility_overlap',
      }),
    }));
  });
});
