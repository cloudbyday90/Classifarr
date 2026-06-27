/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_INTENT_DRAFT_BUCKETS,
  POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
  PolicyIntentRequestValidationError,
  buildPolicyIntentWritePreflight,
  safeValidatePolicyIntentDraftRequest,
  summarizePolicyIntentRequestValidationError,
  validatePolicyIntentDraftRequest,
  validatePolicyIntentWritePayload,
} from '../../services/policyIntentRequestValidator.mjs';

function validDraft(overrides = {}) {
  return {
    schema_version: POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
    source: 'legacy_policy_builder',
    migration_state: 'legacy_compatible',
    presets: [{
      preset_id: 14,
      preset_name: 'Family',
      weight: 1,
      source: 'legacy_preset',
      migration_state: 'legacy_compatible',
      legacyCustomSignals: {
        genres: {
          source_note: 'preserve for legacy bridge only',
        },
      },
      runtimeSemantics: {
        migration_state: 'legacy_compatible',
      },
      signalMetadataOverrides: {
        certifications: {
          constraint_mode: 'strict',
        },
      },
      signalRemovalOverrides: {
        genres: {
          prefer: ['Horror'],
        },
      },
      buckets: {
        [POLICY_INTENT_DRAFT_BUCKETS.IDENTITY]: [{
          bucket: POLICY_INTENT_DRAFT_BUCKETS.IDENTITY,
          signal_type: 'genres',
          values: { require_any: ['Family'] },
          metadata: { semantics: 'identity' },
          source: 'legacy_custom_signals',
        }],
        [POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY]: [{
          bucket: POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY,
          signal_type: 'keywords',
          values: { require_any: ['coming of age'] },
          metadata: { semantics: 'compatibility' },
          source: 'intent_draft',
        }],
        [POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS]: [{
          bucket: POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS,
          signal_type: 'certifications',
          values: { mode: 'max', max: 'PG-13' },
          metadata: { constraint_mode: 'strict' },
          source: 'intent_draft',
        }],
        [POLICY_INTENT_DRAFT_BUCKETS.BOOSTERS]: [{
          bucket: POLICY_INTENT_DRAFT_BUCKETS.BOOSTERS,
          signal_type: 'genres',
          values: { prefer: ['Animation'] },
          metadata: {},
          source: 'intent_draft',
        }],
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
      counts: {
        [POLICY_INTENT_DRAFT_BUCKETS.IDENTITY]: 1,
        [POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY]: 1,
        [POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS]: 1,
        [POLICY_INTENT_DRAFT_BUCKETS.BOOSTERS]: 1,
        [POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS]: 1,
      },
    },
    ...overrides,
  };
}

describe('policyIntentRequestValidator', () => {
  test('validates and normalizes a bounded legacy-compatible intent draft', () => {
    const draft = validatePolicyIntentDraftRequest(validDraft());

    expect(draft.schema_version).toBe(POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION);
    expect(draft.presets[0].buckets[POLICY_INTENT_DRAFT_BUCKETS.IDENTITY]).toEqual([
      expect.objectContaining({
        signal_type: 'genres',
        values: { require_any: ['Family'] },
      }),
    ]);
    expect(draft.presets[0].signalMetadataOverrides).toEqual({
      certifications: {
        constraint_mode: 'strict',
      },
    });
  });

  test('rejects unknown top-level, preset, bucket, and value fields', () => {
    const draft = validDraft({
      unexpected_root: true,
      presets: [{
        ...validDraft().presets[0],
        rawSql: 'DROP TABLE library_policies',
        buckets: {
          ...validDraft().presets[0].buckets,
          [POLICY_INTENT_DRAFT_BUCKETS.IDENTITY]: [{
            ...validDraft().presets[0].buckets[POLICY_INTENT_DRAFT_BUCKETS.IDENTITY][0],
            values: {
              require_any: ['Family'],
              raw_weight_formula: '1=1',
            },
          }],
        },
      }],
    });

    expect(() => validatePolicyIntentDraftRequest(draft)).toThrow(PolicyIntentRequestValidationError);

    const result = safeValidatePolicyIntentDraftRequest(draft);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'unexpected_root' }),
      expect.objectContaining({ path: 'presets.0.rawSql' }),
      expect.objectContaining({ path: 'presets.0.buckets.identity_signals.0.values.raw_weight_formula' }),
    ]));
  });

  test('enforces bucket-specific semantic guardrails', () => {
    const basePreset = validDraft().presets[0];
    const result = safeValidatePolicyIntentDraftRequest(validDraft({
      presets: [{
        ...basePreset,
        buckets: {
          ...basePreset.buckets,
          [POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS]: [{
            bucket: POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS,
            signal_type: 'certifications',
            values: { mode: 'max', max: 'R' },
            metadata: {},
          }],
          [POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS]: [{
            bucket: POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS,
            signal_type: 'genres',
            values: { prefer: ['Horror'] },
            metadata: {},
          }],
        },
      }],
    }));

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'presets.0.buckets.strict_constraints.0.metadata.constraint_mode',
      }),
      expect.objectContaining({
        path: 'presets.0.buckets.exclusions.0.values',
      }),
    ]));
  });

  test('reports native intent draft presence without enabling persistence', () => {
    const result = validatePolicyIntentWritePayload({
      policyIntentDraft: validDraft(),
    });

    expect(result.present).toBe(true);
    expect(result.validation).toEqual({
      valid: true,
      errors: [],
    });
    expect(result.persistence_enabled).toBe(false);
    expect(result.persistence_reason_code).toBe('native_intent_storage_not_enabled');
  });

  test('builds sanitized write preflight diagnostics without echoing the draft', () => {
    const result = buildPolicyIntentWritePreflight({
      policyIntentDraft: validDraft(),
    });

    expect(result).toEqual({
      present: true,
      validation: {
        valid: true,
        errors: [],
      },
      persistence_enabled: false,
      persistence_reason_code: 'native_intent_storage_not_enabled',
      draft_schema_version: POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
      source: 'legacy_policy_builder',
      migration_state: 'legacy_compatible',
      preset_count: 1,
    });
    expect(result).not.toHaveProperty('draft');
    expect(result).not.toHaveProperty('presets');
  });

  test('summarizes write validation errors with bounded field paths', () => {
    let capturedError;
    try {
      validatePolicyIntentDraftRequest(validDraft({ unexpected_root: true }));
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(PolicyIntentRequestValidationError);
    expect(summarizePolicyIntentRequestValidationError(capturedError)).toContain('unexpected_root');
  });

  test('treats missing intent draft input as absent and valid', () => {
    expect(validatePolicyIntentWritePayload({ name: 'Family Policy' })).toEqual({
      present: false,
      draft: null,
      validation: {
        valid: true,
        errors: [],
      },
      persistence_enabled: false,
      persistence_reason_code: 'native_intent_storage_not_enabled',
    });
  });
});
