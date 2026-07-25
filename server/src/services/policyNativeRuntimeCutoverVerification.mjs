import {
  POLICY_RUNTIME_READ_SOURCE_IDS,
  POLICY_RUNTIME_READ_STATUS_IDS,
  buildPolicyIntentRuntimeReadPath,
} from './policyIntentRuntimeReadPath.mjs';

const POLICY_NATIVE_RUNTIME_CUTOVER_VERIFICATION_VERSION =
  'policy.native_runtime_cutover_verification.v1';

const POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS = Object.freeze({
  READY_FOR_CUTOVER_MONITORING: 'ready_for_cutover_monitoring',
  BLOCKED_BY_NATIVE_READ: 'blocked_by_native_read',
  BLOCKED_BY_COMPATIBILITY_FALLBACK: 'blocked_by_compatibility_fallback',
  BLOCKED_BY_ROLLBACK: 'blocked_by_rollback',
  BLOCKED_BY_DELETION_GATE: 'blocked_by_deletion_gate',
});

const POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS = Object.freeze({
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

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function policyRiskMetadata(policy = {}) {
  const policyId = Number(policy.id);

  return Number.isInteger(policyId) && policyId > 0 ? { policyId } : {};
}

function evaluateConvertedRead(convertedPolicy) {
  const readPath = buildPolicyIntentRuntimeReadPath({
    policy: convertedPolicy,
  });
  const risks = [];

  if (readPath.sourceId !== POLICY_RUNTIME_READ_SOURCE_IDS.NATIVE_INTENT) {
    risks.push(buildRisk(
      POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.CONVERTED_POLICY_NOT_NATIVE,
      'Converted policy did not read from native intent.',
      { ...policyRiskMetadata(convertedPolicy), sourceId: readPath.sourceId }
    ));
  }

  if (
    readPath.statusId !== POLICY_RUNTIME_READ_STATUS_IDS.NATIVE_INTENT_ACTIVE ||
    readPath.validation?.ok !== true
  ) {
    risks.push(buildRisk(
      POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.CONVERTED_NATIVE_READ_INVALID,
      'Converted native read path is not active and valid.',
      { ...policyRiskMetadata(convertedPolicy), statusId: readPath.statusId }
    ));
  }

  return { readPath, risks };
}

function evaluateUnconvertedRead(unconvertedPolicy) {
  const readPath = buildPolicyIntentRuntimeReadPath({
    policy: unconvertedPolicy,
  });
  const risks = [];

  if (readPath.sourceId !== POLICY_RUNTIME_READ_SOURCE_IDS.COMPATIBILITY_BRIDGE) {
    risks.push(buildRisk(
      POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.UNCONVERTED_POLICY_NOT_COMPATIBILITY,
      'Unconverted policy did not stay on compatibility bridge fallback.',
      { ...policyRiskMetadata(unconvertedPolicy), sourceId: readPath.sourceId }
    ));
  }

  return { readPath, risks };
}

function normalizePolicyCollection(policies, fallbackPolicy) {
  if (Array.isArray(policies)) {
    return policies.filter(policy => Object.keys(asObject(policy)).length > 0);
  }

  return [asObject(fallbackPolicy)];
}

function buildReadAssessmentSummary(assessments = []) {
  const normalizedAssessments = asArray(assessments);
  const invalidAssessments = normalizedAssessments.filter(assessment => assessment.risks.length > 0);
  const firstReadPath = normalizedAssessments[0]?.readPath;

  if (!firstReadPath) {
    return {
      assessed: false,
      sourceId: null,
      statusId: null,
      validationOk: null,
      dependsOnCustomSignals: false,
      trace: [],
      assessedPolicyCount: 0,
      invalidPolicyCount: 0,
      sampleInvalidPolicyIds: [],
    };
  }

  return {
    assessed: true,
    sourceId: firstReadPath.sourceId,
    statusId: firstReadPath.statusId,
    validationOk: firstReadPath.validation?.ok === true,
    dependsOnCustomSignals: firstReadPath.dependsOnCustomSignals === true,
    trace: firstReadPath.trace,
    assessedPolicyCount: normalizedAssessments.length,
    invalidPolicyCount: invalidAssessments.length,
    sampleInvalidPolicyIds: invalidAssessments
      .map(assessment => Number(assessment.policy?.id))
      .filter(policyId => Number.isInteger(policyId) && policyId > 0)
      .slice(0, 10),
  };
}

function assessPolicyCollection(policies, evaluateRead) {
  return policies.map(policy => ({
    policy,
    ...evaluateRead(policy),
  }));
}

function determineStatusId(risks) {
  if (risks.some(risk => [
    POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.CONVERTED_POLICY_NOT_NATIVE,
    POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.CONVERTED_NATIVE_READ_INVALID,
  ].includes(risk.riskId))) {
    return POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.BLOCKED_BY_NATIVE_READ;
  }

  if (risks.some(risk =>
    risk.riskId === POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.UNCONVERTED_POLICY_NOT_COMPATIBILITY
  )) {
    return POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.BLOCKED_BY_COMPATIBILITY_FALLBACK;
  }

  if (risks.some(risk =>
    risk.riskId === POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.ROLLBACK_NOT_AVAILABLE
  )) {
    return POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.BLOCKED_BY_ROLLBACK;
  }

  if (risks.some(risk => [
    POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.LEGACY_DELETION_NOT_BLOCKED,
    POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.SUPPORT_DIAGNOSTICS_NOT_SAFE,
  ].includes(risk.riskId))) {
    return POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.BLOCKED_BY_DELETION_GATE;
  }

  return POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.READY_FOR_CUTOVER_MONITORING;
}

function buildPolicyNativeRuntimeCutoverVerification({
  convertedPolicy = {},
  unconvertedPolicy = {},
  convertedPolicies = undefined,
  unconvertedPolicies = undefined,
  rollbackAvailable = false,
  legacyDeletionBlocked = true,
  supportDiagnosticsSafe = true,
  generatedAt = null,
} = {}) {
  const convertedAssessments = assessPolicyCollection(
    normalizePolicyCollection(convertedPolicies, convertedPolicy),
    evaluateConvertedRead
  );
  const unconvertedAssessments = assessPolicyCollection(
    normalizePolicyCollection(unconvertedPolicies, unconvertedPolicy),
    evaluateUnconvertedRead
  );
  const converted = buildReadAssessmentSummary(convertedAssessments);
  const unconverted = buildReadAssessmentSummary(unconvertedAssessments);
  const risks = [
    ...convertedAssessments.flatMap(assessment => assessment.risks),
    ...unconvertedAssessments.flatMap(assessment => assessment.risks),
  ];

  if (rollbackAvailable !== true) {
    risks.push(buildRisk(
      POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.ROLLBACK_NOT_AVAILABLE,
      'Native runtime cutover verification requires rollback availability before deletion.'
    ));
  }

  if (legacyDeletionBlocked !== true) {
    risks.push(buildRisk(
      POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.LEGACY_DELETION_NOT_BLOCKED,
      'Legacy compatibility deletion must remain blocked until later deletion gates pass.'
    ));
  }

  if (supportDiagnosticsSafe !== true) {
    risks.push(buildRisk(
      POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.SUPPORT_DIAGNOSTICS_NOT_SAFE,
      'Support diagnostics must remain bounded and avoid raw policy payload exposure.'
    ));
  }

  const verification = {
    version: POLICY_NATIVE_RUNTIME_CUTOVER_VERIFICATION_VERSION,
    generatedAt: generatedAt || new Date().toISOString(),
    statusId: determineStatusId(risks),
    convertedRead: converted,
    unconvertedRead: unconverted,
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
    nextStep: {
      stepId: 'compatibility_path_deletion_readiness',
      label: 'Compatibility Path Deletion Readiness',
      reason: 'Runtime cutover can now be verified; the next step is proving deletion readiness without removing rollback support prematurely.',
    },
  };

  return {
    ...verification,
    validation: validatePolicyNativeRuntimeCutoverVerification(verification),
  };
}

function validatePolicyNativeRuntimeCutoverVerification(verification = {}) {
  const issues = [];

  if (!Object.values(POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS).includes(verification.statusId)) {
    issues.push({
      riskId: 'unknown_status',
      message: 'Native runtime cutover verification status must be known.',
    });
  }

  Object.entries(verification.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS.SIDE_EFFECT_PERFORMED,
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
  POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS,
  POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS,
  POLICY_NATIVE_RUNTIME_CUTOVER_VERIFICATION_VERSION,
  buildPolicyNativeRuntimeCutoverVerification,
  validatePolicyNativeRuntimeCutoverVerification,
};
