import {
  POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_MODE_IDS,
  POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS,
  evaluatePolicyPostRemovalApplyEligibility,
} from './policyPostRemovalApplyEligibility.mjs';
import {
  POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS,
  validatePolicyPostRemovalRuntimeEvidenceArtifact,
} from './policyPostRemovalRuntimeEvidenceArtifact.mjs';

const POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_VERSION =
  'policy.post_removal_runtime_verification.v3';

const POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS = Object.freeze({
  VERIFIED: 'verified',
  VERIFIED_PARTIAL_APPLY: 'verified_partial_apply',
  BLOCKED_BY_EVIDENCE_INTEGRITY: 'blocked_by_evidence_integrity',
  BLOCKED_BY_APPLY_EVIDENCE: 'blocked_by_apply_evidence',
  BLOCKED_BY_IMPORT_REFERENCES: 'blocked_by_import_references',
  BLOCKED_BY_RUNTIME_CHECKS: 'blocked_by_runtime_checks',
  BLOCKED_BY_VALIDATION: 'blocked_by_validation',
});

const POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS = Object.freeze({
  RUNTIME_EVIDENCE_ARTIFACT_MISSING: 'runtime_evidence_artifact_missing',
  RUNTIME_EVIDENCE_ARTIFACT_INVALID: 'runtime_evidence_artifact_invalid',
  ...POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS,
  IMPORT_SCAN_MISSING: 'import_scan_missing',
  REMOVED_PATH_STILL_REFERENCED: 'removed_path_still_referenced',
  RUNTIME_CHECK_MISSING: 'runtime_check_missing',
  RUNTIME_CHECK_FAILED: 'runtime_check_failed',
  FOCUSED_VALIDATION_MISSING: 'focused_validation_missing',
  FOCUSED_VALIDATION_FAILED: 'focused_validation_failed',
  FULL_VALIDATION_MISSING: 'full_validation_missing',
  FULL_VALIDATION_FAILED: 'full_validation_failed',
  PARTIAL_EVIDENCE_SCOPE_MISSING: 'partial_evidence_scope_missing',
  PARTIAL_EVIDENCE_SCOPE_MISMATCH: 'partial_evidence_scope_mismatch',
  UNEXPECTED_SIDE_EFFECT: 'unexpected_side_effect',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
  VERIFICATION_STATE_MISMATCH: 'verification_state_mismatch',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').trim();
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function evaluateRuntimeEvidenceArtifact(runtimeEvidenceArtifact = null) {
  const validation = validatePolicyPostRemovalRuntimeEvidenceArtifact(
    runtimeEvidenceArtifact
  );
  const risks = [];

  if (!validation.ok) {
    const hasMissingArtifact = validation.issues.some(issue =>
      issue.riskId ===
      POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .MISSING_RUNTIME_EVIDENCE_ARTIFACT
    );
    risks.push(buildRisk(
      hasMissingArtifact
        ? POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS
          .RUNTIME_EVIDENCE_ARTIFACT_MISSING
        : POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS
          .RUNTIME_EVIDENCE_ARTIFACT_INVALID,
      hasMissingArtifact
        ? 'Post-removal runtime verification requires a runtime evidence artifact.'
        : 'Post-removal runtime verification requires an intact runtime evidence artifact.',
      {
        issueCount: validation.issueCount,
        issueRiskIds: validation.issues.map(issue => issue.riskId),
      }
    ));
  }

  return {
    evidence: asObject(runtimeEvidenceArtifact?.evidence),
    validation,
    risks,
  };
}

function evaluateImportEvidence({
  appliedPaths = [],
  importScan = {},
  requireExactScope = false,
}) {
  const risks = [];
  const scanPaths = asArray(importScan.checkedPaths).map(normalizePath).filter(Boolean);
  const references = asArray(importScan.references).map(reference => ({
    path: normalizePath(reference.path),
    referencedBy: reference.referencedBy || null,
  }));

  if (importScan.completed !== true || scanPaths.length === 0) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.IMPORT_SCAN_MISSING,
      'Post-removal verification requires completed import/reference scan evidence.'
    ));
  }

  appliedPaths.forEach(path => {
    if (!scanPaths.includes(path)) {
      risks.push(buildRisk(
        POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.IMPORT_SCAN_MISSING,
        'Post-removal import scan must include every applied removal path.',
        { path }
      ));
    }

    references
      .filter(reference => reference.path === path)
      .forEach(reference => {
        risks.push(buildRisk(
          POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.REMOVED_PATH_STILL_REFERENCED,
          'Removed compatibility path is still referenced after apply.',
          reference
        ));
      });
  });

  if (requireExactScope) {
    const appliedPathSet = new Set(appliedPaths);
    const scanPathSet = new Set(scanPaths);
    const hasExactScope = scanPathSet.size === appliedPathSet.size &&
      [...appliedPathSet].every(path => scanPathSet.has(path));

    if (!hasExactScope) {
      risks.push(buildRisk(
        POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS
          .PARTIAL_EVIDENCE_SCOPE_MISMATCH,
        'Partial post-removal import evidence must cover exactly the applied path prefix.',
        { appliedPaths, checkedPaths: scanPaths }
      ));
    }
  }

  return {
    checkedPathCount: scanPaths.length,
    referenceCount: references.length,
    risks,
  };
}

function evaluatePartialEvidenceScope({
  appliedPaths = [],
  runtimeChecks = [],
  validationEvidence = {},
  partialApply = false,
} = {}) {
  if (!partialApply) return [];

  const risks = [];
  const expectedPathSet = new Set(appliedPaths);
  const evidenceRecords = [
    ...asArray(runtimeChecks).map((check, index) => ({
      record: check,
      evidenceType: 'runtime_check',
      index,
    })),
    {
      record: validationEvidence.focused,
      evidenceType: 'focused_validation',
      index: null,
    },
    {
      record: validationEvidence.full,
      evidenceType: 'full_validation',
      index: null,
    },
  ];

  evidenceRecords.forEach(({ record, evidenceType, index }) => {
    const checkedPaths = asArray(record?.checkedPaths)
      .map(normalizePath)
      .filter(Boolean);
    const checkedPathSet = new Set(checkedPaths);

    if (checkedPathSet.size === 0) {
      risks.push(buildRisk(
        POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS
          .PARTIAL_EVIDENCE_SCOPE_MISSING,
        'Partial post-removal evidence must declare the applied paths it checked.',
        { evidenceType, index }
      ));
      return;
    }

    const hasExactScope = checkedPathSet.size === expectedPathSet.size &&
      [...expectedPathSet].every(path => checkedPathSet.has(path));
    if (!hasExactScope) {
      risks.push(buildRisk(
        POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS
          .PARTIAL_EVIDENCE_SCOPE_MISMATCH,
        'Partial post-removal evidence must cover exactly the applied path prefix.',
        { evidenceType, index, appliedPaths, checkedPaths }
      ));
    }
  });

  return risks;
}

function evaluateRuntimeChecks(runtimeChecks = []) {
  const checks = asArray(runtimeChecks);
  const risks = [];

  if (checks.length === 0) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.RUNTIME_CHECK_MISSING,
      'Post-removal verification requires at least one focused runtime/import check.'
    ));
  }

  checks.forEach(check => {
    if (check?.passed !== true) {
      risks.push(buildRisk(
        POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.RUNTIME_CHECK_FAILED,
        'Post-removal runtime/import check failed.',
        {
          checkId: check?.checkId || null,
          message: check?.message || null,
        }
      ));
    }
  });

  return {
    checkCount: checks.length,
    passedCount: checks.filter(check => check?.passed === true).length,
    risks,
  };
}

function evaluateValidationEvidence(validationEvidence = {}) {
  const risks = [];

  if (!validationEvidence.focused) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.FOCUSED_VALIDATION_MISSING,
      'Post-removal verification requires focused validation evidence.'
    ));
  } else if (validationEvidence.focused.passed !== true) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.FOCUSED_VALIDATION_FAILED,
      'Post-removal focused validation failed.',
      {
        command: validationEvidence.focused.command || null,
        message: validationEvidence.focused.message || null,
      }
    ));
  }

  if (!validationEvidence.full) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.FULL_VALIDATION_MISSING,
      'Post-removal verification requires full validation evidence.'
    ));
  } else if (validationEvidence.full.passed !== true) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.FULL_VALIDATION_FAILED,
      'Post-removal full validation failed.',
      {
        command: validationEvidence.full.command || null,
        message: validationEvidence.full.message || null,
      }
    ));
  }

  return risks;
}

function evaluateSideEffects(sideEffects = {}) {
  const risks = [];

  if (sideEffects.storageChanged === true) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.UNEXPECTED_SIDE_EFFECT,
      'Post-removal verification does not allow storage mutation evidence.',
      { sideEffect: 'storageChanged' }
    ));
  }

  if (sideEffects.gitCommandsRun === true) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.UNEXPECTED_SIDE_EFFECT,
      'Post-removal verification does not run Git commands inside the verifier.',
      { sideEffect: 'gitCommandsRun' }
    ));
  }

  return risks;
}

function determineStatusId({
  risks = [],
  applyModeId = POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_MODE_IDS.INELIGIBLE,
} = {}) {
  if (risks.some(risk => [
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.RUNTIME_EVIDENCE_ARTIFACT_MISSING,
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.RUNTIME_EVIDENCE_ARTIFACT_INVALID,
  ].includes(risk.riskId))) {
    return POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS
      .BLOCKED_BY_EVIDENCE_INTEGRITY;
  }

  if (risks.some(risk => [
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.APPLY_NOT_COMPLETE,
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.APPLY_VALIDATION_FAILED,
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.APPLY_RESULT_COUNT_MISMATCH,
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.PARTIAL_APPLY_HALT_REASON_INVALID,
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.PARTIAL_APPLY_STATUS_MISMATCH,
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.PARTIAL_APPLY_PREFIX_MISSING,
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.PARTIAL_APPLY_BATCH_INVALID,
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.PARTIAL_APPLY_ENTRY_INVALID,
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.PARTIAL_APPLY_RESULT_INVALID,
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS
      .PARTIAL_APPLY_REVIEW_CONTEXT_INVALID,
  ].includes(risk.riskId))) {
    return POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.BLOCKED_BY_APPLY_EVIDENCE;
  }

  if (risks.some(risk => [
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.IMPORT_SCAN_MISSING,
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.REMOVED_PATH_STILL_REFERENCED,
  ].includes(risk.riskId))) {
    return POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS
      .BLOCKED_BY_IMPORT_REFERENCES;
  }

  if (risks.some(risk => [
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.RUNTIME_CHECK_MISSING,
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.RUNTIME_CHECK_FAILED,
  ].includes(risk.riskId))) {
    return POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.BLOCKED_BY_RUNTIME_CHECKS;
  }

  if (risks.length > 0) {
    return POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.BLOCKED_BY_VALIDATION;
  }

  return applyModeId === POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_MODE_IDS
    .PARTIAL_APPLY
    ? POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.VERIFIED_PARTIAL_APPLY
    : POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.VERIFIED;
}

function buildNextStep({ partialApply = false } = {}) {
  if (partialApply) {
    return {
      stepId: 'resolve_removal_apply_blocker',
      label: 'Resolve Removal Apply Blocker',
      reason:
        'Only the bounded applied prefix was verified. Resolve the stopped entry and create fresh reviewed evidence before another removal batch or completion audit.',
    };
  }

  return {
    stepId: 'next_compatibility_removal_batch_authorization',
    label: 'Next Compatibility Removal Batch Authorization',
    reason:
      'After post-removal runtime verification passes, the next batch can be authorized from the remaining approved manifest paths.',
  };
}

async function buildPolicyPostRemovalRuntimeVerification({
  runtimeEvidenceArtifact = null,
  sideEffects = {},
} = {}) {
  const runtimeEvidenceEvaluation = evaluateRuntimeEvidenceArtifact(
    runtimeEvidenceArtifact
  );
  const evidence = runtimeEvidenceEvaluation.evidence;
  const resolvedApplyEvidence = asObject(evidence.applyEvidence);
  const importScan = asObject(evidence.importScan);
  const runtimeChecks = asArray(evidence.runtimeChecks);
  const validationEvidence = asObject(evidence.validationEvidence);
  const applyEvaluation = evaluatePolicyPostRemovalApplyEligibility(
    resolvedApplyEvidence
  );
  const importEvaluation = evaluateImportEvidence({
    appliedPaths: applyEvaluation.appliedPaths,
    importScan,
    requireExactScope: applyEvaluation.partialApply,
  });
  const runtimeEvaluation = evaluateRuntimeChecks(runtimeChecks);
  const risks = [
    ...runtimeEvidenceEvaluation.risks,
    ...applyEvaluation.risks,
    ...importEvaluation.risks,
    ...runtimeEvaluation.risks,
    ...evaluateValidationEvidence(validationEvidence),
    ...evaluatePartialEvidenceScope({
      appliedPaths: applyEvaluation.appliedPaths,
      runtimeChecks,
      validationEvidence,
      partialApply: applyEvaluation.partialApply,
    }),
    ...evaluateSideEffects(sideEffects),
  ];
  const statusId = determineStatusId({
    risks,
    applyModeId: applyEvaluation.modeId,
  });
  const partialApplyVerified =
    statusId === POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS
      .VERIFIED_PARTIAL_APPLY;
  const verified = statusId ===
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.VERIFIED;
  const verification = {
    version: POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_VERSION,
    statusId,
    verified,
    partialApplyVerified,
    verificationScope: {
      modeId: applyEvaluation.modeId,
      partialApply: applyEvaluation.partialApply,
      authorizationEligible: applyEvaluation.authorizationEligible,
      appliedPathCount: applyEvaluation.appliedPathCount,
    },
    applyEvidence: {
      statusId: resolvedApplyEvidence.statusId || null,
      validationOk: resolvedApplyEvidence.validation?.ok === true,
      applied: resolvedApplyEvidence.applied === true,
      modeId: applyEvaluation.modeId,
      appliedPathCount: applyEvaluation.appliedPaths.length,
      appliedPaths: applyEvaluation.appliedPaths,
      reviewArtifactFingerprint:
        runtimeEvidenceEvaluation.validation.reviewArtifactFingerprint,
    },
    runtimeEvidenceArtifact: {
      valid: runtimeEvidenceEvaluation.validation.ok,
      fingerprint: runtimeEvidenceArtifact?.fingerprint || null,
      reviewArtifactFingerprint:
        runtimeEvidenceEvaluation.validation.reviewArtifactFingerprint,
    },
    importScan: {
      completed: importScan.completed === true,
      checkedPathCount: importEvaluation.checkedPathCount,
      referenceCount: importEvaluation.referenceCount,
    },
    runtimeChecks: {
      checkCount: runtimeEvaluation.checkCount,
      passedCount: runtimeEvaluation.passedCount,
    },
    validationEvidence: {
      focused: validationEvidence.focused || null,
      full: validationEvidence.full || null,
    },
    riskCount: risks.length,
    risks,
    sideEffects: {
      storageChanged: sideEffects.storageChanged === true,
      gitCommandsRun: sideEffects.gitCommandsRun === true,
    },
    nextStep: buildNextStep({ partialApply: partialApplyVerified }),
  };

  return {
    ...verification,
    validation: validatePolicyPostRemovalRuntimeVerification(verification),
  };
}

function validatePolicyPostRemovalRuntimeVerification(verification = {}) {
  const issues = [];

  if (!Object.values(POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS)
    .includes(verification.statusId)) {
    issues.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.UNKNOWN_STATUS,
      'Post-removal runtime verification status must be known.'
    ));
  }

  if (verification.riskCount !== asArray(verification.risks).length) {
    issues.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.RISK_COUNT_MISMATCH,
      'Post-removal runtime verification risk count must match risk list length.'
    ));
  }

  const verificationScope = asObject(verification.verificationScope);
  const isCompletedVerification = verification.statusId ===
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.VERIFIED;
  const isPartialVerification = verification.statusId ===
    POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.VERIFIED_PARTIAL_APPLY;

  if (
    (isCompletedVerification && (
      verification.verified !== true ||
      verification.partialApplyVerified === true ||
      verificationScope.modeId !==
        POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_MODE_IDS.COMPLETE_APPLY ||
      verificationScope.authorizationEligible !== true
    )) ||
    (isPartialVerification && (
      verification.verified === true ||
      verification.partialApplyVerified !== true ||
      verificationScope.modeId !==
        POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_MODE_IDS.PARTIAL_APPLY ||
      verificationScope.authorizationEligible !== false ||
      verification.nextStep?.stepId !== 'resolve_removal_apply_blocker'
    ))
  ) {
    issues.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS
        .VERIFICATION_STATE_MISMATCH,
      'Post-removal runtime verification state must keep partial verification non-authorizing.'
    ));
  }

  issues.push(...evaluateSideEffects(verification.sideEffects || {}));

  Object.entries(verification.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Post-removal runtime verification cannot perform side effect "${key}".`
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
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS,
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS,
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_VERSION,
  buildPolicyPostRemovalRuntimeVerification,
  validatePolicyPostRemovalRuntimeVerification,
};
