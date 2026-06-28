/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildPolicyIntentReplayScoring,
  POLICY_INTENT_REPLAY_SCORING_MODE,
} from '../services/policyIntentReplayScoring.mjs';
import {
  POLICY_INTENT_DRAFT_BUCKETS,
  POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
} from '../services/policyIntentRequestValidator.mjs';

function draftPayload(overrides = {}) {
  return {
    policyIntentDraft: {
      schema_version: POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
      source: 'legacy_policy_builder',
      migration_state: 'legacy_compatible',
      presets: [{
        preset_id: 5,
        preset_name: 'Family',
        weight: 1,
        source: 'legacy_preset',
        migration_state: 'legacy_compatible',
        buckets: {
          [POLICY_INTENT_DRAFT_BUCKETS.IDENTITY]: [{
            bucket: POLICY_INTENT_DRAFT_BUCKETS.IDENTITY,
            signal_type: 'genres',
            values: { require_any: ['Family', 'Animation'] },
            metadata: { semantics: 'identity' },
            source: 'legacy_preset',
          }],
          [POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY]: [{
            bucket: POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY,
            signal_type: 'keywords',
            values: { prefer: ['dragon'] },
            metadata: { semantics: 'compatibility' },
            source: 'legacy_preset',
          }],
          [POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS]: [{
            bucket: POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS,
            signal_type: 'certifications',
            values: { mode: 'max', max: 'PG-13' },
            metadata: { constraint_mode: 'strict' },
            source: 'intent_draft',
          }],
          [POLICY_INTENT_DRAFT_BUCKETS.BOOSTERS]: [],
          [POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS]: [{
            bucket: POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS,
            signal_type: 'ratings',
            values: { exclude: ['R'] },
            metadata: {},
            source: 'intent_draft',
          }],
        },
        warnings: [],
      }],
    },
    ...overrides,
  };
}

describe('policyIntentReplayScoring', () => {
  test('scores representative samples that fit native intent signals', () => {
    const scoring = buildPolicyIntentReplayScoring({
      payload: draftPayload(),
      samples: [{
        title: 'Mulan',
        year: 1998,
        media_type: 'movie',
        genre_names: ['Animation', 'Family', 'Adventure'],
        metadata: {
          rating: 'G',
          keywords: ['dragon', 'female protagonist'],
        },
      }],
    });

    expect(scoring).toEqual(expect.objectContaining({
      schema_version: 1,
      mode: POLICY_INTENT_REPLAY_SCORING_MODE,
      enabled: true,
      full_classification_run: false,
      ai_calls_enabled: false,
      provider_calls_enabled: false,
      arr_writes_enabled: false,
      persistence_enabled: false,
      execution_context: expect.objectContaining({
        mode: 'dry_run_replay',
        side_effects_enabled: false,
        capabilities: expect.objectContaining({
          classification_run: false,
          ai_calls_enabled: false,
          provider_calls_enabled: false,
          arr_writes_enabled: false,
          persistence_enabled: false,
        }),
      }),
      sample_count: 1,
      scored_count: 1,
      strong_fit_count: 1,
      blocked_count: 0,
    }));
    expect(scoring.items[0]).toEqual(expect.objectContaining({
      sample_id: 1,
      draft_signal_fit: 'strong',
      recommendation: 'would_remain_candidate',
      evidence_available: true,
      missing_required: [],
      exclusion_hits: [],
    }));
    expect(scoring.items[0].matched.identity).toContain('genres:Animation');
    expect(scoring.items[0].matched.compatibility).toContain('keywords:dragon');
  });

  test('blocks representative samples that violate hard exclusions', () => {
    const scoring = buildPolicyIntentReplayScoring({
      payload: draftPayload(),
      samples: [{
        title: 'Office Romance',
        year: 2026,
        media_type: 'movie',
        genre_names: ['Romance', 'Comedy'],
        metadata: {
          rating: 'R',
          keywords: ['office romance'],
        },
      }],
    });

    expect(scoring).toEqual(expect.objectContaining({
      sample_count: 1,
      scored_count: 1,
      strong_fit_count: 0,
      blocked_count: 1,
      review_count: 0,
    }));
    expect(scoring.items[0]).toEqual(expect.objectContaining({
      draft_signal_fit: 'blocked',
      recommendation: 'would_be_blocked',
      exclusion_hits: ['ratings:R'],
    }));
  });

  test('marks samples without usable evidence as insufficient', () => {
    const scoring = buildPolicyIntentReplayScoring({
      payload: draftPayload(),
      samples: [{ title: 'Unknown' }],
    });

    expect(scoring).toEqual(expect.objectContaining({
      sample_count: 1,
      scored_count: 0,
      insufficient_count: 1,
    }));
    expect(scoring.items[0]).toEqual(expect.objectContaining({
      draft_signal_fit: 'insufficient',
      recommendation: 'insufficient_evidence',
      evidence_available: false,
    }));
  });
});
