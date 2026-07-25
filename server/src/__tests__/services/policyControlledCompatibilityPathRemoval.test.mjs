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
  buildReadyExecutionPlanArtifact,
} from './fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS,
  buildPolicyControlledCompatibilityPathRemoval,
  validatePolicyControlledCompatibilityPathRemoval,
} from '../../services/policyControlledCompatibilityPathRemoval.mjs';

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

function readyRemoval(overrides = {}) {
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

describe('policyControlledCompatibilityPathRemoval', () => {
  test('builds a narrow side-effect-free removal review batch from approved manifest paths', () => {
    const removal = readyRemoval();

    expect(removal.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
        .READY_FOR_REMOVAL_REVIEW);
    expect(removal.readyForRemovalReview).toBe(true);
    expect(removal.validation.ok).toBe(true);
    expect(removal.reviewArtifact).toEqual(expect.objectContaining({
      version: 'policy.controlled_compatibility_path_removal_review_artifact.v1',
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(removal.executionPlanArtifact).toEqual(expect.objectContaining({
      version: 'policy.compatibility_deletion_execution_plan_artifact.v2',
      statusId: 'ready',
      validationOk: true,
      ready: true,
      manifestEntryCount: 18,
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
      reviewedBy: 'policy-maintainer',
    }));
    expect(removal.removalBatch.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
      }),
      expect.objectContaining({
        path: 'server/src/services/policyIntentMapper.mjs',
      }),
    ]));
    expect(removal.executionPolicy).toEqual(expect.objectContaining({
      executeDeletionNow: false,
      requireManualApplyStep: true,
      requireFreshGateForApply: true,
    }));
    expect(removal.nextStep).toEqual(expect.objectContaining({
      stepId: 'controlled_compatibility_path_removal_apply',
      label: 'Controlled Compatibility Path Removal Apply',
    }));
    expect(removal.nextPhase).toBeUndefined();
    expect(Object.values(removal.sideEffects).some(Boolean)).toBe(false);
  });

  test('blocks when the execution-plan artifact is not ready', () => {
    const executionPlanArtifact = buildReadyExecutionPlanArtifact({
      executionPlan: buildPolicyCompatibilityDeletionExecutionPlan(),
      overrides: {
        statusId: 'blocked',
        ready: false,
        riskCount: 1,
        risks: [{ riskId: 'preflight_not_ready' }],
      },
    });
    const removal = readyRemoval({
      executionPlanArtifact,
      executionGate: readyGate(executionPlanArtifact),
    });

    expect(removal.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
        .BLOCKED_BY_EXECUTION_ARTIFACT);
    expect(removal.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS
            .EXECUTION_PLAN_ARTIFACT_NOT_READY,
      }),
    ]));
  });

  test('blocks when the final execution gate is not ready', () => {
    const executionPlanArtifact = readyExecutionPlanArtifact();
    const removal = readyRemoval({
      executionPlanArtifact,
      executionGate: readyGate(executionPlanArtifact, {
        preflightEvidenceArtifactOverrides: {
          checkoutObservation: { clean: false },
        },
      }),
    });

    expect(removal.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
        .BLOCKED_BY_EXECUTION_GATE);
    expect(removal.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_GATE_NOT_READY,
      }),
    ]));
  });

  test('rejects a ready gate bound to a different manifest artifact', () => {
    const selectedArtifact = readyExecutionPlanArtifact();
    const selectedPlan = readyExecutionPlan();
    const differentlyManifestedArtifact = readyExecutionPlanArtifact({
      ...selectedPlan,
      manifest: {
        ...selectedPlan.manifest,
        entries: selectedPlan.manifest.entries.map((entry, index) => index === 0
          ? {
            ...entry,
            replacementEvidence: {
              ...entry.replacementEvidence,
              tests: ['different-manifest-evidence.test.mjs'],
            },
          }
          : entry),
      },
    });
    const removal = readyRemoval({
      executionPlanArtifact: selectedArtifact,
      executionGate: readyGate(differentlyManifestedArtifact),
    });

    expect(removal.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
        .BLOCKED_BY_EXECUTION_GATE);
    expect(removal.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS
            .EXECUTION_GATE_ARTIFACT_MISMATCH,
      }),
    ]));
  });

  test('does not accept a legacy raw execution plan as removal-review evidence', () => {
    const executionPlan = readyExecutionPlan();
    const executionPlanArtifact = readyExecutionPlanArtifact(executionPlan);
    const removal = buildPolicyControlledCompatibilityPathRemoval({
      executionPlan,
      executionGate: readyGate(executionPlanArtifact),
      selectedPaths: [
        'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
      ],
      removalReason: 'Raw plans must not bypass artifact-bound manifest selection.',
      reviewedBy: 'policy-maintainer',
    });

    expect(removal.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
        .BLOCKED_BY_EXECUTION_ARTIFACT);
    expect(removal.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS
            .EXECUTION_PLAN_ARTIFACT_NOT_READY,
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
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.BLOCKED_BY_SELECTION);
    expect(emptySelection.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.NO_PATHS_SELECTED,
      }),
    ]));
    expect(unknownPath.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.BLOCKED_BY_SELECTION);
    expect(unknownPath.removalBatch.missingPaths)
      .toEqual(['client/src/components/policies/UnknownCompatibilityPath.vue']);
  });

  test('blocks noncanonical and duplicate selected paths instead of normalizing them silently', () => {
    const selectedPath = 'client/src/components/policies/PolicyStarterTemplateAccelerator.vue';
    const duplicate = readyRemoval({
      selectedPaths: [selectedPath, selectedPath],
    });
    const noncanonical = readyRemoval({
      selectedPaths: [selectedPath.replaceAll('/', '\\')],
    });

    expect(duplicate.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.BLOCKED_BY_SELECTION);
    expect(duplicate.removalBatch.requestedPathCount).toBe(2);
    expect(duplicate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.SELECTED_PATH_DUPLICATE,
        path: selectedPath,
      }),
    ]));
    expect(noncanonical.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.BLOCKED_BY_SELECTION);
    expect(noncanonical.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.SELECTED_PATH_INVALID,
      }),
    ]));
  });

  test('blocks selected entries with empty replacement-evidence objects', () => {
    const executionPlan = readyExecutionPlan();
    const selectedPath = executionPlan.manifest.entries[0].path;
    const executionPlanArtifact = readyExecutionPlanArtifact({
      ...executionPlan,
      manifest: {
        ...executionPlan.manifest,
        entries: executionPlan.manifest.entries.map(entry => entry.path === selectedPath
          ? { ...entry, replacementEvidence: {}, ready: true }
          : entry),
      },
    });
    const removal = readyRemoval({
      executionPlanArtifact,
      executionGate: readyGate(executionPlanArtifact),
      selectedPaths: [selectedPath],
    });

    expect(removal.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.BLOCKED_BY_SELECTION);
    expect(removal.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS
          .SELECTED_ENTRY_REPLACEMENT_EVIDENCE_INVALID,
        path: selectedPath,
      }),
    ]));
  });

  test('blocks duplicate or unsafe paths in an otherwise fingerprint-valid manifest', () => {
    const executionPlan = readyExecutionPlan();
    const manifestEntry = executionPlan.manifest.entries[0];
    const executionPlanArtifact = readyExecutionPlanArtifact({
      ...executionPlan,
      manifest: {
        ...executionPlan.manifest,
        entries: [
          ...executionPlan.manifest.entries,
          { ...manifestEntry },
          {
            ...manifestEntry,
            path: '../outside-the-repository.mjs',
          },
        ],
      },
    });
    const removal = readyRemoval({
      executionPlanArtifact,
      executionGate: readyGate(executionPlanArtifact),
    });

    expect(removal.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
        .BLOCKED_BY_EXECUTION_ARTIFACT);
    expect(removal.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.MANIFEST_PATH_DUPLICATE,
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.MANIFEST_PATH_INVALID,
    ]));
  });

  test('blocks removal batches that are broader than the configured scope', () => {
    const removal = readyRemoval({
      maxBatchSize: 2,
      selectedPaths: [
        'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
        'client/src/components/policies/PolicyStarterTemplateBrowser.vue',
        'client/src/components/policies/PolicyPresetMigrationNotice.vue',
      ],
    });

    expect(removal.statusId)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.BLOCKED_BY_SCOPE);
    expect(removal.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.REMOVAL_SCOPE_TOO_BROAD,
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
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.BLOCKED_BY_APPROVAL);
    expect(removal.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.MISSING_REVIEW_REASON,
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.MISSING_REVIEWER,
    ]));
  });

  test('rejects mutated removal output with side effects or stale risk count', () => {
    const removal = readyRemoval();
    const validation = validatePolicyControlledCompatibilityPathRemoval({
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
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.RISK_COUNT_MISMATCH,
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });

  test('rejects a removal review whose execution context changes after fingerprinting', () => {
    const removal = readyRemoval();
    const validation = validatePolicyControlledCompatibilityPathRemoval({
      ...removal,
      executionContext: {
        ...removal.executionContext,
        executionGate: {
          ...removal.executionContext.executionGate,
          operatorEvidence: {
            ...removal.executionContext.executionGate.operatorEvidence,
            approval: {
              ...removal.executionContext.executionGate.operatorEvidence.approval,
              approved: false,
            },
          },
        },
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toContain(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.REVIEW_ARTIFACT_INVALID
    );
  });
});
