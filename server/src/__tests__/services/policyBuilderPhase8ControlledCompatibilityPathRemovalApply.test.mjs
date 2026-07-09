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
  buildPolicyControlledCompatibilityPathRemoval,
} from '../../services/policyControlledCompatibilityPathRemoval.mjs';
import {
  PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS,
  PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
  applyPolicyBuilderPhase8ControlledCompatibilityPathRemoval,
  validatePolicyBuilderPhase8ControlledCompatibilityPathRemovalApply,
} from '../../services/policyBuilderPhase8ControlledCompatibilityPathRemovalApply.mjs';

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

function readyRemovalReview(overrides = {}) {
  const executionPlan = readyExecutionPlan();
  return buildPolicyControlledCompatibilityPathRemoval({
    executionPlan,
    executionGate: readyGate(executionPlan),
    selectedPaths: [
      'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
      'server/src/services/policyIntentImpactPreview.mjs',
    ],
    removalReason: 'First narrow removal review batch after native runtime parity.',
    reviewedBy: 'phase8r-maintainer',
    ...overrides,
  });
}

function operatorConfirmation(overrides = {}) {
  return {
    confirmed: true,
    confirmedBy: 'phase8r-maintainer',
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
          routesRemoved: entry.path.includes('/routes/'),
          testsRemoved: entry.actionId === 'remove_test',
          storageChanged: false,
          gitCommandsRun: false,
        },
      };
    },
    ...overrides,
  };
}

describe('policyBuilderPhase8ControlledCompatibilityPathRemovalApply', () => {
  test('applies a ready reviewed removal batch through the injected adapter', async () => {
    const applyResult = await applyPolicyBuilderPhase8ControlledCompatibilityPathRemoval({
      removalReview: readyRemovalReview(),
      executeApply: true,
      operatorConfirmation: operatorConfirmation(),
      applyAdapter: applyAdapter(),
    });

    expect(applyResult.statusId)
      .toBe(PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED);
    expect(applyResult.applied).toBe(true);
    expect(applyResult.validation.ok).toBe(true);
    expect(applyResult.removalReview).toEqual(expect.objectContaining({
      statusId: 'ready_for_removal_review',
      validationOk: true,
      readyForRemovalReview: true,
      selectedCount: 2,
    }));
    expect(applyResult.applyBatch).toEqual(expect.objectContaining({
      requestedCount: 2,
      appliedCount: 2,
    }));
    expect(applyResult.applyBatch.results).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
        applied: true,
      }),
      expect.objectContaining({
        path: 'server/src/services/policyIntentImpactPreview.mjs',
        applied: true,
      }),
    ]));
    expect(applyResult.sideEffects).toEqual(expect.objectContaining({
      filesDeleted: true,
      filesArchived: false,
      storageChanged: false,
      gitCommandsRun: false,
    }));
  });

  test('blocks when the removal review batch is not ready', async () => {
    const applyResult = await applyPolicyBuilderPhase8ControlledCompatibilityPathRemoval({
      removalReview: readyRemovalReview({ selectedPaths: [] }),
      executeApply: true,
      operatorConfirmation: operatorConfirmation(),
      applyAdapter: applyAdapter(),
    });

    expect(applyResult.statusId)
      .toBe(PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_REMOVAL_BATCH);
    expect(applyResult.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.REMOVAL_BATCH_NOT_READY,
      }),
    ]));
    expect(applyResult.applyBatch.appliedCount).toBe(0);
  });

  test('blocks without explicit execute flag and operator confirmation', async () => {
    const applyResult = await applyPolicyBuilderPhase8ControlledCompatibilityPathRemoval({
      removalReview: readyRemovalReview(),
      executeApply: false,
      operatorConfirmation: operatorConfirmation({
        confirmed: false,
        confirmedBy: '',
      }),
      applyAdapter: applyAdapter(),
    });

    expect(applyResult.statusId)
      .toBe(PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_CONFIRMATION);
    expect(applyResult.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_NOT_ENABLED,
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .OPERATOR_CONFIRMATION_MISSING,
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .OPERATOR_CONFIRMATION_ACTOR_MISSING,
    ]));
  });

  test('blocks without an apply adapter', async () => {
    const applyResult = await applyPolicyBuilderPhase8ControlledCompatibilityPathRemoval({
      removalReview: readyRemovalReview(),
      executeApply: true,
      operatorConfirmation: operatorConfirmation(),
      applyAdapter: null,
    });

    expect(applyResult.statusId)
      .toBe(PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_ADAPTER);
    expect(applyResult.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
          .APPLY_ADAPTER_MISSING,
      }),
    ]));
  });

  test('blocks when apply results do not match selected batch entries', async () => {
    const applyResult = await applyPolicyBuilderPhase8ControlledCompatibilityPathRemoval({
      removalReview: readyRemovalReview(),
      executeApply: true,
      operatorConfirmation: operatorConfirmation(),
      applyAdapter: applyAdapter({
        async applyEntry(entry) {
          return {
            path: `${entry.path}.wrong`,
            actionId: 'remove_test',
            applied: false,
            sideEffects: {},
          };
        },
      }),
    });

    expect(applyResult.statusId)
      .toBe(PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_APPLY_RESULT);
    expect(applyResult.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_RESULT_NOT_APPLIED,
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .APPLY_RESULT_PATH_MISMATCH,
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .APPLY_RESULT_ACTION_MISMATCH,
    ]));
  });

  test('blocks adapter failures with bounded error details', async () => {
    const applyResult = await applyPolicyBuilderPhase8ControlledCompatibilityPathRemoval({
      removalReview: readyRemovalReview(),
      executeApply: true,
      operatorConfirmation: operatorConfirmation(),
      applyAdapter: applyAdapter({
        async applyEntry(entry) {
          throw new Error(`cannot remove ${entry.path}`);
        },
      }),
    });

    expect(applyResult.statusId)
      .toBe(PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_ADAPTER);
    expect(applyResult.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_ADAPTER_FAILED,
      }),
    ]));
  });

  test('rejects archive, storage, or git side effects from apply results', async () => {
    const applyResult = await applyPolicyBuilderPhase8ControlledCompatibilityPathRemoval({
      removalReview: readyRemovalReview(),
      executeApply: true,
      operatorConfirmation: operatorConfirmation(),
      applyAdapter: applyAdapter({
        async applyEntry(entry) {
          return {
            path: entry.path,
            actionId: entry.actionId,
            applied: true,
            sideEffects: {
              filesDeleted: true,
              filesArchived: true,
              storageChanged: true,
              gitCommandsRun: true,
            },
          };
        },
      }),
    });

    expect(applyResult.statusId)
      .toBe(PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_APPLY_RESULT);
    expect(applyResult.validation.ok).toBe(false);
    expect(applyResult.risks.map(risk => risk.riskId)).toContain(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.UNEXPECTED_SIDE_EFFECT
    );
  });

  test('rejects mutated apply output with stale risk count or unexpected side effects', () => {
    const validation = validatePolicyBuilderPhase8ControlledCompatibilityPathRemovalApply({
      statusId: PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED,
      riskCount: 99,
      risks: [],
      sideEffects: {
        filesDeleted: true,
        filesArchived: true,
        routesRemoved: false,
        testsRemoved: false,
        storageChanged: true,
        gitCommandsRun: true,
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.RISK_COUNT_MISMATCH,
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.UNEXPECTED_SIDE_EFFECT,
    ]));
  });
});
