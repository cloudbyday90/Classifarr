/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import { evaluatePolicy } from '../../services/policyEngineEvaluation.mjs';
import { policyCandidateRanker } from '../../services/policyCandidateRanker.mjs';

function nativeIdentityPolicy() {
  return {
    id: 19,
    name: 'TV Shows Policy',
    library_id: 20,
    library_name: 'TV Shows',
    auto_classify_threshold: 85,
    prompt_threshold: 60,
    trust_patterns: false,
    trust_rag: false,
    trust_history: false,
    policy_runtime_authority: {
      sourceId: 'native_intent',
      validationOk: true,
    },
    policy_intent_contract: {
      source: 'native_intent',
      validation: { valid: true },
      purpose: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['Mystery', 'Drama'] },
        semantics: 'identity',
      }],
      hard_limits: [],
      helpful_hints: [],
      avoid: [],
      review_behavior: { combination_mode: 'best_match' },
    },
  };
}

function scoringDependencies() {
  return {
    scorePresets: async () => 0,
    scoreProfile: async () => 0,
    scoreProfileWithDiagnostics: async () => ({
      score: 0,
      diagnostics: {
        schema_version: 1,
        available: true,
        exclusions: {
          ratings: [{ value: 'TV-14', score_delta: -50 }],
          genres: [],
          keywords: [],
        },
      },
    }),
    scorePatterns: async () => 0,
    scoreRAG: async () => 0,
    scoreRAGWithDiagnostics: async () => ({ score: 0, diagnostics: null }),
    scoreHistory: async () => 0,
  };
}

describe('policyEngine observed-profile precedence', () => {
  test('retains a native identity match and its evidence when profile absence disagrees', async () => {
    const evaluation = await evaluatePolicy(
      nativeIdentityPolicy(),
      {
        title: 'Home Before Dark',
        media_type: 'tv',
        certification: 'TV-14',
        genres: ['Mystery', 'Drama'],
      },
      { matches: [], timestamp: Date.now() },
      [],
      scoringDependencies(),
    );
    const ranked = await policyCandidateRanker.rankResults([evaluation]);

    expect(evaluation).toEqual(expect.objectContaining({
      score: 80,
      scores: expect.objectContaining({ intent: 80, profile: 0 }),
      candidate_diagnostics: expect.objectContaining({
        evidence_class: 'identity',
        primary_anchor_eligible: true,
        profile_hard_excluded: false,
        profile_observed_absence: true,
        profile_observed_absence_advisory: true,
      }),
    }));
    expect(ranked).toEqual([expect.objectContaining({
      library_id: 20,
      raw_score: 80,
      score: 80,
    })]);
  });
});
