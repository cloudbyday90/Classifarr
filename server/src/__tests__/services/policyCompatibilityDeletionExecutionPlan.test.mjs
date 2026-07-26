import {
  POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS,
  POLICY_COMPATIBILITY_DELETION_COVERAGE_IDS,
  POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS,
  buildPolicyCompatibilityDeletionGates,
} from '../../services/policyCompatibilityDeletionGates.mjs';
import {
  buildPolicyNativeRuntimeCutoverVerification,
} from '../../services/policyNativeRuntimeCutoverVerification.mjs';
import {
  buildPolicyCompatibilityDeletionReadiness,
} from '../../services/policyCompatibilityDeletionReadiness.mjs';
import {
  buildPolicyBackupRestoreVerificationEvidence,
} from '../../services/policyBackupRestoreVerificationEvidence.mjs';
import {
  buildPolicyCompatibilityDeletionCurrentInventory,
} from '../../services/policyCompatibilityDeletionCurrentInventory.mjs';
import {
  buildPolicyCompatibilityDeletionReconciliationStateInventory,
} from '../../services/policyCompatibilityDeletionReconciliationStateInventory.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
  buildPolicyCompatibilityDeletionExecutionPlan,
  validatePolicyCompatibilityDeletionExecutionPlan,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  buildReadyPolicyCompatibilityDeletionReleasePrerequisiteEvidence,
} from '../helpers/policyCompatibilityDeletionReleasePrerequisiteEvidence.mjs';

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
    requiresMaintenanceStateCount: 0,
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

function readyReconciliationStateInventory() {
  return buildPolicyCompatibilityDeletionReconciliationStateInventory({
    requiresMaintenanceStateCount: 0,
  });
}

function readyBackupRestoreEvidence() {
  const verifiedAt = '2026-07-25T12:00:00.000Z';

  return buildPolicyBackupRestoreVerificationEvidence({
    generatedAt: verifiedAt,
    record: {
      verification_version: 1,
      restore_mode: 'replace',
      backup_version: '2.0',
      verification_status: 'verified',
      schema_parity_verified: true,
      native_authority_verified: true,
      policy_library_mismatch_count: 0,
      verified_at: verifiedAt,
      restore_gate_state: 'ready',
      restore_gate_reason_id: 'restore_verified',
      restore_gate_verified_at: verifiedAt,
    },
  });
}

function readyReadiness() {
  const evidence = {
    currentPolicyInventory: readyCurrentPolicyInventory(),
    reconciliationStateInventory: readyReconciliationStateInventory(),
    cutoverVerification: readyCutover(),
    deletionGatePlan: readyDeletionGates(),
    backupRestoreEvidence: readyBackupRestoreEvidence(),
  };

  return buildPolicyCompatibilityDeletionReadiness({
    ...evidence,
    releasePrerequisiteEvidence:
      buildReadyPolicyCompatibilityDeletionReleasePrerequisiteEvidence(evidence),
  });
}

function replacementEvidence() {
  return Object.fromEntries(
    Object.values(POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS)
      .map(categoryId => [categoryId, {
        replacement: `Native policy replacement for ${categoryId}`,
        tests: ['server focused compatibility-deletion coverage'],
      }])
  );
}

function readyExecutionPlan(overrides = {}) {
  return buildPolicyCompatibilityDeletionExecutionPlan({
    deletionReadiness: readyReadiness(),
    deletionGatePlan: readyDeletionGates(),
    replacementEvidence: replacementEvidence(),
    rollbackStance: 'Rollback snapshots retained until post-window support stance is approved.',
    supportStance: 'Converted native policies use bounded support diagnostics.',
    manifestApproved: true,
    approvedBy: 'policy-maintainer',
    ...overrides,
  });
}

describe('policyCompatibilityDeletionExecutionPlan', () => {
  test('builds an approved side-effect-free execution manifest from deletion categories', () => {
    const plan = readyExecutionPlan();

    expect(plan.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE);
    expect(plan.readyForExecutionGate).toBe(true);
    expect(plan.validation.ok).toBe(true);
    expect(plan.manifest).toEqual(expect.objectContaining({
      approved: true,
      approvedBy: 'policy-maintainer',
      entryCount: 16,
    }));
    expect(plan.manifest.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        categoryId: POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS.CLIENT_BRIDGE_UI,
        actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.DELETE_FILE,
        path: 'client/src/components/policies/PolicyPresetMigrationNotice.vue',
        ready: true,
      }),
      expect.objectContaining({
        categoryId: POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS.STALE_COMPATIBILITY_TESTS,
        actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_TEST,
        ready: true,
      }),
    ]));
    expect(plan.executionPolicy).toEqual(expect.objectContaining({
      executeDeletionNow: false,
      requireSeparateExecutionGate: true,
      requireCleanWorktreeBeforeExecution: true,
    }));
    expect(plan.readiness.currentPolicyInventory).toEqual(expect.objectContaining({
      statusId: 'all_enabled_policies_native',
      validationOk: true,
      unconvertedPolicyCount: 0,
    }));
    expect(plan.nextStep).toEqual(expect.objectContaining({
      stepId: 'compatibility_deletion_execution_gate',
      label: 'Compatibility Path Deletion Execution Gate',
    }));
    expect(plan.nextPhase).toBeUndefined();
    expect(Object.values(plan.sideEffects).some(Boolean)).toBe(false);
  });

  test('blocks execution planning when compatibility deletion readiness has not passed', () => {
    const plan = readyExecutionPlan({
      deletionReadiness: buildPolicyCompatibilityDeletionReadiness(),
    });

    expect(plan.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.BLOCKED_BY_READINESS);
    expect(plan.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.READINESS_NOT_READY,
      }),
    ]));
  });

  test('blocks execution planning when manifest entries lack replacement evidence', () => {
    const plan = readyExecutionPlan({
      replacementEvidence: {
        [POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS.CLIENT_BRIDGE_UI]: {
          replacement: 'Only one category has evidence.',
        },
      },
    });

    expect(plan.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS
        .BLOCKED_BY_MANIFEST_EVIDENCE);
    expect(plan.risks.map(risk => risk.riskId)).toContain(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.MISSING_REPLACEMENT_EVIDENCE
    );
    expect(plan.manifest.entries.some(entry => entry.ready === false)).toBe(true);
  });

  test('blocks execution planning without rollback stance, support stance, or manifest approval', () => {
    const plan = readyExecutionPlan({
      rollbackStance: null,
      supportStance: null,
      manifestApproved: false,
    });

    expect(plan.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.BLOCKED_BY_APPROVAL);
    expect(plan.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.MISSING_ROLLBACK_STANCE,
      POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.MISSING_SUPPORT_STANCE,
      POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.MANIFEST_NOT_APPROVED,
    ]));
  });

  test('rejects mutated execution plan output with side effects or stale risk count', () => {
    const plan = readyExecutionPlan();
    const validation = validatePolicyCompatibilityDeletionExecutionPlan({
      ...plan,
      riskCount: 99,
      sideEffects: {
        ...plan.sideEffects,
        filesDeleted: true,
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.RISK_COUNT_MISMATCH,
      POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });
});
