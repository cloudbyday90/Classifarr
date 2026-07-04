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
  PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS,
  PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_STATUS_IDS,
  buildPolicyBuilderPhase8CompatibilityPathDeletionExecutionGate,
  validatePolicyBuilderPhase8CompatibilityPathDeletionExecutionGate,
} from '../../services/policyBuilderPhase8CompatibilityPathDeletionExecutionGate.mjs';

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

function readyGate(overrides = {}) {
  return buildPolicyBuilderPhase8CompatibilityPathDeletionExecutionGate({
    executionPlan: readyExecutionPlan(),
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

describe('policyBuilderPhase8CompatibilityPathDeletionExecutionGate', () => {
  test('allows a separate controlled deletion step only when final preflight checks pass', () => {
    const gate = readyGate();

    expect(gate.statusId)
      .toBe(PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_STATUS_IDS
        .READY_FOR_CONTROLLED_DELETION);
    expect(gate.allowControlledDeletion).toBe(true);
    expect(gate.validation.ok).toBe(true);
    expect(gate.executionPlan).toEqual(expect.objectContaining({
      statusId: 'ready_for_execution_gate',
      validationOk: true,
      readyForExecutionGate: true,
      manifestEntryCount: 22,
    }));
    expect(gate.finalChecks).toEqual(expect.objectContaining({
      worktreeClean: true,
      backupRestoreVerified: true,
      backupRestoreFresh: true,
      rollbackStanceFinal: true,
      supportStanceFinal: true,
      manifestFresh: true,
      manifestMatchesCurrentPlan: true,
    }));
    expect(gate.executionPolicy).toEqual(expect.objectContaining({
      executeDeletionNow: false,
      requireSeparateControlledDeletionStep: true,
    }));
    expect(Object.values(gate.sideEffects).some(Boolean)).toBe(false);
  });

  test('blocks when the execution plan is not ready', () => {
    const gate = readyGate({
      executionPlan: buildPolicyBuilderPhase8CompatibilityPathDeletionExecutionPlan(),
    });

    expect(gate.statusId)
      .toBe(PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_EXECUTION_PLAN);
    expect(gate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS
          .EXECUTION_PLAN_NOT_READY,
      }),
    ]));
  });

  test('blocks when the worktree is not clean', () => {
    const gate = readyGate({
      worktreeClean: false,
    });

    expect(gate.statusId)
      .toBe(PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_WORKTREE);
    expect(gate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.WORKTREE_NOT_CLEAN,
      }),
    ]));
  });

  test('blocks when backup and restore evidence is missing or stale', () => {
    const gate = readyGate({
      backupRestoreVerified: false,
      backupRestoreFresh: false,
    });

    expect(gate.statusId)
      .toBe(PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_RECOVERY_EVIDENCE);
    expect(gate.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.BACKUP_RESTORE_NOT_VERIFIED,
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.BACKUP_RESTORE_NOT_FRESH,
    ]));
  });

  test('blocks without operator approval and final support stances', () => {
    const gate = readyGate({
      operatorApproval: {
        approved: false,
        approvedBy: null,
      },
      rollbackStanceFinal: false,
      supportStanceFinal: false,
    });

    expect(gate.statusId)
      .toBe(PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_APPROVAL);
    expect(gate.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.OPERATOR_APPROVAL_MISSING,
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.OPERATOR_APPROVAL_ACTOR_MISSING,
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.ROLLBACK_STANCE_NOT_FINAL,
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.SUPPORT_STANCE_NOT_FINAL,
    ]));
  });

  test('blocks when manifest freshness cannot be confirmed', () => {
    const gate = readyGate({
      manifestFresh: false,
      manifestMatchesCurrentPlan: false,
    });

    expect(gate.statusId)
      .toBe(PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_MANIFEST_FRESHNESS);
    expect(gate.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.MANIFEST_NOT_FRESH,
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.MANIFEST_NOT_CURRENT,
    ]));
  });

  test('rejects mutated gate output with side effects or stale risk count', () => {
    const gate = readyGate();
    const validation = validatePolicyBuilderPhase8CompatibilityPathDeletionExecutionGate({
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
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.RISK_COUNT_MISMATCH,
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });
});
