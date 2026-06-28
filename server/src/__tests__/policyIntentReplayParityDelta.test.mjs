/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildPolicyIntentReplayParityDelta,
  POLICY_INTENT_REPLAY_PARITY_DELTA_MODE,
} from '../services/policyIntentReplayParityDelta.mjs';

function scoringItem(sampleId, draftFit, policyEngineFit, overrides = {}) {
  return {
    sample_id: sampleId,
    draft_signal_fit: draftFit,
    policy_engine: {
      policy_engine_fit: policyEngineFit,
      blockers: [],
    },
    exclusion_hits: [],
    missing_required: [],
    ...overrides,
  };
}

describe('policyIntentReplayParityDelta', () => {
  test('returns a disabled bounded summary when scoring has not run', () => {
    expect(buildPolicyIntentReplayParityDelta({
      samples: [{ sample_id: 1, current_outcome: 'final_success' }],
      scoring: null,
    })).toEqual({
      schema_version: 1,
      mode: POLICY_INTENT_REPLAY_PARITY_DELTA_MODE,
      enabled: false,
      compared_count: 0,
      would_remain_count: 0,
      would_now_candidate_count: 0,
      would_now_review_count: 0,
      would_now_block_count: 0,
      insufficient_count: 0,
      items: [],
    });
  });

  test('summarizes representative replay parity deltas', () => {
    const delta = buildPolicyIntentReplayParityDelta({
      samples: [
        { sample_id: 1, current_outcome: 'final_success' },
        { sample_id: 2, current_outcome: 'final_success' },
        { sample_id: 3, current_outcome: 'final_success' },
        { sample_id: 4, current_outcome: 'review_or_pending' },
        { sample_id: 5, current_outcome: 'review_or_pending' },
      ],
      scoring: {
        enabled: true,
        items: [
          scoringItem(1, 'strong', 'strong'),
          scoringItem(2, 'review', 'strong'),
          scoringItem(3, 'strong', 'blocked', {
            policy_engine: {
              policy_engine_fit: 'blocked',
              blockers: ['exclusions:certifications'],
            },
          }),
          scoringItem(4, 'strong', 'strong'),
          scoringItem(5, 'insufficient', 'insufficient'),
        ],
      },
    });

    expect(delta).toEqual(expect.objectContaining({
      schema_version: 1,
      mode: POLICY_INTENT_REPLAY_PARITY_DELTA_MODE,
      enabled: true,
      compared_count: 5,
      would_remain_count: 1,
      would_now_candidate_count: 1,
      would_now_review_count: 1,
      would_now_block_count: 1,
      insufficient_count: 1,
    }));
    expect(delta.items.map((item) => item.delta_action)).toEqual([
      'would_remain',
      'would_now_review',
      'would_now_block',
      'would_now_candidate',
      'insufficient_evidence',
    ]);
    expect(delta.items[2]).toEqual(expect.objectContaining({
      delta_level: 'high',
      reason_codes: expect.arrayContaining([
        'current:final_success',
        'draft:strong',
        'policy_engine:blocked',
        'blocker:exclusions:certifications',
      ]),
    }));
  });
});
