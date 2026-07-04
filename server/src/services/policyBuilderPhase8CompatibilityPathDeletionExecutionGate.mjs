import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
  buildPolicyCompatibilityDeletionExecutionPlan,
} from './policyCompatibilityDeletionExecutionPlan.mjs';

const PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_VERSION =
  'phase8r.compatibility_path_deletion_execution_gate.v1';

const PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_STATUS_IDS = Object.freeze({
  READY_FOR_CONTROLLED_DELETION: 'ready_for_controlled_deletion',
  BLOCKED_BY_EXECUTION_PLAN: 'blocked_by_execution_plan',
  BLOCKED_BY_WORKTREE: 'blocked_by_worktree',
  BLOCKED_BY_RECOVERY_EVIDENCE: 'blocked_by_recovery_evidence',
  BLOCKED_BY_APPROVAL: 'blocked_by_approval',
  BLOCKED_BY_MANIFEST_FRESHNESS: 'blocked_by_manifest_freshness',
});

const PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS = Object.freeze({
  EXECUTION_PLAN_NOT_READY: 'execution_plan_not_ready',
  EXECUTION_PLAN_VALIDATION_FAILED: 'execution_plan_validation_failed',
  WORKTREE_NOT_CLEAN: 'worktree_not_clean',
  BACKUP_RESTORE_NOT_VERIFIED: 'backup_restore_not_verified',
  BACKUP_RESTORE_NOT_FRESH: 'backup_restore_not_fresh',
  OPERATOR_APPROVAL_MISSING: 'operator_approval_missing',
  OPERATOR_APPROVAL_ACTOR_MISSING: 'operator_approval_actor_missing',
  ROLLBACK_STANCE_NOT_FINAL: 'rollback_stance_not_final',
  SUPPORT_STANCE_NOT_FINAL: 'support_stance_not_final',
  MANIFEST_NOT_FRESH: 'manifest_not_fresh',
  MANIFEST_NOT_CURRENT: 'manifest_not_current',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function evaluateExecutionPlan(executionPlan) {
  const plan = executionPlan || buildPolicyCompatibilityDeletionExecutionPlan();
  const risks = [];

  if (
    plan.statusId !==
    POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE ||
    plan.readyForExecutionGate !== true
  ) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.EXECUTION_PLAN_NOT_READY,
      'Compatibility path deletion requires a ready Phase 8R.15 execution plan.',
      { statusId: plan.statusId || null }
    ));
  }

  if (plan.validation?.ok !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.EXECUTION_PLAN_VALIDATION_FAILED,
      'Compatibility path deletion execution plan must validate before the execution gate can pass.',
      { issueCount: plan.validation?.issueCount ?? null }
    ));
  }

  return {
    executionPlan: plan,
    risks,
  };
}

function evaluateWorktree({ worktreeClean }) {
  if (worktreeClean === true) return [];

  return [
    buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.WORKTREE_NOT_CLEAN,
      'Compatibility path deletion requires a clean worktree immediately before execution.'
    ),
  ];
}

function evaluateRecoveryEvidence({
  backupRestoreVerified,
  backupRestoreFresh,
}) {
  const risks = [];

  if (backupRestoreVerified !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.BACKUP_RESTORE_NOT_VERIFIED,
      'Compatibility path deletion requires verified backup and restore evidence.'
    ));
  }

  if (backupRestoreFresh !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.BACKUP_RESTORE_NOT_FRESH,
      'Compatibility path deletion requires fresh backup and restore evidence.'
    ));
  }

  return risks;
}

function evaluateApproval({
  operatorApproval = {},
  rollbackStanceFinal,
  supportStanceFinal,
}) {
  const risks = [];

  if (operatorApproval?.approved !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.OPERATOR_APPROVAL_MISSING,
      'Compatibility path deletion requires explicit operator approval at execution time.'
    ));
  }

  if (!operatorApproval?.approvedBy) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.OPERATOR_APPROVAL_ACTOR_MISSING,
      'Compatibility path deletion approval must include an approving actor.'
    ));
  }

  if (rollbackStanceFinal !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.ROLLBACK_STANCE_NOT_FINAL,
      'Compatibility path deletion requires a final rollback or post-window recovery stance.'
    ));
  }

  if (supportStanceFinal !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.SUPPORT_STANCE_NOT_FINAL,
      'Compatibility path deletion requires a final support stance for converted native policies.'
    ));
  }

  return risks;
}

function evaluateManifestFreshness({
  manifestFresh,
  manifestMatchesCurrentPlan,
}) {
  const risks = [];

  if (manifestFresh !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.MANIFEST_NOT_FRESH,
      'Compatibility path deletion requires a fresh manifest immediately before execution.'
    ));
  }

  if (manifestMatchesCurrentPlan !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.MANIFEST_NOT_CURRENT,
      'Compatibility path deletion manifest must match the current execution plan.'
    ));
  }

  return risks;
}

function determineStatusId(risks = []) {
  if (risks.some(risk => [
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.EXECUTION_PLAN_NOT_READY,
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.EXECUTION_PLAN_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_STATUS_IDS
      .BLOCKED_BY_EXECUTION_PLAN;
  }

  if (risks.some(risk =>
    risk.riskId === PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.WORKTREE_NOT_CLEAN
  )) {
    return PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_STATUS_IDS.BLOCKED_BY_WORKTREE;
  }

  if (risks.some(risk => [
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.BACKUP_RESTORE_NOT_VERIFIED,
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.BACKUP_RESTORE_NOT_FRESH,
  ].includes(risk.riskId))) {
    return PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_STATUS_IDS
      .BLOCKED_BY_RECOVERY_EVIDENCE;
  }

  if (risks.some(risk => [
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.OPERATOR_APPROVAL_MISSING,
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.OPERATOR_APPROVAL_ACTOR_MISSING,
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.ROLLBACK_STANCE_NOT_FINAL,
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.SUPPORT_STANCE_NOT_FINAL,
  ].includes(risk.riskId))) {
    return PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_STATUS_IDS.BLOCKED_BY_APPROVAL;
  }

  if (risks.some(risk => [
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.MANIFEST_NOT_FRESH,
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.MANIFEST_NOT_CURRENT,
  ].includes(risk.riskId))) {
    return PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_STATUS_IDS
      .BLOCKED_BY_MANIFEST_FRESHNESS;
  }

  return PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_STATUS_IDS
    .READY_FOR_CONTROLLED_DELETION;
}

function buildPolicyBuilderPhase8CompatibilityPathDeletionExecutionGate({
  executionPlan = null,
  worktreeClean = false,
  backupRestoreVerified = false,
  backupRestoreFresh = false,
  operatorApproval = {},
  rollbackStanceFinal = false,
  supportStanceFinal = false,
  manifestFresh = false,
  manifestMatchesCurrentPlan = false,
} = {}) {
  const planEvaluation = evaluateExecutionPlan(executionPlan);
  const risks = [
    ...planEvaluation.risks,
    ...evaluateWorktree({ worktreeClean }),
    ...evaluateRecoveryEvidence({
      backupRestoreVerified,
      backupRestoreFresh,
    }),
    ...evaluateApproval({
      operatorApproval,
      rollbackStanceFinal,
      supportStanceFinal,
    }),
    ...evaluateManifestFreshness({
      manifestFresh,
      manifestMatchesCurrentPlan,
    }),
  ];
  const gate = {
    version: PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_VERSION,
    statusId: determineStatusId(risks),
    allowControlledDeletion: risks.length === 0,
    executionPlan: {
      statusId: planEvaluation.executionPlan.statusId || null,
      validationOk: planEvaluation.executionPlan.validation?.ok === true,
      readyForExecutionGate: planEvaluation.executionPlan.readyForExecutionGate === true,
      manifestEntryCount: planEvaluation.executionPlan.manifest?.entryCount ?? null,
    },
    finalChecks: {
      worktreeClean: worktreeClean === true,
      backupRestoreVerified: backupRestoreVerified === true,
      backupRestoreFresh: backupRestoreFresh === true,
      operatorApproval: {
        approved: operatorApproval?.approved === true,
        approvedBy: operatorApproval?.approvedBy || null,
      },
      rollbackStanceFinal: rollbackStanceFinal === true,
      supportStanceFinal: supportStanceFinal === true,
      manifestFresh: manifestFresh === true,
      manifestMatchesCurrentPlan: manifestMatchesCurrentPlan === true,
    },
    riskCount: risks.length,
    risks,
    executionPolicy: {
      executeDeletionNow: false,
      requireSeparateControlledDeletionStep: true,
      requireCleanWorktree: true,
      requireFreshBackupRestoreEvidence: true,
      requireOperatorApproval: true,
      requireManifestFreshness: true,
    },
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      routesRemoved: false,
      testsRemoved: false,
      storageChanged: false,
      manifestWritten: false,
      gitCommandsRun: false,
    },
    nextPhase: {
      phaseId: '8r_17',
      label: 'Controlled Compatibility Path Removal',
      reason:
        'The final execution gate can now approve a separate controlled deletion step; deletion still must not happen inside the gate evaluator.',
    },
  };

  return {
    ...gate,
    validation: validatePolicyBuilderPhase8CompatibilityPathDeletionExecutionGate(gate),
  };
}

function validatePolicyBuilderPhase8CompatibilityPathDeletionExecutionGate(gate = {}) {
  const issues = [];

  if (!Object.values(PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_STATUS_IDS)
    .includes(gate.statusId)) {
    issues.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.UNKNOWN_STATUS,
      'Compatibility path deletion execution gate status must be known.'
    ));
  }

  if (gate.riskCount !== asArray(gate.risks).length) {
    issues.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.RISK_COUNT_MISMATCH,
      'Compatibility path deletion execution gate risk count must match risk list length.'
    ));
  }

  Object.entries(gate.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Compatibility path deletion execution gate cannot perform side effect "${key}".`
      ));
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_RISK_IDS,
  PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_STATUS_IDS,
  PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_GATE_VERSION,
  buildPolicyBuilderPhase8CompatibilityPathDeletionExecutionGate,
  validatePolicyBuilderPhase8CompatibilityPathDeletionExecutionGate,
};
