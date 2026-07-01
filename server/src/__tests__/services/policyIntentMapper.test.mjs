import {
  buildPolicyIntentProjection,
  withPolicyIntentProjection,
} from '../../services/policyIntentMapper.mjs';
import {
  POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
  POLICY_INTENT_INFERENCE_STATES,
  POLICY_INTENT_ROLES,
  POLICY_INTENT_SOURCES,
} from '../../services/policyIntentSchema.mjs';

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

describe('policyIntentMapper', () => {
  test('adds the read-only intent projection without mutating the policy row', () => {
    const originalPolicy = policy({
      presets: [preset({
        signals: {
          genres: { require_any: ['Family'] },
          certifications: { mode: 'max', max: 'PG-13', strict: true },
        },
      })],
    });

    const projectedPolicy = withPolicyIntentProjection(originalPolicy);

    expect(projectedPolicy).not.toBe(originalPolicy);
    expect(originalPolicy.configuration_view).toBeUndefined();
    expect(originalPolicy.policy_intent_contract).toBeUndefined();

    expect(projectedPolicy.configuration_view).toEqual(expect.objectContaining({
      policy_id: 14,
      library_id: 14,
      summary: expect.objectContaining({
        counts: expect.objectContaining({
          identity_signals: 1,
          strict_constraints: 1,
        }),
      }),
    }));
    expect(projectedPolicy.policy_intent_contract).toEqual(expect.objectContaining({
      policy_id: 14,
      library_id: 14,
      validation: expect.objectContaining({
        valid: true,
        error_count: 0,
      }),
    }));
    expect(projectedPolicy.policy_intent_read_trace).toEqual(expect.objectContaining({
      source: 'compatibility_bridge',
      status: 'compatibility_bridge_fallback',
      policy_id: 14,
    }));
  });

  test('reuses precomputed projection objects when a caller already has them', () => {
    const configurationView = {
      schema_version: 1,
      policy_id: 14,
      library_id: 14,
      marker: 'configuration-view',
    };
    const policyIntentContract = {
      schema_version: 1,
      policy_id: 14,
      library_id: 14,
      marker: 'intent-contract',
    };

    const projection = buildPolicyIntentProjection(policy({
      configuration_view: configurationView,
      policy_intent_contract: policyIntentContract,
    }));

    expect(projection).toEqual(expect.objectContaining({
      configuration_view: configurationView,
      policy_intent_contract: policyIntentContract,
      policy_intent_read_trace: expect.objectContaining({
        source: 'compatibility_bridge',
      }),
    }));
    expect(projection.configuration_view).toBe(configurationView);
    expect(projection.policy_intent_contract).toBe(policyIntentContract);
  });

  test('passes a generated configuration view into the generated contract', () => {
    const projection = buildPolicyIntentProjection(policy({
      presets: [preset({
        signals: {
          genres: { require_any: ['Family'] },
        },
      })],
    }));

    expect(projection.configuration_view.identity_signals).toHaveLength(1);
    expect(projection.policy_intent_contract.purpose).toHaveLength(1);
    expect(projection.policy_intent_contract.template_links).toEqual([
      expect.objectContaining({
        preset_id: 7,
        preset_key: 'family',
        link_state: 'attached',
      }),
    ]);
  });

  test('projects active native intent through the same product contract shape', () => {
    const projection = buildPolicyIntentProjection(policy({
      native_intent: {
        active: true,
        intent_version: 2,
        contract: {
          schema_version: POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
          policy_id: 14,
          library_id: 14,
          library_name: 'Family',
          library_media_type: 'movie',
          source: POLICY_INTENT_SOURCES.NATIVE_INTENT,
          inference_state: POLICY_INTENT_INFERENCE_STATES.INFERRED,
          model: {
            mode: 'native_intent',
            intent_supported: true,
            native_intent: true,
            conversion_available: false,
          },
          purpose: [{
            intent_role: POLICY_INTENT_ROLES.PURPOSE,
            signal_type: 'genres',
            operator: 'require_any',
            values: { require_any: ['Family'] },
            constraint_mode: 'advisory',
            semantics: 'identity',
            source: 'native',
            inference_state: POLICY_INTENT_INFERENCE_STATES.INFERRED,
          }],
          hard_limits: [],
          helpful_hints: [],
          avoid: [],
          review_behavior: {},
          template_links: [],
          warnings: [],
          unsupported_signals: [],
        },
      },
    }));

    expect(projection.policy_intent_contract).toEqual(expect.objectContaining({
      source: POLICY_INTENT_SOURCES.NATIVE_INTENT,
      validation: expect.objectContaining({
        valid: true,
      }),
    }));
    expect(projection.policy_intent_read_trace).toEqual(expect.objectContaining({
      source: 'native_intent',
      status: 'native_intent_active',
      intent_version: 2,
    }));
    expect(projection.configuration_view.source).toBe('native_intent');
  });
});
