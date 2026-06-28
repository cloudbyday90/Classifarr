/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_INTENT_DRAFT_BUCKETS,
  POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
} from '../../services/policyIntentRequestValidator.mjs';
import {
  POLICY_INTENT_IMPACT_PREVIEW_SCHEMA_VERSION,
  buildPolicyIntentImpactPreview,
} from '../../services/policyIntentImpactPreview.mjs';

function policy(overrides = {}) {
  return {
    id: 14,
    library_id: 14,
    library_name: 'Family',
    library_media_type: 'movie',
    presets: [{
      id: 5,
      key: 'family',
      name: 'Family',
      source: 'builtin',
      weight: 1,
      signals: {
        genres: { require_any: ['Family'] },
        certifications: { mode: 'max', max: 'PG-13', strict: true },
        ratings: { exclude: ['R'] },
      },
      custom_signals: null,
    }],
    ...overrides,
  };
}

function validDraft(overrides = {}) {
  return {
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
          values: { require_any: ['Family'] },
          metadata: { semantics: 'identity' },
          source: 'legacy_preset',
        }],
        [POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY]: [],
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
    summary: {
      preset_count: 1,
    },
    ...overrides,
  };
}

describe('policyIntentImpactPreview', () => {
  test('reports matching parity without exposing raw draft content', () => {
    const preview = buildPolicyIntentImpactPreview({
      policy: policy(),
      payload: {
        policyIntentDraft: validDraft(),
      },
    });

    expect(preview).toEqual(expect.objectContaining({
      schema_version: POLICY_INTENT_IMPACT_PREVIEW_SCHEMA_VERSION,
      mode: 'non_persistent_preview',
      persistence_enabled: false,
      validation: {
        valid: true,
        errors: [],
      },
      comparison: expect.objectContaining({
        parity: 'matching',
        impact_level: 'none',
        changed_buckets: [],
      }),
    }));
    expect(preview.legacy.counts).toEqual({
      identity_signals: 1,
      compatibility_signals: 0,
      strict_constraints: 1,
      boosters: 0,
      exclusions: 1,
    });
    expect(preview.native_draft).toEqual(expect.objectContaining({
      present: true,
      preset_count: 1,
      source: 'legacy_policy_builder',
    }));
    expect(preview).not.toHaveProperty('draft');
    expect(preview.native_draft).not.toHaveProperty('presets');
  });

  test('flags high impact when identity signals drift', () => {
    const draft = validDraft({
      presets: [{
        ...validDraft().presets[0],
        buckets: {
          ...validDraft().presets[0].buckets,
          [POLICY_INTENT_DRAFT_BUCKETS.IDENTITY]: [{
            bucket: POLICY_INTENT_DRAFT_BUCKETS.IDENTITY,
            signal_type: 'genres',
            values: { require_any: ['Horror'] },
            metadata: { semantics: 'identity' },
            source: 'intent_draft',
          }],
        },
      }],
    });

    const preview = buildPolicyIntentImpactPreview({
      policy: policy(),
      payload: {
        policyIntentDraft: draft,
      },
    });

    expect(preview.comparison).toEqual(expect.objectContaining({
      parity: 'different',
      impact_level: 'high',
      changed_buckets: expect.arrayContaining([POLICY_INTENT_DRAFT_BUCKETS.IDENTITY]),
      reason_codes: expect.arrayContaining(['signal_set_changed']),
    }));
    expect(preview.comparison.bucket_deltas).toContainEqual(expect.objectContaining({
      bucket: POLICY_INTENT_DRAFT_BUCKETS.IDENTITY,
      legacy_count: 1,
      native_count: 1,
      matching_signals: 0,
      removed_signals: 1,
      added_signals: 1,
      changed: true,
    }));
  });

  test('returns unavailable preview when no draft is supplied', () => {
    const preview = buildPolicyIntentImpactPreview({
      policy: policy(),
      payload: {},
    });

    expect(preview.native_draft.present).toBe(false);
    expect(preview.comparison).toEqual(expect.objectContaining({
      parity: 'unavailable',
      impact_level: 'unknown',
      reason_codes: ['native_draft_missing'],
    }));
  });
});
