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
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS,
  buildPolicyCompatibilityDeletionExecutionGate,
  validatePolicyCompatibilityDeletionExecutionGate,
} from '../../services/policyCompatibilityDeletionExecutionGate.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  buildReadyExecutionGatePreflightEvidence,
  buildReadyExecutionPlanArtifact,
} from './fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';

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

function readyGate({
  executionPlan = readyExecutionPlan(),
  executionPlanArtifact = null,
  preflightEvidence = null,
  ...overrides
} = {}) {
  const artifact = executionPlanArtifact || buildReadyExecutionPlanArtifact({
    executionPlan,
  });

  return buildPolicyCompatibilityDeletionExecutionGate({
    executionPlanArtifact: artifact,
    preflightEvidence: preflightEvidence || buildReadyExecutionGatePreflightEvidence({
      executionPlanArtifact: artifact,
    }),
    generatedAt: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    ...overrides,
  });
}

describe('policyCompatibilityDeletionExecutionGate', () => {
  test('allows a separate controlled deletion step only with a current bound artifact and preflight evidence', () => {
    const gate = readyGate();

    expect(gate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .READY_FOR_CONTROLLED_DELETION);
    expect(gate.allowControlledDeletion).toBe(true);
    expect(gate.validation.ok).toBe(true);
    expect(gate.executionPlan).toEqual(expect.objectContaining({
      statusId: 'ready_for_execution_gate',
      validationOk: true,
      readyForExecutionGate: true,
      manifestEntryCount: 18,
    }));
    expect(gate.preflightEvidence).toEqual(expect.objectContaining({
      executionPlanArtifactFingerprint:
        gate.executionPlanArtifact.artifactFingerprint.fingerprint,
      worktree: expect.objectContaining({ clean: true }),
      recovery: expect.objectContaining({ backupRestoreVerified: true }),
      approval: expect.objectContaining({ approved: true, approvedBy: 'policy-maintainer' }),
      stances: expect.objectContaining({
        rollbackStanceFinal: true,
        supportStanceFinal: true,
      }),
      manifest: expect.objectContaining({ matchesExecutionPlan: true }),
    }));
    expect(gate.executionPolicy).toEqual(expect.objectContaining({
      executeDeletionNow: false,
      requireSeparateControlledDeletionStep: true,
    }));
    expect(gate.nextStep).toEqual(expect.objectContaining({
      stepId: 'controlled_compatibility_path_removal',
      label: 'Controlled Compatibility Path Removal',
    }));
    expect(gate.nextPhase).toBeUndefined();
    expect(Object.values(gate.sideEffects).some(Boolean)).toBe(false);
  });

  test('blocks a missing or non-ready execution-plan artifact', () => {
    const gate = buildPolicyCompatibilityDeletionExecutionGate({
      generatedAt: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
      now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    });

    expect(gate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_EXECUTION_ARTIFACT);
    expect(gate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
          .EXECUTION_PLAN_ARTIFACT_NOT_READY,
      }),
    ]));
  });

  test('does not accept legacy raw readiness fields without a bound artifact', () => {
    const gate = buildPolicyCompatibilityDeletionExecutionGate({
      executionPlan: readyExecutionPlan(),
      worktreeClean: true,
      backupRestoreVerified: true,
      backupRestoreFresh: true,
      operatorApproval: { approved: true, approvedBy: 'policy-maintainer' },
      rollbackStanceFinal: true,
      supportStanceFinal: true,
      manifestFresh: true,
      manifestMatchesCurrentPlan: true,
      generatedAt: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
      now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    });

    expect(gate.allowControlledDeletion).toBe(false);
    expect(gate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
          .EXECUTION_PLAN_ARTIFACT_NOT_READY,
      }),
    ]));
  });

  test('blocks a mutated execution-plan artifact even when its ready claims are unchanged', () => {
    const artifact = buildReadyExecutionPlanArtifact({
      executionPlan: readyExecutionPlan(),
    });
    artifact.executionPlan.manifest.entries = [];
    artifact.executionPlan.manifest.entryCount = 0;

    const gate = readyGate({ executionPlanArtifact: artifact });

    expect(gate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_EXECUTION_ARTIFACT);
    expect(gate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
          .EXECUTION_PLAN_ARTIFACT_FINGERPRINT_INVALID,
      }),
    ]));
  });

  test('blocks stale execution-plan evidence and stale preflight checks', () => {
    const artifact = buildReadyExecutionPlanArtifact({
      executionPlan: readyExecutionPlan(),
      generatedAt: '2026-07-14T19:54:59.999Z',
    });
    const staleArtifactGate = readyGate({
      executionPlanArtifact: artifact,
    });

    expect(staleArtifactGate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_EXECUTION_ARTIFACT);
    expect(staleArtifactGate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
          .EXECUTION_PLAN_ARTIFACT_TIMESTAMP_STALE,
      }),
    ]));

    const currentArtifact = buildReadyExecutionPlanArtifact({
      executionPlan: readyExecutionPlan(),
    });
    const stalePreflightGate = readyGate({
      executionPlanArtifact: currentArtifact,
      preflightEvidence: buildReadyExecutionGatePreflightEvidence({
        executionPlanArtifact: currentArtifact,
        observedAt: '2026-07-14T19:54:59.999Z',
      }),
    });

    expect(stalePreflightGate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_PREFLIGHT_EVIDENCE);
    expect(stalePreflightGate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.PREFLIGHT_TIMESTAMP_STALE,
      }),
    ]));
  });

  test('blocks preflight evidence that is not bound to the exact execution-plan artifact', () => {
    const artifact = buildReadyExecutionPlanArtifact({ executionPlan: readyExecutionPlan() });
    const gate = readyGate({
      executionPlanArtifact: artifact,
      preflightEvidence: buildReadyExecutionGatePreflightEvidence({
        executionPlanArtifact: artifact,
        overrides: {
          executionPlanArtifactFingerprint: 'a'.repeat(64),
        },
      }),
    });

    expect(gate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_PREFLIGHT_EVIDENCE);
    expect(gate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
          .PREFLIGHT_ARTIFACT_FINGERPRINT_MISMATCH,
      }),
    ]));
  });

  test('blocks when the worktree is not clean', () => {
    const artifact = buildReadyExecutionPlanArtifact({ executionPlan: readyExecutionPlan() });
    const gate = readyGate({
      executionPlanArtifact: artifact,
      preflightEvidence: buildReadyExecutionGatePreflightEvidence({
        executionPlanArtifact: artifact,
        overrides: { worktree: { clean: false } },
      }),
    });

    expect(gate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_WORKTREE);
    expect(gate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.WORKTREE_NOT_CLEAN,
      }),
    ]));
  });

  test('blocks when recovery evidence is not verified', () => {
    const artifact = buildReadyExecutionPlanArtifact({ executionPlan: readyExecutionPlan() });
    const gate = readyGate({
      executionPlanArtifact: artifact,
      preflightEvidence: buildReadyExecutionGatePreflightEvidence({
        executionPlanArtifact: artifact,
        overrides: { recovery: { backupRestoreVerified: false } },
      }),
    });

    expect(gate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_RECOVERY_EVIDENCE);
    expect(gate.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.BACKUP_RESTORE_NOT_VERIFIED,
    ]));
  });

  test('blocks without operator approval and final support stances', () => {
    const artifact = buildReadyExecutionPlanArtifact({ executionPlan: readyExecutionPlan() });
    const gate = readyGate({
      executionPlanArtifact: artifact,
      preflightEvidence: buildReadyExecutionGatePreflightEvidence({
        executionPlanArtifact: artifact,
        overrides: {
          approval: { approved: false },
          stances: {
            rollbackStanceFinal: false,
            supportStanceFinal: false,
          },
        },
      }),
    });

    expect(gate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_APPROVAL);
    expect(gate.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.OPERATOR_APPROVAL_MISSING,
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.ROLLBACK_STANCE_NOT_FINAL,
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.SUPPORT_STANCE_NOT_FINAL,
    ]));
  });

  test('blocks when the manifest cannot be verified against the bound artifact', () => {
    const artifact = buildReadyExecutionPlanArtifact({ executionPlan: readyExecutionPlan() });
    const gate = readyGate({
      executionPlanArtifact: artifact,
      preflightEvidence: buildReadyExecutionGatePreflightEvidence({
        executionPlanArtifact: artifact,
        overrides: { manifest: { matchesExecutionPlan: false } },
      }),
    });

    expect(gate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_MANIFEST_VERIFICATION);
    expect(gate.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.MANIFEST_NOT_CURRENT,
    ]));
  });

  test('rejects mutated gate output with side effects or stale risk count', () => {
    const gate = readyGate();
    const validation = validatePolicyCompatibilityDeletionExecutionGate({
      ...gate,
      riskCount: 99,
      sideEffects: {
        ...gate.sideEffects,
        filesDeleted: true,
        gitCommandsRun: true,
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.RISK_COUNT_MISMATCH,
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });

  test('rejects a serialized gate whose preflight evidence no longer derives its ready state', () => {
    const gate = readyGate();
    const validation = validatePolicyCompatibilityDeletionExecutionGate({
      ...gate,
      preflightEvidence: {
        ...gate.preflightEvidence,
        approval: {
          ...gate.preflightEvidence.approval,
          approved: false,
        },
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
        .EXECUTION_GATE_EVIDENCE_RISK_MISMATCH,
    ]));
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
          .EXECUTION_GATE_STATUS_MISMATCH,
        expectedStatusId:
          POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS.BLOCKED_BY_APPROVAL,
      }),
    ]));
  });

  test('rejects a gate that changes its side-effect-free handoff policy', () => {
    const gate = readyGate();
    const validation = validatePolicyCompatibilityDeletionExecutionGate({
      ...gate,
      executionPolicy: {
        ...gate.executionPolicy,
        executeDeletionNow: true,
      },
      nextStep: {
        ...gate.nextStep,
        stepId: 'delete_now',
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.EXECUTION_POLICY_MISMATCH,
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.NEXT_STEP_MISMATCH,
    ]));
  });
});
