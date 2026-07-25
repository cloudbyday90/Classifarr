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
  buildReadyBackupRestoreVerificationEvidence,
  buildReadyExecutionGateOperatorEvidence,
  buildReadyExecutionGatePreflightEvidenceArtifact,
  buildReadyExecutionGateRecoveryEvidence,
  buildReadyExecutionPlanArtifact,
} from './fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';
import {
  buildPolicyControlledCompatibilityPathRemoval,
} from '../../services/policyControlledCompatibilityPathRemoval.mjs';
import {
  buildPolicyControlledCompatibilityPathRemovalReviewArtifact,
} from '../../services/policyControlledCompatibilityPathRemovalReviewArtifact.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
  applyPolicyControlledCompatibilityPathRemoval,
  validatePolicyControlledCompatibilityPathRemovalApply,
} from '../../services/policyControlledCompatibilityPathRemovalApply.mjs';

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
    backupRestoreEvidence: buildReadyBackupRestoreVerificationEvidence(),
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
  recoveryEvidenceOverrides = {},
  operatorEvidenceOverrides = {},
  preflightEvidenceArtifactOverrides = {},
  ...overrides
} = {}) {
  return buildPolicyCompatibilityDeletionExecutionGate({
    executionPlanArtifact,
    recoveryEvidence: buildReadyExecutionGateRecoveryEvidence({
      executionPlanArtifact,
      overrides: recoveryEvidenceOverrides,
    }),
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

function readyRemovalReview(overrides = {}) {
  const executionPlanArtifact = readyExecutionPlanArtifact();
  return buildPolicyControlledCompatibilityPathRemoval({
    executionPlanArtifact,
    executionGate: readyGate(executionPlanArtifact),
    selectedPaths: [
      'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
      'server/src/services/policyIntentMapper.mjs',
    ],
    removalReason: 'First narrow removal review batch after native runtime parity.',
    reviewedBy: 'policy-maintainer',
    ...overrides,
  });
}

function operatorConfirmation(overrides = {}) {
  return {
    confirmed: true,
    confirmedBy: 'policy-maintainer',
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

function verifiedPreApplyChangeDetector(overrides = {}) {
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
    ...overrides,
  });
}

describe('policyControlledCompatibilityPathRemovalApply', () => {
  test('applies a ready reviewed removal batch through the injected adapter', async () => {
    const applyResult = await applyPolicyControlledCompatibilityPathRemoval({
      removalReview: readyRemovalReview(),
      executeApply: true,
      operatorConfirmation: operatorConfirmation(),
      applyAdapter: applyAdapter(),
      preApplyChangeDetector: verifiedPreApplyChangeDetector(),
    });

    expect(applyResult.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED);
    expect(applyResult.applied).toBe(true);
    expect(applyResult.validation.ok).toBe(true);
    expect(applyResult.removalReview).toEqual(expect.objectContaining({
      statusId: 'ready_for_removal_review',
      validationOk: true,
      readyForRemovalReview: true,
      selectedCount: 2,
      reviewArtifactFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(applyResult.applyBatch).toEqual(expect.objectContaining({
      requestedCount: 2,
      appliedCount: 2,
      haltReasonId: null,
    }));
    expect(applyResult.applyBatch.results).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
        applied: true,
      }),
      expect.objectContaining({
        path: 'server/src/services/policyIntentMapper.mjs',
        applied: true,
      }),
    ]));
    expect(applyResult.sideEffects).toEqual(expect.objectContaining({
      filesDeleted: true,
      filesArchived: false,
      storageChanged: false,
      gitCommandsRun: false,
    }));
    expect(applyResult.nextStep).toEqual(expect.objectContaining({
      stepId: 'post_removal_runtime_verification',
      label: 'Post-Removal Runtime Verification',
    }));
    expect(applyResult.nextPhase).toBeUndefined();
  });

  test('blocks when the removal review batch is not ready', async () => {
    const applyResult = await applyPolicyControlledCompatibilityPathRemoval({
      removalReview: readyRemovalReview({ selectedPaths: [] }),
      executeApply: true,
      operatorConfirmation: operatorConfirmation(),
      applyAdapter: applyAdapter(),
    });

    expect(applyResult.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_REMOVAL_BATCH);
    expect(applyResult.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.REMOVAL_BATCH_NOT_READY,
      }),
    ]));
    expect(applyResult.applyBatch.appliedCount).toBe(0);
  });

  test('blocks a missing or altered review context before calling the adapter', async () => {
    const review = readyRemovalReview();
    let applyCallCount = 0;
    const applyResult = await applyPolicyControlledCompatibilityPathRemoval({
      removalReview: {
        ...review,
        executionContext: {},
      },
      executeApply: true,
      operatorConfirmation: operatorConfirmation(),
      applyAdapter: applyAdapter({
        async applyEntry(entry) {
          applyCallCount += 1;
          return {
            path: entry.path,
            actionId: entry.actionId,
            applied: true,
            sideEffects: { filesDeleted: true },
          };
        },
      }),
      preApplyChangeDetector: verifiedPreApplyChangeDetector(),
    });

    expect(applyResult.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_REVIEW_INTEGRITY);
    expect(applyCallCount).toBe(0);
    expect(applyResult.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.REVIEW_ARTIFACT_INVALID,
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .REVIEW_EXECUTION_CONTEXT_MISSING,
    ]));
  });

  test('revalidates gate preflight evidence before calling the adapter', async () => {
    const review = readyRemovalReview();
    const alteredReview = {
      ...review,
      executionContext: {
        ...review.executionContext,
        executionGate: {
          ...review.executionContext.executionGate,
          operatorEvidence: {
            ...review.executionContext.executionGate.operatorEvidence,
            approval: {
              ...review.executionContext.executionGate.operatorEvidence.approval,
              approved: false,
            },
          },
        },
      },
    };
    const removalReview = {
      ...alteredReview,
      reviewArtifact: buildPolicyControlledCompatibilityPathRemovalReviewArtifact({
        removalReview: alteredReview,
      }),
    };
    let applyCallCount = 0;
    const applyResult = await applyPolicyControlledCompatibilityPathRemoval({
      removalReview,
      executeApply: true,
      operatorConfirmation: operatorConfirmation(),
      applyAdapter: applyAdapter({
        async applyEntry(entry) {
          applyCallCount += 1;
          return {
            path: entry.path,
            actionId: entry.actionId,
            applied: true,
            sideEffects: { filesDeleted: true },
          };
        },
      }),
      preApplyChangeDetector: verifiedPreApplyChangeDetector(),
    });

    expect(applyResult.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_REVIEW_INTEGRITY);
    expect(applyCallCount).toBe(0);
    expect(applyResult.risks.map(risk => risk.riskId)).toContain(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .REVIEW_EXECUTION_GATE_REVALIDATION_FAILED
    );
  });

  test('blocks without explicit execute flag and operator confirmation', async () => {
    const applyResult = await applyPolicyControlledCompatibilityPathRemoval({
      removalReview: readyRemovalReview(),
      executeApply: false,
      operatorConfirmation: operatorConfirmation({
        confirmed: false,
        confirmedBy: '',
      }),
      applyAdapter: applyAdapter(),
    });

    expect(applyResult.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_CONFIRMATION);
    expect(applyResult.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_NOT_ENABLED,
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .OPERATOR_CONFIRMATION_MISSING,
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .OPERATOR_CONFIRMATION_ACTOR_MISSING,
    ]));
  });

  test('blocks without an apply adapter', async () => {
    const applyResult = await applyPolicyControlledCompatibilityPathRemoval({
      removalReview: readyRemovalReview(),
      executeApply: true,
      operatorConfirmation: operatorConfirmation(),
      applyAdapter: null,
    });

    expect(applyResult.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_ADAPTER);
    expect(applyResult.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
          .APPLY_ADAPTER_MISSING,
      }),
    ]));
  });

  test('blocks when apply results do not match selected batch entries', async () => {
    const adapterCalls = [];
    const applyResult = await applyPolicyControlledCompatibilityPathRemoval({
      removalReview: readyRemovalReview(),
      executeApply: true,
      operatorConfirmation: operatorConfirmation(),
      applyAdapter: applyAdapter({
        async applyEntry(entry) {
          adapterCalls.push(entry.path);
          return {
            path: `${entry.path}.wrong`,
            actionId: 'remove_test',
            applied: false,
            sideEffects: {},
          };
        },
      }),
      preApplyChangeDetector: verifiedPreApplyChangeDetector(),
    });

    expect(applyResult.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_APPLY_RESULT);
    expect(applyResult.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_RESULT_NOT_APPLIED,
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .APPLY_RESULT_PATH_MISMATCH,
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .APPLY_RESULT_ACTION_MISMATCH,
    ]));
    expect(adapterCalls).toEqual([
      'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
    ]);
    expect(applyResult.applyBatch).toEqual(expect.objectContaining({
      checkedCount: 1,
      appliedCount: 0,
      haltReasonId:
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS
          .ADAPTER_RESULT_REJECTED,
    }));
    expect(applyResult.nextStep.stepId).toBe('resolve_removal_apply_blocker');
  });

  test('stops after an adapter failure and preserves earlier applied evidence', async () => {
    const adapterCalls = [];
    const applyResult = await applyPolicyControlledCompatibilityPathRemoval({
      removalReview: readyRemovalReview({
        selectedPaths: [
          'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
          'client/src/components/policies/PolicyStarterTemplateBrowser.vue',
          'client/src/components/policies/PolicyPresetMigrationNotice.vue',
        ],
      }),
      executeApply: true,
      operatorConfirmation: operatorConfirmation(),
      applyAdapter: applyAdapter({
        async applyEntry(entry) {
          adapterCalls.push(entry.path);

          if (entry.path.endsWith('PolicyStarterTemplateBrowser.vue')) {
            throw new Error(`cannot remove ${entry.path}`);
          }

          return {
            path: entry.path,
            actionId: entry.actionId,
            applied: true,
            sideEffects: { filesDeleted: true },
          };
        },
      }),
      preApplyChangeDetector: verifiedPreApplyChangeDetector(),
    });

    expect(applyResult.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_ADAPTER);
    expect(applyResult.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_ADAPTER_FAILED,
      }),
    ]));
    expect(adapterCalls).toEqual([
      'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
      'client/src/components/policies/PolicyStarterTemplateBrowser.vue',
    ]);
    expect(applyResult.applyBatch).toEqual(expect.objectContaining({
      requestedCount: 3,
      checkedCount: 2,
      appliedCount: 1,
      blockedEntry: {
        path: 'client/src/components/policies/PolicyStarterTemplateBrowser.vue',
        actionId: 'delete_file',
      },
      haltReasonId:
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS.ADAPTER_FAILURE,
    }));
    expect(applyResult.nextStep.stepId).toBe('post_removal_runtime_verification');
  });

  test('rejects archive, storage, or git side effects from apply results', async () => {
    let applyCallCount = 0;
    const applyResult = await applyPolicyControlledCompatibilityPathRemoval({
      removalReview: readyRemovalReview(),
      executeApply: true,
      operatorConfirmation: operatorConfirmation(),
      applyAdapter: applyAdapter({
        async applyEntry(entry) {
          applyCallCount += 1;
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
      preApplyChangeDetector: verifiedPreApplyChangeDetector(),
    });

    expect(applyResult.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_APPLY_RESULT);
    expect(applyResult.validation.ok).toBe(false);
    expect(applyResult.risks.map(risk => risk.riskId)).toContain(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.UNEXPECTED_SIDE_EFFECT
    );
    expect(applyCallCount).toBe(1);
    expect(applyResult.applyBatch.haltReasonId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS.ADAPTER_RESULT_REJECTED
    );
  });

  test('blocks a changed entry before its adapter call and preserves prior verified results', async () => {
    const adapterCalls = [];
    const detectorCalls = [];
    const applyResult = await applyPolicyControlledCompatibilityPathRemoval({
      removalReview: readyRemovalReview(),
      executeApply: true,
      operatorConfirmation: operatorConfirmation(),
      applyAdapter: applyAdapter({
        async applyEntry(entry) {
          adapterCalls.push(entry.path);
          return {
            path: entry.path,
            actionId: entry.actionId,
            applied: true,
            sideEffects: { filesDeleted: true },
          };
        },
      }),
      preApplyChangeDetector: async ({ entry }) => {
        detectorCalls.push(entry.path);

        return entry.path.includes('policyIntentMapper')
          ? verifiedPreApplyChangeDetector({
            statusId: 'blocked',
            verified: false,
            riskCount: 1,
            risks: [{ riskId: 'worktree_path_changed' }],
          })({ entry })
          : verifiedPreApplyChangeDetector()({ entry });
      },
    });

    expect(applyResult.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_PRE_APPLY_RECHECK);
    expect(detectorCalls).toEqual([
      'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
      'server/src/services/policyIntentMapper.mjs',
    ]);
    expect(adapterCalls).toEqual([
      'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
    ]);
    expect(applyResult.applyBatch).toEqual(expect.objectContaining({
      requestedCount: 2,
      checkedCount: 2,
      appliedCount: 1,
      blockedEntry: {
        path: 'server/src/services/policyIntentMapper.mjs',
        actionId: 'replace_code_path',
      },
    }));
    expect(applyResult.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
          .PRE_APPLY_CHANGE_DETECTED,
        recheckRiskIds: ['worktree_path_changed'],
      }),
    ]));
  });

  test('fails closed when the final detector returns malformed verification evidence', async () => {
    let applyCallCount = 0;
    const applyResult = await applyPolicyControlledCompatibilityPathRemoval({
      removalReview: readyRemovalReview(),
      executeApply: true,
      operatorConfirmation: operatorConfirmation(),
      applyAdapter: applyAdapter({
        async applyEntry() {
          applyCallCount += 1;
          return { applied: true, sideEffects: { filesDeleted: true } };
        },
      }),
      preApplyChangeDetector: async () => ({
        statusId: 'verified',
        verified: true,
        validation: { ok: false },
      }),
    });

    expect(applyResult.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_PRE_APPLY_RECHECK);
    expect(applyCallCount).toBe(0);
    expect(applyResult.risks.map(risk => risk.riskId)).toContain(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.PRE_APPLY_CHANGE_DETECTED
    );
  });

  test('rejects mutated apply output with stale risk count or unexpected side effects', () => {
    const validation = validatePolicyControlledCompatibilityPathRemovalApply({
      statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED,
      riskCount: 99,
      risks: [],
      applyBatch: {
        haltReasonId: 'unexpected_halt_reason',
        blockedEntry: null,
      },
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
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.RISK_COUNT_MISMATCH,
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.HALT_REASON_INVALID,
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.UNEXPECTED_SIDE_EFFECT,
    ]));
  });
});
