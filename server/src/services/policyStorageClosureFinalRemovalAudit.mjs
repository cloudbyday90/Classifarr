import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
  buildPolicyCompatibilityRemovalCompletionAudit,
} from './policyCompatibilityRemovalCompletionAudit.mjs';
import {
  resolvePolicyStorageClosureExecutionPlanSource,
} from './policyStorageClosureExecutionPlanSource.mjs';

const POLICY_STORAGE_CLOSURE_FINAL_REMOVAL_AUDIT_VERSION =
  'policy.storage_closure_final_removal_audit.v2';

const POLICY_STORAGE_CLOSURE_FINAL_REMOVAL_AUDIT_STATUS_IDS = Object.freeze({
  BLOCKED_BY_EXECUTION_PLAN_ARTIFACT: 'blocked_by_execution_plan_artifact',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').trim();
}

function uniqueNormalizedPaths(paths = []) {
  return [...new Set(asArray(paths).map(normalizePath).filter(Boolean))].sort();
}

function pathsMatch(left = [], right = []) {
  const expected = uniqueNormalizedPaths(left);
  const actual = uniqueNormalizedPaths(right);

  return expected.length === actual.length &&
    expected.every((path, index) => path === actual[index]);
}

function buildManifestPathState({
  manifestPaths = [],
  fileExists = () => false,
} = {}) {
  const normalizedManifestPaths = asArray(manifestPaths)
    .map(normalizePath)
    .filter(Boolean);
  const existingPaths = [];
  const removedPaths = [];

  normalizedManifestPaths.forEach(path => {
    if (fileExists(path)) {
      existingPaths.push(path);
    } else {
      removedPaths.push(path);
    }
  });

  return {
    totalCount: normalizedManifestPaths.length,
    existingCount: existingPaths.length,
    removedCount: removedPaths.length,
    manifestPaths: normalizedManifestPaths,
    existingPaths,
    removedPaths,
  };
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

function buildPathStateVerification({ pathState = {}, audit = {} } = {}) {
  const artifactIntegrityOk = audit.authorizationArtifact?.integrityOk === true;
  const expectedRemovedPaths = asArray(audit.removalEvidence?.appliedPaths);
  const expectedRemainingPaths = asArray(audit.manifestInventory?.remainingPaths);
  const removedPathsMatch = pathsMatch(expectedRemovedPaths, pathState.removedPaths);
  const remainingPathsMatch = pathsMatch(expectedRemainingPaths, pathState.existingPaths);

  return {
    checked: artifactIntegrityOk,
    ok: !artifactIntegrityOk || (removedPathsMatch && remainingPathsMatch),
    expectedRemovedPaths: uniqueNormalizedPaths(expectedRemovedPaths),
    actualRemovedPaths: uniqueNormalizedPaths(pathState.removedPaths),
    expectedRemainingPaths: uniqueNormalizedPaths(expectedRemainingPaths),
    actualRemainingPaths: uniqueNormalizedPaths(pathState.existingPaths),
    removedPathsMatch,
    remainingPathsMatch,
  };
}

async function buildPolicyStorageClosureFinalRemovalAudit({
  executionPlanArtifact = null,
  nextBatchAuthorizationArtifact = null,
  reviewArtifactFingerprint = '',
  validationEvidence = {},
  referenceScan = {},
  fileExists = () => false,
} = {}) {
  const executionPlanSource = resolvePolicyStorageClosureExecutionPlanSource({
    executionPlanArtifact,
  });
  const executionPlan = executionPlanSource.executionPlan || {};
  const pathState = buildManifestPathState({
    manifestPaths: executionPlanSource.manifestPaths,
    fileExists,
  });
  const finalImportScan = buildFinalImportScan({
    manifestPaths: pathState.manifestPaths,
    referenceScan,
  });
  const audit = await buildPolicyCompatibilityRemovalCompletionAudit({
    nextBatchAuthorizationArtifact,
    executionPlan,
    reviewArtifactFingerprint,
    finalImportScan,
    validationEvidence,
  });
  const pathStateVerification = buildPathStateVerification({ pathState, audit });
  const statusId = !executionPlanSource.ok
    ? POLICY_STORAGE_CLOSURE_FINAL_REMOVAL_AUDIT_STATUS_IDS
      .BLOCKED_BY_EXECUTION_PLAN_ARTIFACT
    : pathStateVerification.ok
    ? audit.statusId
    : POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
      .BLOCKED_BY_AUTHORIZATION_ARTIFACT;

  return {
    version: POLICY_STORAGE_CLOSURE_FINAL_REMOVAL_AUDIT_VERSION,
    statusId,
    complete:
      statusId ===
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE &&
      audit.complete === true &&
      executionPlanSource.ok &&
      pathStateVerification.ok,
    executionPlanSource,
    pathState,
    pathStateVerification,
    finalImportScan,
    audit,
  };
}

export {
  POLICY_STORAGE_CLOSURE_FINAL_REMOVAL_AUDIT_VERSION,
  POLICY_STORAGE_CLOSURE_FINAL_REMOVAL_AUDIT_STATUS_IDS,
  buildFinalImportScan,
  buildManifestPathState,
  buildPathStateVerification,
  buildPolicyStorageClosureFinalRemovalAudit,
};
