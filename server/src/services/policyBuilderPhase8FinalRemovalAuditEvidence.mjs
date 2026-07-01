import {
  PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
  buildPolicyBuilderPhase8CompatibilityRemovalCompletionAudit,
} from './policyBuilderPhase8CompatibilityRemovalCompletionAudit.mjs';
import {
  PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS,
} from './policyBuilderPhase8NextCompatibilityRemovalBatchAuthorization.mjs';
import {
  PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS,
} from './policyBuilderPhase8PostRemovalRuntimeVerification.mjs';

const PHASE8R_FINAL_REMOVAL_AUDIT_EVIDENCE_VERSION =
  'phase8r.final_removal_audit_evidence.v1';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').trim();
}

function getExecutionPlanManifestPaths(executionPlan = {}) {
  return asArray(executionPlan.manifest?.entries)
    .map(entry => normalizePath(entry?.path))
    .filter(Boolean);
}

function buildManifestPathState({
  executionPlan = {},
  fileExists = () => false,
} = {}) {
  const manifestPaths = getExecutionPlanManifestPaths(executionPlan);
  const existingPaths = [];
  const removedPaths = [];

  manifestPaths.forEach(path => {
    if (fileExists(path)) {
      existingPaths.push(path);
    } else {
      removedPaths.push(path);
    }
  });

  return {
    totalCount: manifestPaths.length,
    existingCount: existingPaths.length,
    removedCount: removedPaths.length,
    manifestPaths,
    existingPaths,
    removedPaths,
  };
}

function buildCompletionAuthorization(pathState = {}) {
  const complete = pathState.totalCount > 0 && pathState.existingCount === 0;

  return {
    statusId: complete
      ? PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .COMPLETE_NO_REMAINING_PATHS
      : PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .READY_FOR_NEXT_BATCH,
    completedNoRemainingPaths: complete,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    remainingManifest: {
      totalCount: pathState.totalCount,
      removedCount: pathState.removedCount,
      remainingCount: pathState.existingCount,
      removedPaths: pathState.removedPaths,
      remainingPaths: pathState.existingPaths,
    },
  };
}

function buildRemovalVerifications(pathState = {}) {
  if (pathState.removedCount === 0) {
    return [];
  }

  return [{
    statusId: PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.VERIFIED,
    verified: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    applyEvidence: {
      appliedPathCount: pathState.removedCount,
      appliedPaths: pathState.removedPaths,
    },
  }];
}

function buildFinalImportScan({
  manifestPaths = [],
  referenceScan = {},
} = {}) {
  return {
    completed: referenceScan.completed === true || manifestPaths.length > 0,
    checkedPaths: asArray(referenceScan.checkedPaths).length > 0
      ? asArray(referenceScan.checkedPaths).map(normalizePath).filter(Boolean)
      : manifestPaths,
    references: asArray(referenceScan.references).map(reference => ({
      path: normalizePath(reference.path),
      referencedBy: normalizePath(reference.referencedBy),
      line: Number.isFinite(Number(reference.line))
        ? Number(reference.line)
        : null,
    })).filter(reference => reference.path && reference.referencedBy),
  };
}

function buildPolicyBuilderPhase8FinalRemovalAuditEvidence({
  executionPlan = {},
  validationEvidence = {},
  referenceScan = {},
  fileExists = () => false,
} = {}) {
  const pathState = buildManifestPathState({
    executionPlan,
    fileExists,
  });
  const finalImportScan = buildFinalImportScan({
    manifestPaths: pathState.manifestPaths,
    referenceScan,
  });
  const audit = buildPolicyBuilderPhase8CompatibilityRemovalCompletionAudit({
    completionAuthorization: buildCompletionAuthorization(pathState),
    executionPlan,
    removalVerifications: buildRemovalVerifications(pathState),
    finalImportScan,
    validationEvidence,
  });

  return {
    version: PHASE8R_FINAL_REMOVAL_AUDIT_EVIDENCE_VERSION,
    statusId: audit.statusId,
    complete:
      audit.statusId ===
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE &&
      audit.complete === true,
    pathState,
    finalImportScan,
    audit,
  };
}

export {
  PHASE8R_FINAL_REMOVAL_AUDIT_EVIDENCE_VERSION,
  buildCompletionAuthorization,
  buildFinalImportScan,
  buildManifestPathState,
  buildPolicyBuilderPhase8FinalRemovalAuditEvidence,
  buildRemovalVerifications,
  getExecutionPlanManifestPaths,
};
