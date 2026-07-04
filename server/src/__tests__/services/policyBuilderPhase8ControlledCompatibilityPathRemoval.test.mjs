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
  buildPolicyBuilderPhase8CompatibilityPathDeletionReadiness,
} from '../../services/policyBuilderPhase8CompatibilityPathDeletionReadiness.mjs';
import {
  buildPolicyBuilderPhase8CompatibilityPathDeletionExecutionPlan,
} from '../../services/policyBuilderPhase8CompatibilityPathDeletionExecutionPlan.mjs';
import {
  buildPolicyBuilderPhase8CompatibilityPathDeletionExecutionGate,
} from '../../services/policyBuilderPhase8CompatibilityPathDeletionExecutionGate.mjs';
import {
  PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS,
  PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS,
  buildPolicyBuilderPhase8ControlledCompatibilityPathRemoval,
  validatePolicyBuilderPhase8ControlledCompatibilityPathRemoval,
} from '../../services/policyBuilderPhase8ControlledCompatibilityPathRemoval.mjs';

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
  return buildPolicyBuilderPhase8CompatibilityPathDeletionReadiness({
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
  return buildPolicyBuilderPhase8CompatibilityPathDeletionExecutionPlan({
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
  return buildPolicyBuilderPhase8CompatibilityPathDeletionExecutionGate({
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

function readyRemoval(overrides = {}) {
  const executionPlan = readyExecutionPlan();
  return buildPolicyBuilderPhase8ControlledCompatibilityPathRemoval({
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

describe('policyBuilderPhase8ControlledCompatibilityPathRemoval', () => {
  test('builds a narrow side-effect-free removal review batch from approved manifest paths', () => {
    const removal = readyRemoval();

    expect(removal.statusId)
      .toBe(PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
        .READY_FOR_REMOVAL_REVIEW);
    expect(removal.readyForRemovalReview).toBe(true);
    expect(removal.validation.ok).toBe(true);
    expect(removal.executionPlan).toEqual(expect.objectContaining({
      statusId: 'ready_for_execution_gate',
      validationOk: true,
      readyForExecutionGate: true,
      manifestEntryCount: 22,
    }));
    expect(removal.executionGate).toEqual(expect.objectContaining({
      statusId: 'ready_for_controlled_deletion',
      validationOk: true,
      allowControlledDeletion: true,
    }));
    expect(removal.removalBatch).toEqual(expect.objectContaining({
      selectedCount: 2,
      requestedPathCount: 2,
      maxBatchSize: 3,
      reviewedBy: 'phase8r-maintainer',
    }));
    expect(removal.removalBatch.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
      }),
      expect.objectContaining({
        path: 'server/src/services/policyIntentImpactPreview.mjs',
      }),
    ]));
    expect(removal.executionPolicy).toEqual(expect.objectContaining({
      executeDeletionNow: false,
      requireManualApplyStep: true,
      requireFreshGateForApply: true,
    }));
    expect(Object.values(removal.sideEffects).some(Boolean)).toBe(false);
  });

  test('blocks when the execution plan is not ready', () => {
    const executionPlan = buildPolicyBuilderPhase8CompatibilityPathDeletionExecutionPlan();
    const removal = readyRemoval({
      executionPlan,
      executionGate: readyGate(readyExecutionPlan()),
    });

    expect(removal.statusId)
      .toBe(PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
        .BLOCKED_BY_EXECUTION_PLAN);
    expect(removal.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_PLAN_NOT_READY,
      }),
    ]));
  });

  test('blocks when the final execution gate is not ready', () => {
    const executionPlan = readyExecutionPlan();
    const removal = readyRemoval({
      executionPlan,
      executionGate: readyGate(executionPlan, {
        worktreeClean: false,
      }),
    });

    expect(removal.statusId)
      .toBe(PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
        .BLOCKED_BY_EXECUTION_GATE);
    expect(removal.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_GATE_NOT_READY,
      }),
    ]));
  });

  test('blocks empty and unknown path selections', () => {
    const emptySelection = readyRemoval({
      selectedPaths: [],
    });
    const unknownPath = readyRemoval({
      selectedPaths: ['client/src/components/policies/UnknownCompatibilityPath.vue'],
    });

    expect(emptySelection.statusId)
      .toBe(PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.BLOCKED_BY_SELECTION);
    expect(emptySelection.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.NO_PATHS_SELECTED,
      }),
    ]));
    expect(unknownPath.statusId)
      .toBe(PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.BLOCKED_BY_SELECTION);
    expect(unknownPath.removalBatch.missingPaths)
      .toEqual(['client/src/components/policies/UnknownCompatibilityPath.vue']);
  });

  test('blocks removal batches that are broader than the configured scope', () => {
    const removal = readyRemoval({
      maxBatchSize: 2,
      selectedPaths: [
        'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
        'client/src/components/policies/PolicyStarterTemplateDetails.vue',
        'client/src/components/policies/PolicyCombinedSignalsSummary.vue',
      ],
    });

    expect(removal.statusId)
      .toBe(PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.BLOCKED_BY_SCOPE);
    expect(removal.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.REMOVAL_SCOPE_TOO_BROAD,
        selectedCount: 3,
        maxBatchSize: 2,
      }),
    ]));
  });

  test('blocks without review reason and reviewer', () => {
    const removal = readyRemoval({
      removalReason: '',
      reviewedBy: '',
    });

    expect(removal.statusId)
      .toBe(PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.BLOCKED_BY_APPROVAL);
    expect(removal.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.MISSING_REVIEW_REASON,
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.MISSING_REVIEWER,
    ]));
  });

  test('rejects mutated removal output with side effects or stale risk count', () => {
    const removal = readyRemoval();
    const validation = validatePolicyBuilderPhase8ControlledCompatibilityPathRemoval({
      ...removal,
      riskCount: 99,
      sideEffects: {
        ...removal.sideEffects,
        filesDeleted: true,
        gitCommandsRun: true,
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.RISK_COUNT_MISMATCH,
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });
});
