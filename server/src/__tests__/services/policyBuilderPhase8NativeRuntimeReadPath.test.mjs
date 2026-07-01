import {
  POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
  POLICY_INTENT_INFERENCE_STATES,
  POLICY_INTENT_ROLES,
  POLICY_INTENT_SOURCES,
} from '../../services/policyIntentSchema.mjs';
import {
  PHASE8R_RUNTIME_READ_AUDIT_RISK_IDS,
  PHASE8R_RUNTIME_READ_SOURCE_IDS,
  PHASE8R_RUNTIME_READ_STATUS_IDS,
  buildPolicyBuilderPhase8NativeRuntimeReadPath,
  buildPolicyBuilderPhase8NativeRuntimeReadPathAudit,
  validatePolicyBuilderPhase8NativeRuntimeReadPath,
} from '../../services/policyBuilderPhase8NativeRuntimeReadPath.mjs';

function policy(overrides = {}) {
  return {
    id: 14,
    library_id: 4,
    library_name: 'Animated Movies',
    library_media_type: 'movie',
    auto_classify_threshold: 85,
    prompt_threshold: 60,
    require_ai_validation: true,
    trust_patterns: true,
    trust_rag: true,
    trust_history: true,
    combination_mode: 'best_match',
    presets: [
      {
        id: 7,
        key: 'family',
        name: 'Family',
        source: 'builtin',
        weight: 1,
        signals: {
          genres: { require_any: ['Family'] },
        },
        custom_signals: {
          genres: {
            require_any: ['Animation'],
          },
        },
      },
    ],
    ...overrides,
  };
}

function nativeContract(overrides = {}) {
  return {
    schema_version: POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
    policy_id: 14,
    library_id: 4,
    library_name: 'Animated Movies',
    library_media_type: 'movie',
    source: POLICY_INTENT_SOURCES.NATIVE_INTENT,
    inference_state: POLICY_INTENT_INFERENCE_STATES.INFERRED,
    model: {
      mode: 'native_intent',
      intent_supported: true,
      native_intent: true,
      conversion_available: false,
    },
    purpose: [
      {
        intent_role: POLICY_INTENT_ROLES.PURPOSE,
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['Animation'] },
        constraint_mode: 'advisory',
        semantics: 'identity',
        source: 'native',
        inference_state: POLICY_INTENT_INFERENCE_STATES.INFERRED,
      },
    ],
    hard_limits: [],
    helpful_hints: [],
    avoid: [],
    review_behavior: {},
    template_links: [],
    warnings: [],
    unsupported_signals: [],
    ...overrides,
  };
}

describe('policyBuilderPhase8NativeRuntimeReadPath', () => {
  test('uses compatibility bridge for unconverted policies and emits source trace', () => {
    const readPath = buildPolicyBuilderPhase8NativeRuntimeReadPath({
      policy: policy(),
    });

    expect(readPath.validation.ok).toBe(true);
    expect(readPath.sourceId).toBe(PHASE8R_RUNTIME_READ_SOURCE_IDS.COMPATIBILITY_BRIDGE);
    expect(readPath.statusId)
      .toBe(PHASE8R_RUNTIME_READ_STATUS_IDS.COMPATIBILITY_BRIDGE_FALLBACK);
    expect(readPath.policy_intent_contract.source).toBe(POLICY_INTENT_SOURCES.LEGACY_PRESETS);
    expect(readPath.dependsOnCustomSignals).toBe(true);
    expect(readPath.trace).toEqual(expect.objectContaining({
      source: PHASE8R_RUNTIME_READ_SOURCE_IDS.COMPATIBILITY_BRIDGE,
      status: PHASE8R_RUNTIME_READ_STATUS_IDS.COMPATIBILITY_BRIDGE_FALLBACK,
      policy_id: 14,
    }));
    expect(readPath.trace.attributes['classifarr.phase8r.read.source'])
      .toBe(PHASE8R_RUNTIME_READ_SOURCE_IDS.COMPATIBILITY_BRIDGE);
  });

  test('uses active native intent over legacy custom signals for converted policies', () => {
    const readPath = buildPolicyBuilderPhase8NativeRuntimeReadPath({
      policy: policy({
        native_intent: {
          active: true,
          intent_version: 3,
          contract: nativeContract(),
        },
      }),
    });

    expect(readPath.validation.ok).toBe(true);
    expect(readPath.sourceId).toBe(PHASE8R_RUNTIME_READ_SOURCE_IDS.NATIVE_INTENT);
    expect(readPath.statusId).toBe(PHASE8R_RUNTIME_READ_STATUS_IDS.NATIVE_INTENT_ACTIVE);
    expect(readPath.dependsOnCustomSignals).toBe(false);
    expect(readPath.sideEffects).toEqual(expect.objectContaining({
      policyStorageMutated: false,
      nativeRowsRead: true,
      compatibilityProjectionBuilt: false,
      legacyRowsDeleted: false,
    }));
    expect(readPath.policy_intent_contract).toEqual(expect.objectContaining({
      source: POLICY_INTENT_SOURCES.NATIVE_INTENT,
      validation: expect.objectContaining({
        valid: true,
        error_count: 0,
      }),
      model: expect.objectContaining({
        mode: 'native_intent',
        native_intent: true,
      }),
    }));
    expect(readPath.policy_intent_contract.purpose[0].values)
      .toEqual({ require_any: ['Animation'] });
    expect(readPath.trace.attributes['classifarr.phase8r.read.intent_version']).toBe(3);
  });

  test('keeps invalid native intent on native source instead of falling back to compatibility', () => {
    const readPath = buildPolicyBuilderPhase8NativeRuntimeReadPath({
      policy: policy({
        native_intent_contract: nativeContract({
          purpose: [
            {
              intent_role: POLICY_INTENT_ROLES.PURPOSE,
              signal_type: 'certifications',
              operator: 'max',
              values: { max: 'R' },
              constraint_mode: 'strict',
              semantics: 'compatibility',
            },
          ],
        }),
        native_intent_active: true,
        native_intent_version: 2,
      }),
    });

    expect(readPath.sourceId).toBe(PHASE8R_RUNTIME_READ_SOURCE_IDS.NATIVE_INTENT);
    expect(readPath.statusId).toBe(PHASE8R_RUNTIME_READ_STATUS_IDS.NATIVE_INTENT_INVALID);
    expect(readPath.validation.ok).toBe(true);
    expect(readPath.dependsOnCustomSignals).toBe(false);
    expect(readPath.policy_intent_contract.validation.valid).toBe(false);
    expect(readPath.policy_intent_contract.validation.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'purpose_requires_identity_capable_signal',
      }),
    ]));
  });

  test('preserves required policy intent contract shape for native and compatibility reads', () => {
    const compatibility = buildPolicyBuilderPhase8NativeRuntimeReadPath({
      policy: policy(),
    });
    const native = buildPolicyBuilderPhase8NativeRuntimeReadPath({
      policy: policy({
        native_intent: {
          active: true,
          contract: nativeContract(),
        },
      }),
    });

    expect(Object.keys(native.policy_intent_contract).sort())
      .toEqual(Object.keys(compatibility.policy_intent_contract).sort());
  });

  test('validation rejects source trace mismatch and native custom signal dependency', () => {
    const readPath = buildPolicyBuilderPhase8NativeRuntimeReadPath({
      policy: policy({
        native_intent: {
          active: true,
          contract: nativeContract(),
        },
      }),
    });
    const weakened = {
      ...readPath,
      dependsOnCustomSignals: true,
      trace: {
        ...readPath.trace,
        source: PHASE8R_RUNTIME_READ_SOURCE_IDS.COMPATIBILITY_BRIDGE,
        attributes: {
          ...readPath.trace.attributes,
          'classifarr.phase8r.read.source': PHASE8R_RUNTIME_READ_SOURCE_IDS.COMPATIBILITY_BRIDGE,
        },
      },
      sideEffects: {
        ...readPath.sideEffects,
        policyStorageMutated: true,
      },
    };
    const riskIds = validatePolicyBuilderPhase8NativeRuntimeReadPath(weakened)
      .issues
      .map(issue => issue.riskId);

    expect(riskIds).toEqual(expect.arrayContaining([
      PHASE8R_RUNTIME_READ_AUDIT_RISK_IDS.SOURCE_TRACE_MISMATCH,
      PHASE8R_RUNTIME_READ_AUDIT_RISK_IDS.NATIVE_READ_DEPENDS_ON_CUSTOM_SIGNALS,
      PHASE8R_RUNTIME_READ_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });

  test('audits cleanly and points to rollback snapshot work next', () => {
    const readPath = buildPolicyBuilderPhase8NativeRuntimeReadPath({
      policy: policy({
        native_intent: {
          active: true,
          contract: nativeContract(),
        },
      }),
    });
    const audit = buildPolicyBuilderPhase8NativeRuntimeReadPathAudit(readPath);

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      sourceId: PHASE8R_RUNTIME_READ_SOURCE_IDS.NATIVE_INTENT,
      nextPhase: expect.objectContaining({
        phaseId: '8r_5',
      }),
    }));
  });
});
