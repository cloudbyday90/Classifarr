import {
  POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS,
  POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS,
  buildPolicyNativeRuntimeCutoverVerification,
} from '../../services/policyNativeRuntimeCutoverVerification.mjs';

function policy(overrides = {}) {
  return {
    id: 14,
    library_id: 4,
    library_name: 'Animated Movies',
    library_media_type: 'movie',
    name: 'Animated Policy',
    presets: [{
      id: 7,
      key: 'family',
      name: 'Family',
      signals: {
        genres: { require_any: ['Family'] },
      },
      custom_signals: null,
    }],
    ...overrides,
  };
}

function nativePolicy(overrides = {}) {
  return policy({
    native_intent: {
      active: true,
      intent_version: 2,
      contract: {
        schema_version: 1,
        policy_id: 14,
        library_id: 4,
        library_name: 'Animated Movies',
        library_media_type: 'movie',
        source: 'native_intent',
        inference_state: 'inferred',
        model: {
          mode: 'native_intent',
          intent_supported: true,
          native_intent: true,
          conversion_available: false,
        },
        purpose: [{
          intent_role: 'purpose',
          signal_type: 'genres',
          operator: 'require_any',
          values: { require_any: ['Animation'] },
          constraint_mode: 'advisory',
          semantics: 'identity',
          source: 'native_intent',
          inference_state: 'inferred',
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
    ...overrides,
  });
}

describe('policyNativeRuntimeCutoverVerification', () => {
  test('verifies native read cutover while preserving unconverted fallback', () => {
    const verification = buildPolicyNativeRuntimeCutoverVerification({
      convertedPolicy: nativePolicy(),
      unconvertedPolicy: policy({ id: 15 }),
      rollbackAvailable: true,
      legacyDeletionBlocked: true,
      supportDiagnosticsSafe: true,
    });

    expect(verification.statusId)
      .toBe(POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.READY_FOR_CUTOVER_MONITORING);
    expect(verification.version).toBe('policy.native_runtime_cutover_verification.v1');
    expect(verification.validation.ok).toBe(true);
    expect(verification.convertedRead).toEqual(expect.objectContaining({
      sourceId: 'native_intent',
      statusId: 'native_intent_active',
      validationOk: true,
      dependsOnCustomSignals: false,
    }));
    expect(verification.unconvertedRead).toEqual(expect.objectContaining({
      sourceId: 'compatibility_bridge',
      statusId: 'compatibility_bridge_fallback',
      validationOk: true,
      dependsOnCustomSignals: true,
    }));
    expect(Object.values(verification.sideEffects).some(Boolean)).toBe(false);
    expect(verification.nextStep).toEqual(expect.objectContaining({
      stepId: 'compatibility_path_deletion_readiness',
    }));
    expect(verification.nextPhase).toBeUndefined();
  });

  test('blocks when converted policy does not read from native intent', () => {
    const verification = buildPolicyNativeRuntimeCutoverVerification({
      convertedPolicy: policy(),
      unconvertedPolicy: policy({ id: 15 }),
      rollbackAvailable: true,
    });

    expect(verification.statusId)
      .toBe(POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.BLOCKED_BY_NATIVE_READ);
    expect(verification.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.CONVERTED_POLICY_NOT_NATIVE,
      }),
    ]));
  });

  test('evaluates each supplied policy and does not synthesize an unconverted read', () => {
    const verification = buildPolicyNativeRuntimeCutoverVerification({
      convertedPolicies: [nativePolicy(), policy({ id: 16 })],
      unconvertedPolicies: [],
      rollbackAvailable: true,
      legacyDeletionBlocked: true,
      supportDiagnosticsSafe: true,
    });

    expect(verification.statusId)
      .toBe(POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.BLOCKED_BY_NATIVE_READ);
    expect(verification.convertedRead).toEqual(expect.objectContaining({
      assessed: true,
      assessedPolicyCount: 2,
      invalidPolicyCount: 1,
      sampleInvalidPolicyIds: [16],
    }));
    expect(verification.unconvertedRead).toEqual(expect.objectContaining({
      assessed: false,
      assessedPolicyCount: 0,
      sourceId: null,
    }));
    expect(verification.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.CONVERTED_POLICY_NOT_NATIVE,
        policyId: 16,
      }),
    ]));
  });

  test('blocks cutover when native authority is ambiguous', () => {
    const verification = buildPolicyNativeRuntimeCutoverVerification({
      convertedPolicy: nativePolicy({
        native_intent_authority: {
          stateId: 'ambiguous_active_native_intents',
          activeIntentCount: 2,
        },
      }),
      unconvertedPolicy: policy({ id: 15 }),
      rollbackAvailable: true,
      legacyDeletionBlocked: true,
      supportDiagnosticsSafe: true,
    });

    expect(verification.statusId)
      .toBe(POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.BLOCKED_BY_NATIVE_READ);
    expect(verification.convertedRead).toEqual(expect.objectContaining({
      sourceId: 'native_intent',
      statusId: 'native_intent_authority_conflict',
      validationOk: true,
      dependsOnCustomSignals: false,
    }));
    expect(verification.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.CONVERTED_NATIVE_READ_INVALID,
      }),
    ]));
  });

  test('blocks when rollback availability or deletion gates are missing', () => {
    const verification = buildPolicyNativeRuntimeCutoverVerification({
      convertedPolicy: nativePolicy(),
      unconvertedPolicy: policy({ id: 15 }),
      rollbackAvailable: false,
      legacyDeletionBlocked: false,
      supportDiagnosticsSafe: false,
    });

    expect(verification.statusId)
      .toBe(POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.BLOCKED_BY_ROLLBACK);
    expect(verification.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.ROLLBACK_NOT_AVAILABLE,
      POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.LEGACY_DELETION_NOT_BLOCKED,
      POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.SUPPORT_DIAGNOSTICS_NOT_SAFE,
    ]));
  });
});
