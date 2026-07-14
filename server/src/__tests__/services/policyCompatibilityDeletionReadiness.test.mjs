import {
  POLICY_COMPATIBILITY_DELETION_COVERAGE_IDS,
  POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS,
  buildPolicyCompatibilityDeletionGates,
} from '../../services/policyCompatibilityDeletionGates.mjs';
import {
  buildPolicyNativeRuntimeCutoverVerification,
} from '../../services/policyNativeRuntimeCutoverVerification.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS,
  buildPolicyCompatibilityDeletionReadiness,
  validatePolicyCompatibilityDeletionReadiness,
} from '../../services/policyCompatibilityDeletionReadiness.mjs';
import {
  buildPolicyCompatibilityDeletionCurrentInventory,
} from '../../services/policyCompatibilityDeletionCurrentInventory.mjs';

function buildCompleteCoverage() {
  return Object.fromEntries(
    Object.values(POLICY_COMPATIBILITY_DELETION_COVERAGE_IDS)
      .map(coverageId => [coverageId, true])
  );
}

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

function readyCutover() {
  return buildPolicyNativeRuntimeCutoverVerification({
    convertedPolicy: nativePolicy(),
    unconvertedPolicy: policy({ id: 15 }),
    rollbackAvailable: true,
    legacyDeletionBlocked: true,
    supportDiagnosticsSafe: true,
  });
}

function readyDeletionGates() {
  return buildPolicyCompatibilityDeletionGates({
    coverage: buildCompleteCoverage(),
    supportStanceId:
      POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS.UNSUPPORTED_AFTER_WINDOW,
    unconvertedPolicyCount: 0,
  });
}

function readyCurrentPolicyInventory() {
  return buildPolicyCompatibilityDeletionCurrentInventory({
    policyRows: [{
      policy_id: 14,
      active_intent_count: 1,
      authoritative_native_intent_count: 1,
      active_intent_sources: ['native_intent'],
      active_intent_validation_statuses: ['valid'],
    }],
  });
}

function readyReadiness(overrides = {}) {
  return buildPolicyCompatibilityDeletionReadiness({
    currentPolicyInventory: readyCurrentPolicyInventory(),
    cutoverVerification: readyCutover(),
    deletionGatePlan: readyDeletionGates(),
    backupRestoreVerified: true,
    rollbackSupportVerified: true,
    supportDiagnosticsVerified: true,
    deletionManifestApproved: true,
    ...overrides,
  });
}

describe('policyCompatibilityDeletionReadiness', () => {
  test('marks compatibility path deletion ready only after cutover, gates, and safety confirmations pass', () => {
    const readiness = readyReadiness();

    expect(readiness.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS
        .READY_FOR_DELETION_EXECUTION_PLAN);
    expect(readiness.readyForDeletionExecutionPlan).toBe(true);
    expect(readiness.validation.ok).toBe(true);
    expect(readiness.cutover).toEqual(expect.objectContaining({
      statusId: 'ready_for_cutover_monitoring',
      validationOk: true,
    }));
    expect(readiness.deletionGates).toEqual(expect.objectContaining({
      statusId: 'ready_to_delete',
      readyToDelete: true,
      validationOk: true,
      blockerCount: 0,
    }));
    expect(readiness.currentPolicyInventory).toEqual(expect.objectContaining({
      statusId: 'all_enabled_policies_native',
      validationOk: true,
      unconvertedPolicyCount: 0,
    }));
    expect(readiness.deletionPolicy).toEqual(expect.objectContaining({
      executeDeletionNow: false,
      requireExecutionPlan: true,
    }));
    expect(readiness.nextStep).toEqual(expect.objectContaining({
      stepId: 'compatibility_deletion_execution_plan',
      label: 'Compatibility Path Deletion Execution Plan',
    }));
    expect(readiness.nextPhase).toBeUndefined();
    expect(Object.values(readiness.sideEffects).some(Boolean)).toBe(false);
  });

  test('blocks readiness when runtime cutover is not ready', () => {
    const readiness = readyReadiness({
      cutoverVerification: buildPolicyNativeRuntimeCutoverVerification({
        convertedPolicy: policy(),
        unconvertedPolicy: policy({ id: 15 }),
        rollbackAvailable: true,
        legacyDeletionBlocked: true,
        supportDiagnosticsSafe: true,
      }),
    });

    expect(readiness.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS
        .BLOCKED_BY_RUNTIME_CUTOVER);
    expect(readiness.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.CUTOVER_NOT_READY,
      }),
    ]));
  });

  test('blocks readiness until current enabled-policy conversion evidence is supplied', () => {
    const readiness = buildPolicyCompatibilityDeletionReadiness({
      cutoverVerification: readyCutover(),
      deletionGatePlan: readyDeletionGates(),
      backupRestoreVerified: true,
      rollbackSupportVerified: true,
      supportDiagnosticsVerified: true,
      deletionManifestApproved: true,
    });

    expect(readiness.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS
        .BLOCKED_BY_CURRENT_POLICY_INVENTORY);
    expect(readiness.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS
          .CURRENT_POLICY_INVENTORY_MISSING,
      }),
    ]));
  });

  test('blocks readiness when deletion gates are not ready', () => {
    const readiness = readyReadiness({
      deletionGatePlan: buildPolicyCompatibilityDeletionGates({
        coverage: buildCompleteCoverage(),
        supportStanceId:
          POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS.UNSUPPORTED_AFTER_WINDOW,
        unconvertedPolicyCount: 2,
      }),
    });

    expect(readiness.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS
        .BLOCKED_BY_DELETION_GATES);
    expect(readiness.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.DELETION_GATES_NOT_READY,
      }),
    ]));
  });

  test('blocks readiness while residual compatibility references remain', () => {
    const readiness = readyReadiness({
      residualCompatibilityReferences: [{
        path: 'server/src/services/policyIntentMapper.mjs',
        reason: 'Preset fallback still used by unconverted policy support.',
        owner: 'phase8r',
      }],
    });

    expect(readiness.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS
        .BLOCKED_BY_RESIDUAL_COMPATIBILITY_REFERENCES);
    expect(readiness.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS
          .RESIDUAL_COMPATIBILITY_REFERENCE,
        path: 'server/src/services/policyIntentMapper.mjs',
      }),
    ]));
  });

  test('blocks readiness until backup, rollback, diagnostics, and manifest confirmations pass', () => {
    const readiness = buildPolicyCompatibilityDeletionReadiness({
      currentPolicyInventory: readyCurrentPolicyInventory(),
      cutoverVerification: readyCutover(),
      deletionGatePlan: readyDeletionGates(),
      backupRestoreVerified: false,
      rollbackSupportVerified: false,
      supportDiagnosticsVerified: false,
      deletionManifestApproved: false,
    });

    expect(readiness.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS
        .BLOCKED_BY_SAFETY_CONFIRMATION);
    expect(readiness.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.BACKUP_RESTORE_NOT_VERIFIED,
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.ROLLBACK_SUPPORT_NOT_VERIFIED,
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.SUPPORT_DIAGNOSTICS_NOT_VERIFIED,
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.DELETION_MANIFEST_NOT_APPROVED,
    ]));
  });

  test('rejects mutated readiness output with side effects or stale risk count', () => {
    const readiness = readyReadiness();
    const validation = validatePolicyCompatibilityDeletionReadiness({
      ...readiness,
      riskCount: 99,
      sideEffects: {
        ...readiness.sideEffects,
        filesDeleted: true,
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.RISK_COUNT_MISMATCH,
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });
});
