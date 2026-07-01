/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
  POLICY_INTENT_INFERENCE_STATES,
  POLICY_INTENT_SOURCES,
  validatePolicyIntentContract,
} from '../../services/policyIntentSchema.mjs';

function validContract(overrides = {}) {
  return {
    schema_version: POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
    policy_id: 1,
    library_id: 2,
    library_name: 'Family',
    library_media_type: 'movie',
    source: POLICY_INTENT_SOURCES.LEGACY_PRESETS,
    inference_state: POLICY_INTENT_INFERENCE_STATES.INFERRED,
    model: {
      mode: 'legacy_presets',
      intent_supported: true,
      native_intent: false,
      conversion_available: false,
    },
    purpose: [{
      intent_role: 'purpose',
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: ['Family'] },
      constraint_mode: 'advisory',
      semantics: 'identity',
      source: 'base',
    }],
    hard_limits: [{
      intent_role: 'hard_limit',
      signal_type: 'certifications',
      operator: 'max',
      values: { mode: 'max', max: 'PG-13' },
      constraint_mode: 'strict',
      semantics: 'compatibility',
      source: 'custom',
    }],
    helpful_hints: [{
      intent_role: 'helpful_hint',
      signal_type: 'keywords',
      operator: 'prefer',
      values: { prefer: ['animation'] },
      constraint_mode: 'advisory',
      semantics: 'compatibility',
      source: 'base',
    }],
    avoid: [{
      intent_role: 'avoid',
      signal_type: 'language',
      operator: 'exclude',
      values: { exclude: ['ja'] },
      constraint_mode: 'advisory',
      semantics: 'compatibility',
      source: 'custom',
    }],
    review_behavior: {},
    template_links: [],
    warnings: [],
    unsupported_signals: [],
    ...overrides,
  };
}

describe('policyIntentSchema', () => {
  test('accepts a valid policy intent contract', () => {
    expect(validatePolicyIntentContract(validContract())).toEqual({
      valid: true,
      error_count: 0,
      warning_count: 0,
      errors: [],
      warnings: [],
    });
  });

  test('accepts native intent as a valid contract source', () => {
    expect(validatePolicyIntentContract(validContract({
      source: POLICY_INTENT_SOURCES.NATIVE_INTENT,
      model: {
        mode: 'native_intent',
        intent_supported: true,
        native_intent: true,
        conversion_available: false,
      },
    }))).toEqual(expect.objectContaining({
      valid: true,
      error_count: 0,
    }));
  });

  test('rejects unsupported contract metadata and collection shapes', () => {
    const validation = validatePolicyIntentContract(validContract({
      schema_version: 999,
      source: 'ai_text',
      inference_state: 'guessed',
      helpful_hints: {},
      template_links: null,
    }));

    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unsupported_schema_version', path: 'schema_version' }),
      expect.objectContaining({ code: 'unknown_source', path: 'source' }),
      expect.objectContaining({ code: 'unknown_inference_state', path: 'inference_state' }),
      expect.objectContaining({ code: 'invalid_collection', path: 'helpful_hints' }),
      expect.objectContaining({ code: 'invalid_template_links', path: 'template_links' }),
    ]));
  });

  test('enforces intent role and semantic boundaries by collection', () => {
    const validation = validatePolicyIntentContract(validContract({
      purpose: [{
        intent_role: 'purpose',
        signal_type: 'certifications',
        operator: 'max',
        values: { max: 'R' },
        constraint_mode: 'strict',
        semantics: 'compatibility',
      }],
      hard_limits: [{
        intent_role: 'hard_limit',
        signal_type: 'certifications',
        operator: 'max',
        values: { max: 'PG-13' },
        constraint_mode: 'advisory',
        semantics: 'compatibility',
      }],
      helpful_hints: [{
        intent_role: 'hard_limit',
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['Comedy'] },
        constraint_mode: 'strict',
        semantics: 'compatibility',
      }],
    }));

    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'purpose_requires_identity_capable_signal' }),
      expect.objectContaining({ code: 'hard_limit_requires_strict_constraint' }),
      expect.objectContaining({ code: 'invalid_role_for_collection', path: 'helpful_hints[0].intent_role' }),
      expect.objectContaining({ code: 'helpful_hint_cannot_be_strict' }),
    ]));
  });

  test('warns when avoid evidence is not exclusion-shaped', () => {
    const validation = validatePolicyIntentContract(validContract({
      avoid: [{
        intent_role: 'avoid',
        signal_type: 'genres',
        operator: 'prefer',
        values: { prefer: ['Horror'] },
        constraint_mode: 'advisory',
        semantics: 'compatibility',
      }],
    }));

    expect(validation.valid).toBe(true);
    expect(validation.warnings).toEqual([
      expect.objectContaining({
        code: 'avoid_should_be_exclusion',
        path: 'avoid[0].operator',
      }),
    ]);
  });
});
