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
  buildReadyBackupRestoreVerificationEvidence,
  buildReadyExecutionGateOperatorEvidence,
  buildReadyExecutionGatePreflightEvidenceArtifact,
  buildReadyExecutionGateRecoveryEvidence,
  buildReadyExecutionPlanArtifact,
} from './fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS,
} from '../../services/policyCompatibilityDeletionPreflightAttestation.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from '../../services/policyCompatibilityDeletionExecutionActions.mjs';
import {
  buildPolicyCompatibilityDeletionPreflightEvidenceArtifactFingerprint,
} from '../../services/policyCompatibilityDeletionPreflightEvidenceArtifactFingerprint.mjs';
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

function readyReadiness() {
  const evidence = {
    currentPolicyInventory: readyCurrentPolicyInventory(),
    reconciliationStateInventory: readyReconciliationStateInventory(),
    cutoverVerification: readyCutover(),
    deletionGatePlan: readyDeletionGates(),
    backupRestoreEvidence: buildReadyBackupRestoreVerificationEvidence(),
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

function namedScope(overrides = {}) {
  return {
    actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_NAMED_TEST_SCOPE,
    categoryId: 'compatibility_named_test_scopes',
    componentPath: 'server/src/services/policyLegacyCompatibility.mjs',
    deletionIntent: 'Remove a legacy compatibility test without deleting its retained test file.',
    dependencyIds: ['policy_legacy_compatibility'],
    path: 'server/src/__tests__/services/policyLegacyCompatibility.test.mjs',
    sourceTextFragments: ["test('uses legacy bridge'"],
    targetKindId: 'named_test_scope',
    testNameFragments: ['uses legacy bridge'],
    wholeFileDeletion: false,
    ...overrides,
  };
}

function namedScopeExecutionPlan(entries = [namedScope()]) {
  return {
    statusId: 'ready_for_execution_gate',
    readyForExecutionGate: true,
    validation: { ok: true, issueCount: 0, issues: [] },
    manifest: {
      approved: true,
      approvedBy: 'policy-maintainer',
      entries,
    },
  };
}

function readyGate({
  executionPlan = readyExecutionPlan(),
  executionPlanArtifact = null,
  recoveryEvidence = null,
  operatorEvidence = null,
  preflightEvidenceArtifact = null,
  ...overrides
} = {}) {
  const artifact = executionPlanArtifact || buildReadyExecutionPlanArtifact({
    executionPlan,
  });

  return buildPolicyCompatibilityDeletionExecutionGate({
    executionPlanArtifact: artifact,
    recoveryEvidence: recoveryEvidence || buildReadyExecutionGateRecoveryEvidence({
      executionPlanArtifact: artifact,
    }),
    operatorEvidence: operatorEvidence || buildReadyExecutionGateOperatorEvidence({
      executionPlanArtifact: artifact,
    }),
    preflightEvidenceArtifact: preflightEvidenceArtifact ||
      buildReadyExecutionGatePreflightEvidenceArtifact({
      executionPlanArtifact: artifact,
      }),
    generatedAt: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    ...overrides,
  });
}

describe('policyCompatibilityDeletionExecutionGate', () => {
  test('allows a separate controlled deletion step only with current collected and operator evidence', () => {
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
      manifestEntryCount: 16,
    }));
    expect(gate.preflightAttestation).toEqual(expect.objectContaining({
      executionPlanArtifactFingerprint:
        gate.executionPlanArtifact.artifactFingerprint.fingerprint,
      preflightEvidenceArtifactFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      checkout: expect.objectContaining({ clean: true }),
      manifest: expect.objectContaining({ statusId: 'observed' }),
    }));
    expect(gate.operatorEvidence).toEqual(expect.objectContaining({
      executionPlanArtifactFingerprint:
        gate.executionPlanArtifact.artifactFingerprint.fingerprint,
      approval: expect.objectContaining({ approved: true, approvedBy: 'policy-maintainer' }),
      stances: expect.objectContaining({
        rollbackStanceFinal: true,
        supportStanceFinal: true,
      }),
    }));
    expect(gate.recoveryEvidence).toEqual(expect.objectContaining({
      statusId: 'ready',
      executionPlanArtifactFingerprint:
        gate.executionPlanArtifact.artifactFingerprint.fingerprint,
      source: expect.objectContaining({
        databaseOwned: true,
        sourceId: 'policy_backup_restore_verifications',
      }),
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
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
          .CALLER_READINESS_INPUT_UNSUPPORTED,
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

  test('blocks stale execution-plan evidence and mismatched collected evidence', () => {
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

    const currentArtifact = buildReadyExecutionPlanArtifact({ executionPlan: readyExecutionPlan() });
    const preflightEvidenceArtifact = buildReadyExecutionGatePreflightEvidenceArtifact({
      executionPlanArtifact: currentArtifact,
    });
    preflightEvidenceArtifact.checkout.observedAt = '2026-07-14T19:59:59.999Z';
    preflightEvidenceArtifact.artifactFingerprint =
      buildPolicyCompatibilityDeletionPreflightEvidenceArtifactFingerprint({
        artifact: preflightEvidenceArtifact,
      });
    const mismatchedPreflightGate = readyGate({
      executionPlanArtifact: currentArtifact,
      preflightEvidenceArtifact,
    });

    expect(mismatchedPreflightGate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_PREFLIGHT_EVIDENCE);
    expect(mismatchedPreflightGate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS
          .CHECKOUT_TIMESTAMP_MISMATCH,
      }),
    ]));
  });

  test('blocks collected evidence that is bound to another execution-plan artifact', () => {
    const artifact = buildReadyExecutionPlanArtifact({ executionPlan: readyExecutionPlan() });
    const differentArtifact = buildReadyExecutionPlanArtifact({
      executionPlan: readyExecutionPlan(),
      generatedAt: '2026-07-14T20:00:00.001Z',
    });
    const gate = readyGate({
      executionPlanArtifact: artifact,
      preflightEvidenceArtifact: buildReadyExecutionGatePreflightEvidenceArtifact({
        executionPlanArtifact: differentArtifact,
      }),
    });

    expect(gate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_PREFLIGHT_EVIDENCE);
    expect(gate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS
          .EXECUTION_PLAN_FINGERPRINT_MISMATCH,
      }),
    ]));
  });

  test('blocks when the worktree is not clean', () => {
    const artifact = buildReadyExecutionPlanArtifact({ executionPlan: readyExecutionPlan() });
    const gate = readyGate({
      executionPlanArtifact: artifact,
      preflightEvidenceArtifact: buildReadyExecutionGatePreflightEvidenceArtifact({
        executionPlanArtifact: artifact,
        overrides: { checkoutObservation: { clean: false } },
      }),
    });

    expect(gate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_WORKTREE);
    expect(gate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS.CHECKOUT_NOT_CLEAN,
      }),
    ]));
  });

  test('blocks when database-owned recovery evidence is not verified', () => {
    const artifact = buildReadyExecutionPlanArtifact({ executionPlan: readyExecutionPlan() });
    const gate = readyGate({
      executionPlanArtifact: artifact,
      recoveryEvidence: buildReadyExecutionGateRecoveryEvidence({
        executionPlanArtifact: artifact,
        backupRestoreVerificationEvidence: {
          ...buildReadyBackupRestoreVerificationEvidence(),
          statusId: 'blocked_by_restore_gate',
          backupRestoreVerified: false,
        },
      }),
    });

    expect(gate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_RECOVERY_EVIDENCE);
    expect(gate.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.BACKUP_RESTORE_NOT_VERIFIED,
    ]));
  });

  test('blocks recovery evidence bound to a different execution-plan artifact', () => {
    const artifact = buildReadyExecutionPlanArtifact({ executionPlan: readyExecutionPlan() });
    const differentArtifact = buildReadyExecutionPlanArtifact({
      executionPlan: readyExecutionPlan({
        supportStance: 'A different final support stance changes this approved plan.',
      }),
    });
    const gate = readyGate({
      executionPlanArtifact: artifact,
      recoveryEvidence: buildReadyExecutionGateRecoveryEvidence({
        executionPlanArtifact: differentArtifact,
      }),
    });

    expect(gate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_RECOVERY_EVIDENCE);
    expect(gate.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
        .RECOVERY_EVIDENCE_ARTIFACT_FINGERPRINT_MISMATCH,
    ]));
  });

  test('blocks without operator approval and final support stances', () => {
    const artifact = buildReadyExecutionPlanArtifact({ executionPlan: readyExecutionPlan() });
    const gate = readyGate({
      executionPlanArtifact: artifact,
      operatorEvidence: buildReadyExecutionGateOperatorEvidence({
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

  test('blocks when collected manifest observations do not preserve approved ordering', () => {
    const artifact = buildReadyExecutionPlanArtifact({ executionPlan: readyExecutionPlan() });
    const gate = readyGate({
      executionPlanArtifact: artifact,
      preflightEvidenceArtifact: buildReadyExecutionGatePreflightEvidenceArtifact({
        executionPlanArtifact: artifact,
        overrides: {
          manifestObservations: artifact.executionPlan.manifest.entries.map((entry, index) => ({
            index,
            path: index === 0 ? 'server/src/services/incorrect.mjs' : entry.path,
            statusId: 'observed',
          })),
        },
      }),
    });

    expect(gate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_MANIFEST_VERIFICATION);
    expect(gate.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS.MANIFEST_ORDER_MISMATCH,
    ]));
  });

  test('rejects machine claims supplied through operator evidence', () => {
    const artifact = buildReadyExecutionPlanArtifact({ executionPlan: readyExecutionPlan() });
    const gate = readyGate({
      executionPlanArtifact: artifact,
      operatorEvidence: buildReadyExecutionGateOperatorEvidence({
        executionPlanArtifact: artifact,
        overrides: {
          manifest: { current: true },
          worktree: { clean: true },
          recovery: { backupRestoreVerified: true },
        },
      }),
    });

    expect(gate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_PREFLIGHT_EVIDENCE);
    expect(gate.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
        .OPERATOR_EVIDENCE_MACHINE_CLAIMS_UNSUPPORTED,
    ]));
  });

  test('rejects an altered collector artifact before it can authorize a removal batch', () => {
    const artifact = buildReadyExecutionPlanArtifact({ executionPlan: readyExecutionPlan() });
    const preflightEvidenceArtifact = buildReadyExecutionGatePreflightEvidenceArtifact({
      executionPlanArtifact: artifact,
    });
    preflightEvidenceArtifact.checkout.sourceRevision = 'f'.repeat(40);

    const gate = readyGate({ executionPlanArtifact: artifact, preflightEvidenceArtifact });

    expect(gate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_PREFLIGHT_EVIDENCE);
    expect(gate.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS
        .PREFLIGHT_ARTIFACT_INVALID,
    ]));
  });

  test('rejects duplicate manifest observations even when every entry appears observed', () => {
    const artifact = buildReadyExecutionPlanArtifact({ executionPlan: readyExecutionPlan() });
    const duplicatePath = artifact.executionPlan.manifest.entries[0].path;
    const gate = readyGate({
      executionPlanArtifact: artifact,
      preflightEvidenceArtifact: buildReadyExecutionGatePreflightEvidenceArtifact({
        executionPlanArtifact: artifact,
        overrides: {
          manifestObservations: artifact.executionPlan.manifest.entries.map((entry, index) => ({
            index,
            path: index === 1 ? duplicatePath : entry.path,
            statusId: 'observed',
          })),
        },
      }),
    });

    expect(gate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_MANIFEST_VERIFICATION);
    expect(gate.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS.MANIFEST_DUPLICATE_PATH,
    ]));
  });

  test('allows distinct named scopes in one retained test file through the execution gate', () => {
    const artifact = buildReadyExecutionPlanArtifact({
      executionPlan: namedScopeExecutionPlan([
        namedScope(),
        namedScope({
          sourceTextFragments: ["test('preserves legacy fallback'"],
          testNameFragments: ['preserves legacy fallback'],
        }),
      ]),
    });
    const gate = readyGate({ executionPlanArtifact: artifact });

    expect(gate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .READY_FOR_CONTROLLED_DELETION);
    expect(gate.preflightAttestation.manifest.entries).toHaveLength(2);
    expect(new Set(gate.preflightAttestation.manifest.entries
      .map(entry => entry.entryIdentity)).size).toBe(2);
  });

  test('blocks duplicate exact named scopes before controlled deletion', () => {
    const entry = namedScope();
    const artifact = buildReadyExecutionPlanArtifact({
      executionPlan: namedScopeExecutionPlan([entry, { ...entry }]),
    });
    const gate = readyGate({ executionPlanArtifact: artifact });

    expect(gate.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_MANIFEST_VERIFICATION);
    expect(gate.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS
        .MANIFEST_DUPLICATE_ENTRY_IDENTITY,
    ]));
    expect(gate.allowControlledDeletion).toBe(false);
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

  test('rejects a serialized gate whose operator evidence no longer derives its ready state', () => {
    const gate = readyGate();
    const validation = validatePolicyCompatibilityDeletionExecutionGate({
      ...gate,
      operatorEvidence: {
        ...gate.operatorEvidence,
        approval: {
          ...gate.operatorEvidence.approval,
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

  test('rejects a serialized gate whose retained preflight attestation was altered', () => {
    const gate = readyGate();
    const validation = validatePolicyCompatibilityDeletionExecutionGate({
      ...gate,
      preflightAttestation: {
        ...gate.preflightAttestation,
        checkout: {
          ...gate.preflightAttestation.checkout,
          clean: false,
        },
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.PREFLIGHT_ATTESTATION_MISMATCH,
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
