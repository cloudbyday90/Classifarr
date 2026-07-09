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
  buildPolicyCompatibilityDeletionExecutionPlan,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  buildPolicyCompatibilityDeletionExecutionGate,
} from '../../services/policyCompatibilityDeletionExecutionGate.mjs';
import {
  buildPolicyBuilderPhase8ControlledCompatibilityPathRemoval,
} from '../../services/policyBuilderPhase8ControlledCompatibilityPathRemoval.mjs';
import {
  PHASE8R_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS,
  PHASE8R_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS,
  buildPolicyBuilderPhase8ControlledRemovalApplyArtifact,
  validatePolicyBuilderPhase8ControlledRemovalApplyArtifact,
} from '../../services/policyBuilderPhase8ControlledRemovalApplyArtifact.mjs';

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

function readyReadiness() {
  return buildPolicyCompatibilityDeletionReadiness({
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
        replacement: `Phase 8R native replacement for ${categoryId}`,
        tests: ['server phase8r focused coverage'],
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
    approvedBy: 'phase8r-maintainer',
    ...overrides,
  });
}

function readyGate(executionPlan, overrides = {}) {
  return buildPolicyCompatibilityDeletionExecutionGate({
    executionPlan,
    worktreeClean: true,
    backupRestoreVerified: true,
    backupRestoreFresh: true,
    operatorApproval: {
      approved: true,
      approvedBy: 'phase8r-maintainer',
    },
    rollbackStanceFinal: true,
    supportStanceFinal: true,
    manifestFresh: true,
    manifestMatchesCurrentPlan: true,
    ...overrides,
  });
}

function readyRemovalBatch(overrides = {}) {
  const executionPlan = readyExecutionPlan();
  return buildPolicyBuilderPhase8ControlledCompatibilityPathRemoval({
    executionPlan,
    executionGate: readyGate(executionPlan),
    selectedPaths: [
      'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
    ],
    removalReason: 'First narrow removal review batch after native runtime parity.',
    reviewedBy: 'phase8r-maintainer',
    ...overrides,
  });
}

function applyInput(overrides = {}) {
  return {
    executeApply: true,
    operatorConfirmation: {
      confirmed: true,
      confirmedBy: 'phase8r-maintainer',
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

describe('policyBuilderPhase8ControlledRemovalApplyArtifact', () => {
  test('wraps an applied Phase 8R removal batch with bounded side effects', async () => {
    const artifact = await buildPolicyBuilderPhase8ControlledRemovalApplyArtifact({
      removalBatch: readyRemovalBatch(),
      input: applyInput(),
      applyAdapter: applyAdapter(),
      generatedAt: '2026-06-25T08:00:00.000Z',
    });

    expect(artifact.statusId)
      .toBe(PHASE8R_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS.APPLIED);
    expect(artifact.applied).toBe(true);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.applyResult.applied).toBe(true);
    expect(artifact.applySummary).toEqual({
      requestedCount: 1,
      appliedCount: 1,
      resultCount: 1,
    });
    expect(artifact.sideEffects).toEqual(expect.objectContaining({
      filesDeleted: true,
      filesArchived: false,
      storageChanged: false,
      gitCommandsRun: false,
    }));
  });

  test('blocks when explicit apply confirmation is missing', async () => {
    const artifact = await buildPolicyBuilderPhase8ControlledRemovalApplyArtifact({
      removalBatch: readyRemovalBatch(),
      input: applyInput({ executeApply: false }),
      applyAdapter: applyAdapter(),
    });

    expect(artifact.statusId)
      .toBe(PHASE8R_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.applied).toBe(false);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.applyResult.statusId).toBe('blocked_by_confirmation');
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS.APPLY_RESULT_BLOCKED,
      }),
    ]));
  });

  test('rejects forbidden side effects even when the apply result is otherwise applied', async () => {
    const artifact = await buildPolicyBuilderPhase8ControlledRemovalApplyArtifact({
      removalBatch: readyRemovalBatch(),
      input: applyInput(),
      applyAdapter: applyAdapter(),
      sideEffects: {
        storageChanged: true,
      },
    });

    expect(artifact.statusId)
      .toBe(PHASE8R_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.validation.ok).toBe(false);
    expect(artifact.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
        sideEffect: 'storageChanged',
      }),
    ]));
  });

  test('validates status and risk-count invariants', () => {
    const validation = validatePolicyBuilderPhase8ControlledRemovalApplyArtifact({
      statusId: 'unexpected',
      riskCount: 1,
      risks: [],
      sideEffects: {},
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS.UNKNOWN_STATUS,
      }),
      expect.objectContaining({
        riskId:
          PHASE8R_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS.RISK_COUNT_MISMATCH,
      }),
    ]));
  });
});
