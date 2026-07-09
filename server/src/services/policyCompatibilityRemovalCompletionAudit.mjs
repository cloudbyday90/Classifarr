import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
  buildPolicyCompatibilityDeletionExecutionPlan,
} from './policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS,
} from './policyNextCompatibilityRemovalBatchAuthorization.mjs';
import {
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS,
} from './policyPostRemovalRuntimeVerification.mjs';

const POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_VERSION =
  'policy.compatibility_removal_completion_audit.v1';

const POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  REMAINING_INVENTORY: 'remaining_inventory',
  BLOCKED_BY_AUTHORIZATION_EVIDENCE: 'blocked_by_authorization_evidence',
  BLOCKED_BY_EXECUTION_PLAN: 'blocked_by_execution_plan',
  BLOCKED_BY_REMOVAL_EVIDENCE: 'blocked_by_removal_evidence',
  BLOCKED_BY_FINAL_SCAN: 'blocked_by_final_scan',
  BLOCKED_BY_VALIDATION: 'blocked_by_validation',
});

const POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS = Object.freeze({
  AUTHORIZATION_NOT_COMPLETE: 'authorization_not_complete',
  AUTHORIZATION_VALIDATION_FAILED: 'authorization_validation_failed',
  EXECUTION_PLAN_NOT_READY: 'execution_plan_not_ready',
  EXECUTION_PLAN_VALIDATION_FAILED: 'execution_plan_validation_failed',
  NO_MANIFEST_ENTRIES: 'no_manifest_entries',
  REMOVAL_VERIFICATION_MISSING: 'removal_verification_missing',
  REMOVAL_VERIFICATION_NOT_VERIFIED: 'removal_verification_not_verified',
  REMOVED_PATH_COVERAGE_INCOMPLETE: 'removed_path_coverage_incomplete',
  FINAL_SCAN_MISSING: 'final_scan_missing',
  FINAL_SCAN_PATH_MISSING: 'final_scan_path_missing',
  FINAL_SCAN_REFERENCE_FOUND: 'final_scan_reference_found',
  FOCUSED_VALIDATION_MISSING: 'focused_validation_missing',
  FOCUSED_VALIDATION_FAILED: 'focused_validation_failed',
  FULL_VALIDATION_MISSING: 'full_validation_missing',
  FULL_VALIDATION_FAILED: 'full_validation_failed',
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

function uniqueNormalizedPaths(paths = []) {
  return [...new Set(asArray(paths).map(normalizePath).filter(Boolean))];
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function getManifestEntries(executionPlan = {}) {
  return asArray(executionPlan.manifest?.entries)
    .map(entry => ({
      ...entry,
      path: normalizePath(entry?.path),
    }))
    .filter(entry => entry.path);
}

function evaluateCompletionAuthorization(completionAuthorization = {}) {
  const risks = [];

  if (
    completionAuthorization.statusId !==
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .COMPLETE_NO_REMAINING_PATHS ||
    completionAuthorization.completedNoRemainingPaths !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .AUTHORIZATION_NOT_COMPLETE,
      'Compatibility removal completion audit requires complete next-batch authorization evidence.',
      { statusId: completionAuthorization.statusId || null }
    ));
  }

  if (completionAuthorization.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .AUTHORIZATION_VALIDATION_FAILED,
      'Compatibility removal completion audit requires valid next-batch authorization evidence.',
      { issueCount: completionAuthorization.validation?.issueCount ?? null }
    ));
  }

  return {
    remainingCount:
      Number(completionAuthorization.remainingManifest?.remainingCount ?? 0),
    removedPaths:
      uniqueNormalizedPaths(completionAuthorization.remainingManifest?.removedPaths),
    risks,
  };
}

function evaluateExecutionPlan(executionPlan = {}) {
  const risks = [];
  const entries = getManifestEntries(executionPlan);

  if (
    executionPlan.statusId !==
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE ||
    executionPlan.readyForExecutionGate !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.EXECUTION_PLAN_NOT_READY,
      'Compatibility removal completion audit requires a ready compatibility deletion execution plan.',
      { statusId: executionPlan.statusId || null }
    ));
  }

  if (executionPlan.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .EXECUTION_PLAN_VALIDATION_FAILED,
      'Compatibility removal completion audit requires a valid compatibility deletion execution plan.',
      { issueCount: executionPlan.validation?.issueCount ?? null }
    ));
  }

  if (entries.length === 0) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.NO_MANIFEST_ENTRIES,
      'Compatibility removal completion audit requires approved manifest entries.'
    ));
  }

  return {
    manifestPaths: entries.map(entry => entry.path),
    entries,
    risks,
  };
}

function evaluateRemovalVerifications(removalVerifications = []) {
  const verifications = asArray(removalVerifications);
  const risks = [];
  const appliedPaths = uniqueNormalizedPaths(verifications.flatMap(verification => (
    asArray(verification.applyEvidence?.appliedPaths)
  )));

  if (verifications.length === 0) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .REMOVAL_VERIFICATION_MISSING,
      'Compatibility removal completion audit requires verified post-removal runtime evidence.'
    ));
  }

  verifications.forEach((verification, index) => {
    if (
      verification.statusId !== POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.VERIFIED ||
      verification.verified !== true ||
      verification.validation?.ok !== true
    ) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
          .REMOVAL_VERIFICATION_NOT_VERIFIED,
        'Every removal verification used for completion must be verified and valid.',
        {
          index,
          statusId: verification.statusId || null,
        }
      ));
    }
  });

  return {
    verificationCount: verifications.length,
    verifiedCount: verifications.filter(verification => (
      verification.statusId === POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.VERIFIED &&
      verification.verified === true &&
      verification.validation?.ok === true
    )).length,
    appliedPaths,
    risks,
  };
}

function evaluatePathCoverage({
  manifestPaths = [],
  removedPaths = [],
  appliedPaths = [],
} = {}) {
  const coveredPathSet = new Set([
    ...uniqueNormalizedPaths(removedPaths),
    ...uniqueNormalizedPaths(appliedPaths),
  ]);
  const missingPaths = manifestPaths.filter(path => !coveredPathSet.has(path));

  if (missingPaths.length === 0) {
    return [];
  }

  return [buildRisk(
    POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
      .REMOVED_PATH_COVERAGE_INCOMPLETE,
    'Compatibility removal completion audit requires every approved manifest path to be covered by verified removal evidence.',
    { missingPaths }
  )];
}

function evaluateFinalImportScan({
  manifestPaths = [],
  finalImportScan = {},
} = {}) {
  const risks = [];
  const checkedPaths = uniqueNormalizedPaths(finalImportScan.checkedPaths);
  const checkedPathSet = new Set(checkedPaths);
  const references = asArray(finalImportScan.references).map(reference => ({
    path: normalizePath(reference.path),
    referencedBy: reference.referencedBy || null,
  }));

  if (finalImportScan.completed !== true || checkedPaths.length === 0) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.FINAL_SCAN_MISSING,
      'Compatibility removal completion audit requires completed final import/reference scan evidence.'
    ));
  }

  manifestPaths.forEach(path => {
    if (!checkedPathSet.has(path)) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.FINAL_SCAN_PATH_MISSING,
        'Final import/reference scan must include every approved manifest path.',
        { path }
      ));
    }
  });

  references
    .filter(reference => reference.path)
    .forEach(reference => {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
          .FINAL_SCAN_REFERENCE_FOUND,
        'Final import/reference scan found a remaining reference to a removed compatibility path.',
        reference
      ));
    });

  return {
    completed: finalImportScan.completed === true,
    checkedPathCount: checkedPaths.length,
    referenceCount: references.length,
    risks,
  };
}

function evaluateValidationEvidence(validationEvidence = {}) {
  const risks = [];

  if (!validationEvidence.focused) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .FOCUSED_VALIDATION_MISSING,
      'Compatibility removal completion audit requires focused validation evidence.'
    ));
  } else if (validationEvidence.focused.passed !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .FOCUSED_VALIDATION_FAILED,
      'Compatibility removal completion audit focused validation failed.',
      {
        command: validationEvidence.focused.command || null,
        message: validationEvidence.focused.message || null,
      }
    ));
  }

  if (!validationEvidence.full) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .FULL_VALIDATION_MISSING,
      'Compatibility removal completion audit requires full validation evidence.'
    ));
  } else if (validationEvidence.full.passed !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.FULL_VALIDATION_FAILED,
      'Compatibility removal completion audit full validation failed.',
      {
        command: validationEvidence.full.command || null,
        message: validationEvidence.full.message || null,
      }
    ));
  }

  return risks;
}

function determineStatusId({ risks = [], remainingCount = 0 } = {}) {
  if (risks.some(risk => [
    POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.AUTHORIZATION_NOT_COMPLETE,
    POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
      .AUTHORIZATION_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    if (remainingCount > 0) {
      return POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.REMAINING_INVENTORY;
    }

    return POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
      .BLOCKED_BY_AUTHORIZATION_EVIDENCE;
  }

  if (risks.some(risk => [
    POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.EXECUTION_PLAN_NOT_READY,
    POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
      .EXECUTION_PLAN_VALIDATION_FAILED,
    POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.NO_MANIFEST_ENTRIES,
  ].includes(risk.riskId))) {
    return POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
      .BLOCKED_BY_EXECUTION_PLAN;
  }

  if (risks.some(risk => [
    POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
      .REMOVAL_VERIFICATION_MISSING,
    POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
      .REMOVAL_VERIFICATION_NOT_VERIFIED,
    POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
      .REMOVED_PATH_COVERAGE_INCOMPLETE,
  ].includes(risk.riskId))) {
    return POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
      .BLOCKED_BY_REMOVAL_EVIDENCE;
  }

  if (risks.some(risk => [
    POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.FINAL_SCAN_MISSING,
    POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.FINAL_SCAN_PATH_MISSING,
    POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.FINAL_SCAN_REFERENCE_FOUND,
  ].includes(risk.riskId))) {
    return POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
      .BLOCKED_BY_FINAL_SCAN;
  }

  if (risks.length > 0) {
    return POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
      .BLOCKED_BY_VALIDATION;
  }

  return POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE;
}

function buildPolicyCompatibilityRemovalCompletionAudit({
  completionAuthorization = {},
  executionPlan = null,
  removalVerifications = [],
  finalImportScan = {},
  validationEvidence = {},
  sideEffects = {},
} = {}) {
  const resolvedExecutionPlan =
    executionPlan || buildPolicyCompatibilityDeletionExecutionPlan();
  const authorizationEvaluation = evaluateCompletionAuthorization(completionAuthorization);
  const executionPlanEvaluation = evaluateExecutionPlan(resolvedExecutionPlan);
  const removalEvaluation = evaluateRemovalVerifications(removalVerifications);
  const finalScanEvaluation = evaluateFinalImportScan({
    manifestPaths: executionPlanEvaluation.manifestPaths,
    finalImportScan,
  });
  const risks = [
    ...authorizationEvaluation.risks,
    ...executionPlanEvaluation.risks,
    ...removalEvaluation.risks,
    ...evaluatePathCoverage({
      manifestPaths: executionPlanEvaluation.manifestPaths,
      removedPaths: authorizationEvaluation.removedPaths,
      appliedPaths: removalEvaluation.appliedPaths,
    }),
    ...finalScanEvaluation.risks,
    ...evaluateValidationEvidence(validationEvidence),
  ];
  const statusId = determineStatusId({
    risks,
    remainingCount: authorizationEvaluation.remainingCount,
  });
  const audit = {
    version: POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_VERSION,
    statusId,
    complete:
      statusId === POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE,
    completionAuthorization: {
      statusId: completionAuthorization.statusId || null,
      validationOk: completionAuthorization.validation?.ok === true,
      completedNoRemainingPaths: completionAuthorization.completedNoRemainingPaths === true,
      remainingCount: authorizationEvaluation.remainingCount,
    },
    executionPlan: {
      statusId: resolvedExecutionPlan.statusId || null,
      readyForExecutionGate: resolvedExecutionPlan.readyForExecutionGate === true,
      validationOk: resolvedExecutionPlan.validation?.ok === true,
      manifestEntryCount: executionPlanEvaluation.entries.length,
    },
    manifestInventory: {
      totalCount: executionPlanEvaluation.manifestPaths.length,
      removedCount: uniqueNormalizedPaths([
        ...authorizationEvaluation.removedPaths,
        ...removalEvaluation.appliedPaths,
      ]).filter(path => executionPlanEvaluation.manifestPaths.includes(path)).length,
      remainingCount: authorizationEvaluation.remainingCount,
      manifestPaths: executionPlanEvaluation.manifestPaths,
      remainingPaths: asArray(completionAuthorization.remainingManifest?.remainingPaths)
        .map(normalizePath)
        .filter(Boolean),
    },
    removalEvidence: {
      verificationCount: removalEvaluation.verificationCount,
      verifiedCount: removalEvaluation.verifiedCount,
      appliedPaths: removalEvaluation.appliedPaths,
    },
    finalImportScan: {
      completed: finalScanEvaluation.completed,
      checkedPathCount: finalScanEvaluation.checkedPathCount,
      referenceCount: finalScanEvaluation.referenceCount,
    },
    validationEvidence: {
      focused: validationEvidence.focused || null,
      full: validationEvidence.full || null,
    },
    riskCount: risks.length,
    risks,
    sideEffects: {
      filesDeleted: sideEffects.filesDeleted === true,
      filesArchived: sideEffects.filesArchived === true,
      routesRemoved: sideEffects.routesRemoved === true,
      testsRemoved: sideEffects.testsRemoved === true,
      storageChanged: sideEffects.storageChanged === true,
      manifestWritten: sideEffects.manifestWritten === true,
      gitCommandsRun: sideEffects.gitCommandsRun === true,
    },
    nextStep: {
      stepId: 'policy_storage_completion_checkpoint',
      label: 'Policy Storage Completion Checkpoint',
      reason:
        'After compatibility removal completion is proven, run a final checkpoint against the roadmap before the storage-removal goal is considered complete.',
    },
  };

  return {
    ...audit,
    validation: validatePolicyCompatibilityRemovalCompletionAudit(audit),
  };
}

function validatePolicyCompatibilityRemovalCompletionAudit(audit = {}) {
  const issues = [];

  if (!Object.values(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS)
    .includes(audit.statusId)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.UNKNOWN_STATUS,
      'Compatibility removal completion audit status must be known.'
    ));
  }

  if (audit.riskCount !== asArray(audit.risks).length) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.RISK_COUNT_MISMATCH,
      'Compatibility removal completion audit risk count must match risk list length.'
    ));
  }

  Object.entries(audit.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Compatibility removal completion audit cannot perform side effect "${key}".`
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
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS,
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_VERSION,
  buildPolicyCompatibilityRemovalCompletionAudit,
  validatePolicyCompatibilityRemovalCompletionAudit,
};
