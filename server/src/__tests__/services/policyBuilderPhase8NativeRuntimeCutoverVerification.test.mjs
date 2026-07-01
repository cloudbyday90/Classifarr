import {
  PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS,
  PHASE8R_NATIVE_RUNTIME_CUTOVER_STATUS_IDS,
  buildPolicyBuilderPhase8NativeRuntimeCutoverVerification,
} from '../../services/policyBuilderPhase8NativeRuntimeCutoverVerification.mjs';

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

describe('policyBuilderPhase8NativeRuntimeCutoverVerification', () => {
  test('verifies native read cutover while preserving unconverted fallback', () => {
    const verification = buildPolicyBuilderPhase8NativeRuntimeCutoverVerification({
      convertedPolicy: nativePolicy(),
      unconvertedPolicy: policy({ id: 15 }),
      rollbackAvailable: true,
      legacyDeletionBlocked: true,
      supportDiagnosticsSafe: true,
    });

    expect(verification.statusId)
      .toBe(PHASE8R_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.READY_FOR_CUTOVER_MONITORING);
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
  });

  test('blocks when converted policy does not read from native intent', () => {
    const verification = buildPolicyBuilderPhase8NativeRuntimeCutoverVerification({
      convertedPolicy: policy(),
      unconvertedPolicy: policy({ id: 15 }),
      rollbackAvailable: true,
    });

    expect(verification.statusId)
      .toBe(PHASE8R_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.BLOCKED_BY_NATIVE_READ);
    expect(verification.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS.CONVERTED_POLICY_NOT_NATIVE,
      }),
    ]));
  });

  test('blocks when rollback availability or deletion gates are missing', () => {
    const verification = buildPolicyBuilderPhase8NativeRuntimeCutoverVerification({
      convertedPolicy: nativePolicy(),
      unconvertedPolicy: policy({ id: 15 }),
      rollbackAvailable: false,
      legacyDeletionBlocked: false,
      supportDiagnosticsSafe: false,
    });

    expect(verification.statusId)
      .toBe(PHASE8R_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.BLOCKED_BY_ROLLBACK);
    expect(verification.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS.ROLLBACK_NOT_AVAILABLE,
      PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS.LEGACY_DELETION_NOT_BLOCKED,
      PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS.SUPPORT_DIAGNOSTICS_NOT_SAFE,
    ]));
  });
});
