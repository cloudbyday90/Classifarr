import {
  POLICY_INTENT_INFERENCE_STATES,
  POLICY_INTENT_SOURCES,
  buildPolicyIntentContract,
} from '../../services/policyIntentContract.mjs';

function policy(overrides = {}) {
  return {
    id: 14,
    library_id: 14,
    library_name: 'Family',
    library_media_type: 'movie',
    auto_classify_threshold: 85,
    prompt_threshold: 60,
    require_ai_validation: true,
    trust_patterns: true,
    trust_rag: true,
    trust_history: true,
    combination_mode: 'best_match',
    presets: [],
    ...overrides,
  };
}

function preset(overrides = {}) {
  return {
    id: 7,
    key: 'family',
    name: 'Family',
    source: 'builtin',
    weight: 1,
    signals: {},
    custom_signals: null,
    ...overrides,
  };
}

describe('policyIntentContract', () => {
  test('builds a legacy preset intent contract from policy signals', () => {
    const contract = buildPolicyIntentContract(policy({
      presets: [preset({
        signals: {
          genres: { require_any: ['Family'] },
          keywords: { require_any: ['coming of age'], semantics: 'compatibility' },
          certifications: { mode: 'max', max: 'PG-13', strict: true },
          studios: { prefer: ['Pixar'] },
          language: { exclude: ['ja'] },
        },
      })],
    }));

    expect(contract).toEqual(expect.objectContaining({
      schema_version: 1,
      source: POLICY_INTENT_SOURCES.LEGACY_PRESETS,
      inference_state: POLICY_INTENT_INFERENCE_STATES.INFERRED,
      validation: {
        valid: true,
        error_count: 0,
        warning_count: 0,
        errors: [],
        warnings: [],
      },
      model: expect.objectContaining({
        mode: 'legacy_presets',
        intent_supported: true,
        native_intent: false,
        conversion_available: false,
      }),
    }));
    expect(contract.purpose).toEqual([
      expect.objectContaining({
        intent_role: 'purpose',
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['Family'] },
      }),
    ]);
    expect(contract.hard_limits).toEqual([
      expect.objectContaining({
        intent_role: 'hard_limit',
        signal_type: 'certifications',
        operator: 'max',
        constraint_mode: 'strict',
      }),
    ]);
    expect(contract.helpful_hints).toEqual([
      expect.objectContaining({
        signal_type: 'keywords',
        operator: 'require_any',
      }),
      expect.objectContaining({
        signal_type: 'studios',
        operator: 'prefer',
      }),
    ]);
    expect(contract.avoid).toEqual([
      expect.objectContaining({
        signal_type: 'language',
        operator: 'exclude',
      }),
    ]);
    expect(contract.template_links).toEqual([
      expect.objectContaining({
        preset_id: 7,
        preset_key: 'family',
        link_state: 'attached',
      }),
    ]);
    expect(contract.unsupported_signals).toEqual([]);
  });

  test('marks unsupported legacy preset signals as partial inference warnings', () => {
    const contract = buildPolicyIntentContract(policy({
      presets: [preset({
        signals: {
          experimental_signal: { require_any: ['unknown'] },
          genres: { require_any: ['Comedy'], unsupported_operator: ['x'] },
        },
      })],
    }));

    expect(contract.inference_state).toBe(POLICY_INTENT_INFERENCE_STATES.PARTIAL);
    expect(contract.unsupported_signals).toEqual([
      expect.objectContaining({
        signal_type: 'experimental_signal',
        reason_code: 'unsupported_signal_type',
      }),
      expect.objectContaining({
        signal_type: 'genres',
        reason_code: 'unsupported_signal_keys',
        unsupported_keys: ['unsupported_operator'],
      }),
    ]);
    expect(contract.warnings).toContainEqual(expect.objectContaining({
      reason_code: 'legacy_preset_partial_inference',
      count: 2,
    }));
  });

  test('returns an empty contract for policies without presets', () => {
    const contract = buildPolicyIntentContract(policy());

    expect(contract.source).toBe(POLICY_INTENT_SOURCES.EMPTY);
    expect(contract.inference_state).toBe(POLICY_INTENT_INFERENCE_STATES.EMPTY);
    expect(contract.purpose).toEqual([]);
    expect(contract.hard_limits).toEqual([]);
    expect(contract.helpful_hints).toEqual([]);
    expect(contract.avoid).toEqual([]);
    expect(contract.template_links).toEqual([]);
  });
});
