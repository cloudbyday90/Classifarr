import {
  PHASE8R_RUNTIME_READ_SOURCE_IDS,
  PHASE8R_RUNTIME_READ_STATUS_IDS,
  buildPolicyBuilderPhase8NativeRuntimeReadPath,
} from './policyBuilderPhase8NativeRuntimeReadPath.mjs';

const PHASE8R_NATIVE_RUNTIME_CUTOVER_VERIFICATION_VERSION =
  'phase8r.native_runtime_cutover_verification.v1';

const PHASE8R_NATIVE_RUNTIME_CUTOVER_STATUS_IDS = Object.freeze({
  READY_FOR_CUTOVER_MONITORING: 'ready_for_cutover_monitoring',
  BLOCKED_BY_NATIVE_READ: 'blocked_by_native_read',
  BLOCKED_BY_COMPATIBILITY_FALLBACK: 'blocked_by_compatibility_fallback',
  BLOCKED_BY_ROLLBACK: 'blocked_by_rollback',
  BLOCKED_BY_DELETION_GATE: 'blocked_by_deletion_gate',
});

const PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS = Object.freeze({
  CONVERTED_POLICY_NOT_NATIVE: 'converted_policy_not_native',
  CONVERTED_NATIVE_READ_INVALID: 'converted_native_read_invalid',
  UNCONVERTED_POLICY_NOT_COMPATIBILITY: 'unconverted_policy_not_compatibility',
  ROLLBACK_NOT_AVAILABLE: 'rollback_not_available',
  LEGACY_DELETION_NOT_BLOCKED: 'legacy_deletion_not_blocked',
  SUPPORT_DIAGNOSTICS_NOT_SAFE: 'support_diagnostics_not_safe',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
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

function evaluateConvertedRead(convertedPolicy) {
  const readPath = buildPolicyBuilderPhase8NativeRuntimeReadPath({
    policy: convertedPolicy,
  });
  const risks = [];

  if (readPath.sourceId !== PHASE8R_RUNTIME_READ_SOURCE_IDS.NATIVE_INTENT) {
    risks.push(buildRisk(
      PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS.CONVERTED_POLICY_NOT_NATIVE,
      'Converted policy did not read from native intent.',
      { sourceId: readPath.sourceId }
    ));
  }

  if (
    readPath.statusId !== PHASE8R_RUNTIME_READ_STATUS_IDS.NATIVE_INTENT_ACTIVE ||
    readPath.validation?.ok !== true
  ) {
    risks.push(buildRisk(
      PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS.CONVERTED_NATIVE_READ_INVALID,
      'Converted native read path is not active and valid.',
      { statusId: readPath.statusId }
    ));
  }

  return { readPath, risks };
}

function evaluateUnconvertedRead(unconvertedPolicy) {
  const readPath = buildPolicyBuilderPhase8NativeRuntimeReadPath({
    policy: unconvertedPolicy,
  });
  const risks = [];

  if (readPath.sourceId !== PHASE8R_RUNTIME_READ_SOURCE_IDS.COMPATIBILITY_BRIDGE) {
    risks.push(buildRisk(
      PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS.UNCONVERTED_POLICY_NOT_COMPATIBILITY,
      'Unconverted policy did not stay on compatibility bridge fallback.',
      { sourceId: readPath.sourceId }
    ));
  }

  return { readPath, risks };
}

function determineStatusId(risks) {
  if (risks.some(risk => [
    PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS.CONVERTED_POLICY_NOT_NATIVE,
    PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS.CONVERTED_NATIVE_READ_INVALID,
  ].includes(risk.riskId))) {
    return PHASE8R_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.BLOCKED_BY_NATIVE_READ;
  }

  if (risks.some(risk =>
    risk.riskId === PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS.UNCONVERTED_POLICY_NOT_COMPATIBILITY
  )) {
    return PHASE8R_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.BLOCKED_BY_COMPATIBILITY_FALLBACK;
  }

  if (risks.some(risk =>
    risk.riskId === PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS.ROLLBACK_NOT_AVAILABLE
  )) {
    return PHASE8R_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.BLOCKED_BY_ROLLBACK;
  }

  if (risks.some(risk => [
    PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS.LEGACY_DELETION_NOT_BLOCKED,
    PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS.SUPPORT_DIAGNOSTICS_NOT_SAFE,
  ].includes(risk.riskId))) {
    return PHASE8R_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.BLOCKED_BY_DELETION_GATE;
  }

  return PHASE8R_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.READY_FOR_CUTOVER_MONITORING;
}

function buildPolicyBuilderPhase8NativeRuntimeCutoverVerification({
  convertedPolicy = {},
  unconvertedPolicy = {},
  rollbackAvailable = false,
  legacyDeletionBlocked = true,
  supportDiagnosticsSafe = true,
} = {}) {
  const converted = evaluateConvertedRead(convertedPolicy);
  const unconverted = evaluateUnconvertedRead(unconvertedPolicy);
  const risks = [
    ...converted.risks,
    ...unconverted.risks,
  ];

  if (rollbackAvailable !== true) {
    risks.push(buildRisk(
      PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS.ROLLBACK_NOT_AVAILABLE,
      'Native runtime cutover verification requires rollback availability before deletion.'
    ));
  }

  if (legacyDeletionBlocked !== true) {
    risks.push(buildRisk(
      PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS.LEGACY_DELETION_NOT_BLOCKED,
      'Legacy compatibility deletion must remain blocked until later deletion gates pass.'
    ));
  }

  if (supportDiagnosticsSafe !== true) {
    risks.push(buildRisk(
      PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS.SUPPORT_DIAGNOSTICS_NOT_SAFE,
      'Support diagnostics must remain bounded and avoid raw policy payload exposure.'
    ));
  }

  const verification = {
    version: PHASE8R_NATIVE_RUNTIME_CUTOVER_VERIFICATION_VERSION,
    statusId: determineStatusId(risks),
    convertedRead: {
      sourceId: converted.readPath.sourceId,
      statusId: converted.readPath.statusId,
      validationOk: converted.readPath.validation?.ok === true,
      dependsOnCustomSignals: converted.readPath.dependsOnCustomSignals === true,
      trace: converted.readPath.trace,
    },
    unconvertedRead: {
      sourceId: unconverted.readPath.sourceId,
      statusId: unconverted.readPath.statusId,
      validationOk: unconverted.readPath.validation?.ok === true,
      dependsOnCustomSignals: unconverted.readPath.dependsOnCustomSignals === true,
      trace: unconverted.readPath.trace,
    },
    rollbackAvailable: rollbackAvailable === true,
    legacyDeletionBlocked: legacyDeletionBlocked === true,
    supportDiagnosticsSafe: supportDiagnosticsSafe === true,
    riskCount: risks.length,
    risks,
    sideEffects: {
      policyStorageMutated: false,
      nativeRowsWritten: false,
      rollbackSnapshotsWritten: false,
      legacyPathsDeleted: false,
    },
    nextPhase: {
      phaseId: '8r_14',
      label: 'Compatibility Path Deletion Readiness',
      reason: 'Runtime cutover can now be verified; the next step is proving deletion readiness without removing rollback support prematurely.',
    },
  };

  return {
    ...verification,
    validation: validatePolicyBuilderPhase8NativeRuntimeCutoverVerification(verification),
  };
}

function validatePolicyBuilderPhase8NativeRuntimeCutoverVerification(verification = {}) {
  const issues = [];

  if (!Object.values(PHASE8R_NATIVE_RUNTIME_CUTOVER_STATUS_IDS).includes(verification.statusId)) {
    issues.push({
      riskId: 'unknown_status',
      message: 'Native runtime cutover verification status must be known.',
    });
  }

  Object.entries(verification.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS.SIDE_EFFECT_PERFORMED,
        message: `Native runtime cutover verification cannot perform side effect "${key}".`,
      });
    }
  });

  if (verification.riskCount !== asArray(verification.risks).length) {
    issues.push({
      riskId: 'risk_count_mismatch',
      message: 'Risk count must match bounded risk list length.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  PHASE8R_NATIVE_RUNTIME_CUTOVER_RISK_IDS,
  PHASE8R_NATIVE_RUNTIME_CUTOVER_STATUS_IDS,
  PHASE8R_NATIVE_RUNTIME_CUTOVER_VERIFICATION_VERSION,
  buildPolicyBuilderPhase8NativeRuntimeCutoverVerification,
  validatePolicyBuilderPhase8NativeRuntimeCutoverVerification,
};
