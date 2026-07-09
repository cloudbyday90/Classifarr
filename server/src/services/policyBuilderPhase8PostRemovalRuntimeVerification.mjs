import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
  applyPolicyControlledCompatibilityPathRemoval,
} from './policyControlledCompatibilityPathRemovalApply.mjs';

const PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_VERSION =
  'phase8r.post_removal_runtime_verification.v1';

const PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS = Object.freeze({
  VERIFIED: 'verified',
  BLOCKED_BY_APPLY_EVIDENCE: 'blocked_by_apply_evidence',
  BLOCKED_BY_IMPORT_REFERENCES: 'blocked_by_import_references',
  BLOCKED_BY_RUNTIME_CHECKS: 'blocked_by_runtime_checks',
  BLOCKED_BY_VALIDATION: 'blocked_by_validation',
});

const PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS = Object.freeze({
  APPLY_NOT_COMPLETE: 'apply_not_complete',
  APPLY_VALIDATION_FAILED: 'apply_validation_failed',
  APPLY_RESULT_COUNT_MISMATCH: 'apply_result_count_mismatch',
  IMPORT_SCAN_MISSING: 'import_scan_missing',
  REMOVED_PATH_STILL_REFERENCED: 'removed_path_still_referenced',
  RUNTIME_CHECK_MISSING: 'runtime_check_missing',
  RUNTIME_CHECK_FAILED: 'runtime_check_failed',
  FOCUSED_VALIDATION_MISSING: 'focused_validation_missing',
  FOCUSED_VALIDATION_FAILED: 'focused_validation_failed',
  FULL_VALIDATION_MISSING: 'full_validation_missing',
  FULL_VALIDATION_FAILED: 'full_validation_failed',
  UNEXPECTED_SIDE_EFFECT: 'unexpected_side_effect',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
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

function evaluateApplyEvidence(applyEvidence) {
  const evidence = applyEvidence || {
    statusId: null,
    applied: false,
    validation: { ok: false, issueCount: null },
    applyBatch: { requestedCount: 0, results: [] },
  };
  const risks = [];

  if (
    evidence.statusId !== POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED ||
    evidence.applied !== true
  ) {
    risks.push(buildRisk(
      PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.APPLY_NOT_COMPLETE,
      'Post-removal runtime verification requires completed Phase 8R.18 apply evidence.',
      { statusId: evidence.statusId || null }
    ));
  }

  if (evidence.validation?.ok !== true) {
    risks.push(buildRisk(
      PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.APPLY_VALIDATION_FAILED,
      'Post-removal runtime verification requires valid Phase 8R.18 apply evidence.',
      { issueCount: evidence.validation?.issueCount ?? null }
    ));
  }

  const results = asArray(evidence.applyBatch?.results);
  const requestedCount = Number(evidence.applyBatch?.requestedCount ?? results.length);
  if (requestedCount !== results.length) {
    risks.push(buildRisk(
      PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.APPLY_RESULT_COUNT_MISMATCH,
      'Post-removal runtime verification requires apply result count to match requested count.',
      {
        requestedCount,
        resultCount: results.length,
      }
    ));
  }

  return {
    evidence,
    appliedPaths: results.map(result => normalizePath(result.path)).filter(Boolean),
    risks,
  };
}

function evaluateImportEvidence({
  appliedPaths = [],
  importScan = {},
}) {
  const risks = [];
  const scanPaths = asArray(importScan.checkedPaths).map(normalizePath).filter(Boolean);
  const references = asArray(importScan.references).map(reference => ({
    path: normalizePath(reference.path),
    referencedBy: reference.referencedBy || null,
  }));

  if (importScan.completed !== true || scanPaths.length === 0) {
    risks.push(buildRisk(
      PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.IMPORT_SCAN_MISSING,
      'Post-removal verification requires completed import/reference scan evidence.'
    ));
  }

  appliedPaths.forEach(path => {
    if (!scanPaths.includes(path)) {
      risks.push(buildRisk(
        PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.IMPORT_SCAN_MISSING,
        'Post-removal import scan must include every applied removal path.',
        { path }
      ));
    }

    references
      .filter(reference => reference.path === path)
      .forEach(reference => {
        risks.push(buildRisk(
          PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.REMOVED_PATH_STILL_REFERENCED,
          'Removed compatibility path is still referenced after apply.',
          reference
        ));
      });
  });

  return {
    checkedPathCount: scanPaths.length,
    referenceCount: references.length,
    risks,
  };
}

function evaluateRuntimeChecks(runtimeChecks = []) {
  const checks = asArray(runtimeChecks);
  const risks = [];

  if (checks.length === 0) {
    risks.push(buildRisk(
      PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.RUNTIME_CHECK_MISSING,
      'Post-removal verification requires at least one focused runtime/import check.'
    ));
  }

  checks.forEach(check => {
    if (check?.passed !== true) {
      risks.push(buildRisk(
        PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.RUNTIME_CHECK_FAILED,
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
      PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.FOCUSED_VALIDATION_MISSING,
      'Post-removal verification requires focused validation evidence.'
    ));
  } else if (validationEvidence.focused.passed !== true) {
    risks.push(buildRisk(
      PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.FOCUSED_VALIDATION_FAILED,
      'Post-removal focused validation failed.',
      {
        command: validationEvidence.focused.command || null,
        message: validationEvidence.focused.message || null,
      }
    ));
  }

  if (!validationEvidence.full) {
    risks.push(buildRisk(
      PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.FULL_VALIDATION_MISSING,
      'Post-removal verification requires full validation evidence.'
    ));
  } else if (validationEvidence.full.passed !== true) {
    risks.push(buildRisk(
      PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.FULL_VALIDATION_FAILED,
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
      PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.UNEXPECTED_SIDE_EFFECT,
      'Post-removal verification does not allow storage mutation evidence.',
      { sideEffect: 'storageChanged' }
    ));
  }

  if (sideEffects.gitCommandsRun === true) {
    risks.push(buildRisk(
      PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.UNEXPECTED_SIDE_EFFECT,
      'Post-removal verification does not run Git commands inside the verifier.',
      { sideEffect: 'gitCommandsRun' }
    ));
  }

  return risks;
}

function determineStatusId(risks = []) {
  if (risks.some(risk => [
    PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.APPLY_NOT_COMPLETE,
    PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.APPLY_VALIDATION_FAILED,
    PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.APPLY_RESULT_COUNT_MISMATCH,
  ].includes(risk.riskId))) {
    return PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.BLOCKED_BY_APPLY_EVIDENCE;
  }

  if (risks.some(risk => [
    PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.IMPORT_SCAN_MISSING,
    PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.REMOVED_PATH_STILL_REFERENCED,
  ].includes(risk.riskId))) {
    return PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS
      .BLOCKED_BY_IMPORT_REFERENCES;
  }

  if (risks.some(risk => [
    PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.RUNTIME_CHECK_MISSING,
    PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.RUNTIME_CHECK_FAILED,
  ].includes(risk.riskId))) {
    return PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.BLOCKED_BY_RUNTIME_CHECKS;
  }

  if (risks.length > 0) {
    return PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.BLOCKED_BY_VALIDATION;
  }

  return PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.VERIFIED;
}

async function buildDefaultApplyEvidence() {
  return applyPolicyControlledCompatibilityPathRemoval();
}

async function buildPolicyBuilderPhase8PostRemovalRuntimeVerification({
  applyEvidence = null,
  importScan = {},
  runtimeChecks = [],
  validationEvidence = {},
  sideEffects = {},
} = {}) {
  const resolvedApplyEvidence = applyEvidence || await buildDefaultApplyEvidence();
  const applyEvaluation = evaluateApplyEvidence(resolvedApplyEvidence);
  const importEvaluation = evaluateImportEvidence({
    appliedPaths: applyEvaluation.appliedPaths,
    importScan,
  });
  const runtimeEvaluation = evaluateRuntimeChecks(runtimeChecks);
  const risks = [
    ...applyEvaluation.risks,
    ...importEvaluation.risks,
    ...runtimeEvaluation.risks,
    ...evaluateValidationEvidence(validationEvidence),
    ...evaluateSideEffects(sideEffects),
  ];
  const verification = {
    version: PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_VERSION,
    statusId: determineStatusId(risks),
    verified: risks.length === 0,
    applyEvidence: {
      statusId: resolvedApplyEvidence.statusId || null,
      validationOk: resolvedApplyEvidence.validation?.ok === true,
      applied: resolvedApplyEvidence.applied === true,
      appliedPathCount: applyEvaluation.appliedPaths.length,
      appliedPaths: applyEvaluation.appliedPaths,
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
    nextPhase: {
      phaseId: '8r_20',
      label: 'Next Compatibility Removal Batch Authorization',
      reason:
        'After post-removal runtime verification passes, the next batch can be authorized from the remaining approved manifest paths.',
    },
  };

  return {
    ...verification,
    validation: validatePolicyBuilderPhase8PostRemovalRuntimeVerification(verification),
  };
}

function validatePolicyBuilderPhase8PostRemovalRuntimeVerification(verification = {}) {
  const issues = [];

  if (!Object.values(PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS)
    .includes(verification.statusId)) {
    issues.push(buildRisk(
      PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.UNKNOWN_STATUS,
      'Post-removal runtime verification status must be known.'
    ));
  }

  if (verification.riskCount !== asArray(verification.risks).length) {
    issues.push(buildRisk(
      PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.RISK_COUNT_MISMATCH,
      'Post-removal runtime verification risk count must match risk list length.'
    ));
  }

  issues.push(...evaluateSideEffects(verification.sideEffects || {}));

  Object.entries(verification.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.SIDE_EFFECT_PERFORMED,
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
  PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS,
  PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS,
  PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_VERSION,
  buildPolicyBuilderPhase8PostRemovalRuntimeVerification,
  validatePolicyBuilderPhase8PostRemovalRuntimeVerification,
};
