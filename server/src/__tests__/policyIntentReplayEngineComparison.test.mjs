/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildPolicyEngineSignalsFromIntentEntries,
  buildPolicyIntentReplayEngineComparison,
  POLICY_INTENT_REPLAY_ENGINE_COMPARISON_MODE,
} from '../services/policyIntentReplayEngineComparison.mjs';
import {
  POLICY_INTENT_DRAFT_BUCKETS,
  POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
} from '../services/policyIntentRequestValidator.mjs';

function draftPayload() {
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
  };
}

describe('policyIntentReplayEngineComparison', () => {
  test('builds policy-engine signals from native intent entries', () => {
    const signals = buildPolicyEngineSignalsFromIntentEntries([{
      signal_type: 'ratings',
      values: { exclude: ['R'] },
      metadata: { semantics: 'compatibility' },
    }], {
      bucketName: POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS,
    });

    expect(signals).toEqual({
      certifications: {
        exclude: ['R'],
        mode: 'exclude',
        semantics: 'compatibility',
      },
    });
  });

  test('scores matching replay items through deterministic policy-engine signals', () => {
    const comparison = buildPolicyIntentReplayEngineComparison({
      payload: draftPayload(),
      item: {
        title: 'Mulan',
        media_type: 'movie',
        certification: 'G',
        genres: ['Animation', 'Family'],
        keywords: ['dragon'],
        studios: ['Disney'],
        overview: 'A young woman disguises herself as a soldier.',
        evidence: { fields: ['title', 'genres', 'keywords', 'certification'] },
      },
    });

    expect(comparison).toEqual(expect.objectContaining({
      schema_version: 1,
      mode: POLICY_INTENT_REPLAY_ENGINE_COMPARISON_MODE,
      enabled: true,
      policy_engine_score: 80,
      policy_engine_fit: 'strong',
      evidence_available: true,
      preset_count: 1,
      scored_preset_count: 1,
      positive_signal_count: 2,
      blocker_count: 0,
      blockers: [],
    }));
  });

  test('blocks replay items that fail strict or exclusion policy-engine signals', () => {
    const comparison = buildPolicyIntentReplayEngineComparison({
      payload: draftPayload(),
      item: {
        title: 'Office Romance',
        media_type: 'movie',
        certification: 'R',
        genres: ['Comedy', 'Romance'],
        keywords: ['office romance'],
        evidence: { fields: ['title', 'genres', 'keywords', 'certification'] },
      },
    });

    expect(comparison).toEqual(expect.objectContaining({
      policy_engine_score: 0,
      policy_engine_fit: 'blocked',
      blocker_count: 2,
      blockers: [
        'strict_constraints:certifications',
        'exclusions:certifications',
      ],
    }));
  });

  test('marks title-only replay items as insufficient for engine comparison', () => {
    const comparison = buildPolicyIntentReplayEngineComparison({
      payload: draftPayload(),
      item: {
        title: 'Unknown title',
        genres: [],
        keywords: [],
        studios: [],
        evidence: { fields: ['title'] },
      },
    });

    expect(comparison).toEqual(expect.objectContaining({
      policy_engine_score: 0,
      policy_engine_fit: 'insufficient',
      evidence_available: false,
    }));
  });
});
