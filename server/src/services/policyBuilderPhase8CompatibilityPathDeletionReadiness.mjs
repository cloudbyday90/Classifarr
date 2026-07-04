import {
  PHASE8R_LEGACY_CODE_DELETION_STATUS_IDS,
  buildPolicyBuilderPhase8LegacyCodeDeletionGates,
} from './policyBuilderPhase8LegacyCodeDeletionGates.mjs';
import {
  POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS,
  buildPolicyNativeRuntimeCutoverVerification,
} from './policyNativeRuntimeCutoverVerification.mjs';

const PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_VERSION =
  'phase8r.compatibility_path_deletion_readiness.v1';

const PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_STATUS_IDS = Object.freeze({
  READY_FOR_DELETION_EXECUTION_PLAN: 'ready_for_deletion_execution_plan',
  BLOCKED_BY_RUNTIME_CUTOVER: 'blocked_by_runtime_cutover',
  BLOCKED_BY_DELETION_GATES: 'blocked_by_deletion_gates',
  BLOCKED_BY_RESIDUAL_COMPATIBILITY_REFERENCES: 'blocked_by_residual_compatibility_references',
  BLOCKED_BY_SAFETY_CONFIRMATION: 'blocked_by_safety_confirmation',
});

const PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS = Object.freeze({
  CUTOVER_NOT_READY: 'cutover_not_ready',
  CUTOVER_VALIDATION_FAILED: 'cutover_validation_failed',
  DELETION_GATES_NOT_READY: 'deletion_gates_not_ready',
  DELETION_GATES_VALIDATION_FAILED: 'deletion_gates_validation_failed',
  RESIDUAL_COMPATIBILITY_REFERENCE: 'residual_compatibility_reference',
  BACKUP_RESTORE_NOT_VERIFIED: 'backup_restore_not_verified',
  ROLLBACK_SUPPORT_NOT_VERIFIED: 'rollback_support_not_verified',
  SUPPORT_DIAGNOSTICS_NOT_VERIFIED: 'support_diagnostics_not_verified',
  DELETION_MANIFEST_NOT_APPROVED: 'deletion_manifest_not_approved',
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

function buildDefaultCutoverVerification() {
  return buildPolicyNativeRuntimeCutoverVerification();
}

function buildDefaultDeletionGatePlan() {
  return buildPolicyBuilderPhase8LegacyCodeDeletionGates();
}

function normalizeResidualReferences(references = []) {
  return asArray(references)
    .map(reference => {
      if (typeof reference === 'string') {
        return {
          path: reference,
          reason: 'Compatibility reference still needs owner review.',
        };
      }

      return {
        path: reference?.path || 'unknown',
        reason: reference?.reason || 'Compatibility reference still needs owner review.',
        owner: reference?.owner || null,
        replacement: reference?.replacement || null,
      };
    });
}

function evaluateCutover(cutoverVerification) {
  const risks = [];
  const verification = cutoverVerification || buildDefaultCutoverVerification();

  if (
    verification.statusId !==
    POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.READY_FOR_CUTOVER_MONITORING
  ) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.CUTOVER_NOT_READY,
      'Compatibility deletion requires converted policies to read native intent and unconverted policies to stay on compatibility fallback.',
      { statusId: verification.statusId || null }
    ));
  }

  if (verification.validation?.ok !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.CUTOVER_VALIDATION_FAILED,
      'Native runtime cutover verification must validate before compatibility deletion readiness can pass.',
      { issueCount: verification.validation?.issueCount ?? null }
    ));
  }

  return {
    cutoverVerification: verification,
    risks,
  };
}

function evaluateDeletionGates(deletionGatePlan) {
  const risks = [];
  const plan = deletionGatePlan || buildDefaultDeletionGatePlan();

  if (plan.statusId !== PHASE8R_LEGACY_CODE_DELETION_STATUS_IDS.READY_TO_DELETE) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.DELETION_GATES_NOT_READY,
      'Legacy code deletion gates must be ready before compatibility path deletion can proceed.',
      { statusId: plan.statusId || null }
    ));
  }

  if (plan.validation?.ok !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.DELETION_GATES_VALIDATION_FAILED,
      'Legacy code deletion gates must validate before compatibility path deletion can proceed.',
      { issueCount: plan.validation?.issueCount ?? null }
    ));
  }

  return {
    deletionGatePlan: plan,
    risks,
  };
}

function evaluateResidualReferences(residualCompatibilityReferences = []) {
  const references = normalizeResidualReferences(residualCompatibilityReferences);

  return {
    residualCompatibilityReferences: references,
    risks: references.map(reference => buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.RESIDUAL_COMPATIBILITY_REFERENCE,
      'Compatibility path deletion requires every residual reference to be replaced or intentionally retained outside normal flow.',
      reference
    )),
  };
}

function evaluateSafetyConfirmations({
  backupRestoreVerified,
  rollbackSupportVerified,
  supportDiagnosticsVerified,
  deletionManifestApproved,
}) {
  const risks = [];

  if (backupRestoreVerified !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.BACKUP_RESTORE_NOT_VERIFIED,
      'Compatibility path deletion requires verified backup and restore coverage.'
    ));
  }

  if (rollbackSupportVerified !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.ROLLBACK_SUPPORT_NOT_VERIFIED,
      'Compatibility path deletion requires verified rollback support or an approved post-window stance.'
    ));
  }

  if (supportDiagnosticsVerified !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.SUPPORT_DIAGNOSTICS_NOT_VERIFIED,
      'Compatibility path deletion requires bounded support diagnostics for converted native intent.'
    ));
  }

  if (deletionManifestApproved !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.DELETION_MANIFEST_NOT_APPROVED,
      'Compatibility path deletion requires an approved deletion manifest before execution planning.'
    ));
  }

  return risks;
}

function determineStatusId(risks = []) {
  if (risks.some(risk => [
    PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.CUTOVER_NOT_READY,
    PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.CUTOVER_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_STATUS_IDS.BLOCKED_BY_RUNTIME_CUTOVER;
  }

  if (risks.some(risk => [
    PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.DELETION_GATES_NOT_READY,
    PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.DELETION_GATES_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_STATUS_IDS.BLOCKED_BY_DELETION_GATES;
  }

  if (risks.some(risk =>
    risk.riskId ===
    PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.RESIDUAL_COMPATIBILITY_REFERENCE
  )) {
    return PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_STATUS_IDS
      .BLOCKED_BY_RESIDUAL_COMPATIBILITY_REFERENCES;
  }

  if (risks.some(risk => [
    PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.BACKUP_RESTORE_NOT_VERIFIED,
    PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.ROLLBACK_SUPPORT_NOT_VERIFIED,
    PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.SUPPORT_DIAGNOSTICS_NOT_VERIFIED,
    PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.DELETION_MANIFEST_NOT_APPROVED,
  ].includes(risk.riskId))) {
    return PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_STATUS_IDS
      .BLOCKED_BY_SAFETY_CONFIRMATION;
  }

  return PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_STATUS_IDS.READY_FOR_DELETION_EXECUTION_PLAN;
}

function buildPolicyBuilderPhase8CompatibilityPathDeletionReadiness({
  cutoverVerification = null,
  deletionGatePlan = null,
  residualCompatibilityReferences = [],
  backupRestoreVerified = false,
  rollbackSupportVerified = false,
  supportDiagnosticsVerified = false,
  deletionManifestApproved = false,
} = {}) {
  const cutover = evaluateCutover(cutoverVerification);
  const deletionGates = evaluateDeletionGates(deletionGatePlan);
  const residual = evaluateResidualReferences(residualCompatibilityReferences);
  const safetyRisks = evaluateSafetyConfirmations({
    backupRestoreVerified,
    rollbackSupportVerified,
    supportDiagnosticsVerified,
    deletionManifestApproved,
  });
  const risks = [
    ...cutover.risks,
    ...deletionGates.risks,
    ...residual.risks,
    ...safetyRisks,
  ];
  const readiness = {
    version: PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_VERSION,
    statusId: determineStatusId(risks),
    readyForDeletionExecutionPlan: risks.length === 0,
    cutover: {
      statusId: cutover.cutoverVerification.statusId || null,
      validationOk: cutover.cutoverVerification.validation?.ok === true,
      riskCount: cutover.cutoverVerification.riskCount ?? null,
    },
    deletionGates: {
      statusId: deletionGates.deletionGatePlan.statusId || null,
      readyToDelete: deletionGates.deletionGatePlan.readyToDelete === true,
      validationOk: deletionGates.deletionGatePlan.validation?.ok === true,
      blockerCount: asArray(deletionGates.deletionGatePlan.blockers).length,
    },
    residualCompatibilityReferences: residual.residualCompatibilityReferences,
    safetyConfirmations: {
      backupRestoreVerified: backupRestoreVerified === true,
      rollbackSupportVerified: rollbackSupportVerified === true,
      supportDiagnosticsVerified: supportDiagnosticsVerified === true,
      deletionManifestApproved: deletionManifestApproved === true,
    },
    riskCount: risks.length,
    risks,
    deletionPolicy: {
      executeDeletionNow: false,
      requireExecutionPlan: true,
      requireRollbackOrPostWindowSupport: true,
      requireNoResidualCompatibilityReferences: true,
      requireSupportDiagnostics: true,
    },
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      routesRemoved: false,
      testsRemoved: false,
      storageChanged: false,
      deletionManifestWritten: false,
    },
    nextPhase: {
      phaseId: '8r_15',
      label: 'Compatibility Path Deletion Execution Plan',
      reason:
        'Deletion readiness can now be evaluated; the next step is an explicit execution manifest before any compatibility path is removed.',
    },
  };

  return {
    ...readiness,
    validation: validatePolicyBuilderPhase8CompatibilityPathDeletionReadiness(readiness),
  };
}

function validatePolicyBuilderPhase8CompatibilityPathDeletionReadiness(readiness = {}) {
  const issues = [];

  if (!Object.values(PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_STATUS_IDS)
    .includes(readiness.statusId)) {
    issues.push({
      riskId: PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.UNKNOWN_STATUS,
      message: 'Compatibility path deletion readiness status must be known.',
    });
  }

  if (readiness.riskCount !== asArray(readiness.risks).length) {
    issues.push({
      riskId: PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.RISK_COUNT_MISMATCH,
      message: 'Compatibility path deletion readiness risk count must match risk list length.',
    });
  }

  Object.entries(readiness.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS.SIDE_EFFECT_PERFORMED,
        message: `Compatibility path deletion readiness cannot perform side effect "${key}".`,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_RISK_IDS,
  PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_STATUS_IDS,
  PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_VERSION,
  buildPolicyBuilderPhase8CompatibilityPathDeletionReadiness,
  validatePolicyBuilderPhase8CompatibilityPathDeletionReadiness,
};
