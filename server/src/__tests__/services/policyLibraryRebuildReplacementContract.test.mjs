/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

function proposal(overrides = {}) {
  return {
    version: 'policy.library_policy_rebuild.v1',
    library: {
      libraryId: 6,
      libraryName: 'Animated Movies',
      mediaType: 'movie',
    },
    intentDraft: {
      belongs_here: [{ key: 'studio:disney', label: 'Disney' }],
      helpful_matches: [{ key: 'genre:animation', label: 'Animation' }],
      hard_limits: [],
      avoid: [{ key: 'genre:horror', label: 'Horror' }],
      ask_when: [{ reasonCode: 'outlier_needs_review' }],
      confidence: { level: 'high', score: 0.8 },
    },
    warnings: [],
    ...overrides,
  };
}

jest.unstable_mockModule('../../services/policyLibraryPolicyRebuild.mjs', () => ({
  validatePolicyLibraryPolicyRebuildProposal: () => ({ ok: true }),
}));

const {
  POLICY_LIBRARY_REBUILD_REPLACEMENT_CONTRACT_RISK_IDS,
  buildPolicyLibraryRebuildReplacementContract: buildContract,
} = await import('../../services/policyLibraryRebuildReplacementContract.mjs');

describe('policyLibraryRebuildReplacementContract', () => {
  test('maps typed identity, helpful, and avoid evidence into a validated native contract', () => {
    const result = buildContract({
      proposal: proposal(),
      policy: { id: 44, library_id: 6 },
      previousIntent: {
        review_behavior: JSON.stringify({ auto_classify_threshold: 85 }),
      },
    });

    expect(result.ok).toBe(true);
    expect(result.contract).toEqual(expect.objectContaining({
      source: 'native_intent',
      inference_state: 'inferred',
      purpose: [expect.objectContaining({
        signal_type: 'studios',
        operator: 'require_any',
        values: { require_any: ['Disney'] },
      })],
      helpful_hints: [expect.objectContaining({
        signal_type: 'genres',
        operator: 'prefer',
        values: { prefer: ['Animation'] },
      })],
      avoid: [expect.objectContaining({
        signal_type: 'genres',
        operator: 'exclude',
        values: { exclude: ['Horror'] },
      })],
    }));
    expect(result.contract.review_behavior).toEqual(expect.objectContaining({
      auto_classify_threshold: 85,
      library_rebuild: expect.objectContaining({
        requires_review: true,
      }),
    }));
    expect(result.contract.validation.valid).toBe(true);
  });

  test('fails closed when a rebuild entry has no typed signal key', () => {
    const result = buildContract({
      proposal: proposal({
        intentDraft: {
          ...proposal().intentDraft,
          belongs_here: [{ key: 'Animated Movies', label: 'Animated Movies' }],
        },
      }),
      policy: { id: 44, library_id: 6 },
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_CONTRACT_RISK_IDS.UNSUPPORTED_SIGNAL_KEY,
      }),
    ]));
  });

  test('does not guess strict-constraint operators from label-only hard limits', () => {
    const result = buildContract({
      proposal: proposal({
        intentDraft: {
          ...proposal().intentDraft,
          hard_limits: [{ key: 'certification:pg-13', label: 'PG-13' }],
        },
      }),
      policy: { id: 44, library_id: 6 },
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_CONTRACT_RISK_IDS.AMBIGUOUS_HARD_LIMIT,
      }),
    ]));
  });
});
