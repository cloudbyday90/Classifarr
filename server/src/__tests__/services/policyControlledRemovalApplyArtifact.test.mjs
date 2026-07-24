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
  buildPolicyCompatibilityDeletionCurrentInventory,
} from '../../services/policyCompatibilityDeletionCurrentInventory.mjs';
import {
  buildPolicyCompatibilityDeletionReconciliationStateInventory,
} from '../../services/policyCompatibilityDeletionReconciliationStateInventory.mjs';
import {
  buildPolicyCompatibilityDeletionExecutionPlan,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  buildPolicyCompatibilityDeletionExecutionGate,
} from '../../services/policyCompatibilityDeletionExecutionGate.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  buildReadyExecutionGateOperatorEvidence,
  buildReadyExecutionGatePreflightEvidenceArtifact,
  buildReadyExecutionPlanArtifact,
} from './fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';
import {
  buildPolicyControlledCompatibilityPathRemoval,
} from '../../services/policyControlledCompatibilityPathRemoval.mjs';
import {
  POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS,
  POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS,
  buildPolicyControlledRemovalApplyArtifact,
  validatePolicyControlledRemovalApplyArtifact,
} from '../../services/policyControlledRemovalApplyArtifact.mjs';

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

function readyReadiness() {
  return buildPolicyCompatibilityDeletionReadiness({
    currentPolicyInventory: readyCurrentPolicyInventory(),
    reconciliationStateInventory: readyReconciliationStateInventory(),
    cutoverVerification: readyCutover(),
    deletionGatePlan: readyDeletionGates(),
    backupRestoreVerified: true,
    rollbackSupportVerified: true,
    supportDiagnosticsVerified: true,
    deletionManifestApproved: true,
  });
}

function replacementEvidence() {
  return Object.fromEntries(
    Object.values(POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS)
      .map(categoryId => [categoryId, {
        replacement: `Native policy replacement for ${categoryId}`,
        tests: ['server focused coverage'],
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

function readyExecutionPlanArtifact(executionPlan = readyExecutionPlan()) {
  return buildReadyExecutionPlanArtifact({ executionPlan });
}

function readyGate(executionPlanArtifact, {
  operatorEvidenceOverrides = {},
  preflightEvidenceArtifactOverrides = {},
  ...overrides
} = {}) {
  return buildPolicyCompatibilityDeletionExecutionGate({
    executionPlanArtifact,
    operatorEvidence: buildReadyExecutionGateOperatorEvidence({
      executionPlanArtifact,
      overrides: operatorEvidenceOverrides,
    }),
    preflightEvidenceArtifact: buildReadyExecutionGatePreflightEvidenceArtifact({
      executionPlanArtifact,
      overrides: preflightEvidenceArtifactOverrides,
    }),
    generatedAt: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    ...overrides,
  });
}

function readyRemovalBatch(overrides = {}) {
  const executionPlanArtifact = readyExecutionPlanArtifact();
  return buildPolicyControlledCompatibilityPathRemoval({
    executionPlanArtifact,
    executionGate: readyGate(executionPlanArtifact),
    selectedPaths: [
      'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
    ],
    removalReason: 'First narrow removal review batch after native runtime parity.',
    reviewedBy: 'policy-maintainer',
    ...overrides,
  });
}

function applyInput(overrides = {}) {
  return {
    executeApply: true,
    operatorConfirmation: {
      confirmed: true,
      confirmedBy: 'policy-maintainer',
    },
    ...overrides,
  };
}

function applyAdapter(overrides = {}) {
  return {
    async applyEntry(entry) {
      return {
        path: entry.path,
        actionId: entry.actionId,
        categoryId: entry.categoryId,
        applied: true,
        operationId: `apply:${entry.path}`,
        sideEffects: {
          filesDeleted: entry.actionId === 'delete_file',
          filesArchived: false,
          routesRemoved: false,
          testsRemoved: entry.actionId === 'remove_test',
          storageChanged: false,
          gitCommandsRun: false,
        },
      };
    },
    ...overrides,
  };
}

function verifiedPreApplyChangeDetector() {
  return async ({ entry }) => ({
    statusId: 'verified',
    verified: true,
    entry: {
      path: entry.path,
      actionId: entry.actionId,
    },
    riskCount: 0,
    risks: [],
    sideEffects: {
      filesDeleted: false,
      gitCommandsRun: false,
      storageChanged: false,
    },
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
  });
}

describe('policyControlledRemovalApplyArtifact', () => {
  test('wraps an applied controlled removal batch with bounded side effects', async () => {
    const artifact = await buildPolicyControlledRemovalApplyArtifact({
      removalBatch: readyRemovalBatch(),
      input: applyInput(),
      applyAdapter: applyAdapter(),
      preApplyChangeDetector: verifiedPreApplyChangeDetector(),
      generatedAt: '2026-06-25T08:00:00.000Z',
    });

    expect(artifact.statusId)
      .toBe(POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS.APPLIED);
    expect(artifact.applied).toBe(true);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.applyResult.applied).toBe(true);
    expect(artifact.applySummary).toEqual({
      requestedCount: 1,
      checkedCount: 1,
      appliedCount: 1,
      resultCount: 1,
      haltReasonId: null,
    });
    expect(artifact.sideEffects).toEqual(expect.objectContaining({
      filesDeleted: true,
      filesArchived: false,
      storageChanged: false,
      gitCommandsRun: false,
    }));
    expect(artifact.nextStep).toEqual(expect.objectContaining({
      stepId: 'post_removal_runtime_verification',
      label: 'Post-Removal Runtime Verification',
    }));
    expect(artifact.nextPhase).toBeUndefined();
  });

  test('blocks when explicit apply confirmation is missing', async () => {
    const artifact = await buildPolicyControlledRemovalApplyArtifact({
      removalBatch: readyRemovalBatch(),
      input: applyInput({ executeApply: false }),
      applyAdapter: applyAdapter(),
    });

    expect(artifact.statusId)
      .toBe(POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.applied).toBe(false);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.applyResult.statusId).toBe('blocked_by_confirmation');
    expect(artifact.nextStep).toEqual(expect.objectContaining({
      stepId: 'resolve_removal_apply_blocker',
      label: 'Resolve Removal Apply Blocker',
    }));
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS.APPLY_RESULT_BLOCKED,
      }),
    ]));
  });

  test('rejects forbidden side effects even when the apply result is otherwise applied', async () => {
    const artifact = await buildPolicyControlledRemovalApplyArtifact({
      removalBatch: readyRemovalBatch(),
      input: applyInput(),
      applyAdapter: applyAdapter(),
      preApplyChangeDetector: verifiedPreApplyChangeDetector(),
      sideEffects: {
        storageChanged: true,
      },
    });

    expect(artifact.statusId)
      .toBe(POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.validation.ok).toBe(false);
    expect(artifact.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
        sideEffect: 'storageChanged',
      }),
    ]));
  });

  test('validates status and risk-count invariants', () => {
    const validation = validatePolicyControlledRemovalApplyArtifact({
      statusId: 'unexpected',
      riskCount: 1,
      risks: [],
      sideEffects: {},
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS.UNKNOWN_STATUS,
      }),
      expect.objectContaining({
        riskId:
          POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS.RISK_COUNT_MISMATCH,
      }),
    ]));
  });
});
