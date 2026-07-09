import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
  buildPolicyCompatibilityDeletionExecutionPlan,
} from './policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS,
} from './policyPostRemovalRuntimeVerification.mjs';

const POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_VERSION =
  'policy.next_compatibility_removal_batch_authorization.v1';

const POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS =
  Object.freeze({
    READY_FOR_NEXT_BATCH: 'ready_for_next_batch',
    COMPLETE_NO_REMAINING_PATHS: 'complete_no_remaining_paths',
    BLOCKED_BY_POST_REMOVAL_VERIFICATION: 'blocked_by_post_removal_verification',
    BLOCKED_BY_EXECUTION_PLAN: 'blocked_by_execution_plan',
    BLOCKED_BY_SELECTION: 'blocked_by_selection',
    BLOCKED_BY_SCOPE: 'blocked_by_scope',
    BLOCKED_BY_AUTHORIZATION: 'blocked_by_authorization',
  });

const POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS =
  Object.freeze({
    POST_REMOVAL_NOT_VERIFIED: 'post_removal_not_verified',
    POST_REMOVAL_VALIDATION_FAILED: 'post_removal_validation_failed',
    EXECUTION_PLAN_NOT_READY: 'execution_plan_not_ready',
    EXECUTION_PLAN_VALIDATION_FAILED: 'execution_plan_validation_failed',
    NO_MANIFEST_ENTRIES: 'no_manifest_entries',
    NO_PATHS_REQUESTED: 'no_paths_requested',
    REQUESTED_PATH_NOT_IN_MANIFEST: 'requested_path_not_in_manifest',
    REQUESTED_PATH_ALREADY_REMOVED: 'requested_path_already_removed',
    BATCH_SCOPE_TOO_BROAD: 'batch_scope_too_broad',
    MISSING_AUTHORIZATION_REASON: 'missing_authorization_reason',
    MISSING_AUTHORIZER: 'missing_authorizer',
    SIDE_EFFECT_PERFORMED: 'side_effect_performed',
    RISK_COUNT_MISMATCH: 'risk_count_mismatch',
    UNKNOWN_STATUS: 'unknown_status',
  });

const DEFAULT_MAX_BATCH_SIZE = 3;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').trim();
}

function normalizeText(value = '') {
  return String(value || '').trim();
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function uniqueNormalizedPaths(paths = []) {
  return [...new Set(asArray(paths).map(normalizePath).filter(Boolean))];
}

function getManifestEntries(executionPlan = {}) {
  return asArray(executionPlan.manifest?.entries)
    .map(entry => ({
      ...entry,
      path: normalizePath(entry?.path),
    }))
    .filter(entry => entry.path);
}

function evaluatePostRemovalVerification(postRemovalVerification = {}) {
  const risks = [];

  if (
    postRemovalVerification.statusId !==
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.VERIFIED ||
    postRemovalVerification.verified !== true
  ) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .POST_REMOVAL_NOT_VERIFIED,
      'Next compatibility removal batch authorization requires verified post-removal runtime evidence.',
      { statusId: postRemovalVerification.statusId || null }
    ));
  }

  if (postRemovalVerification.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .POST_REMOVAL_VALIDATION_FAILED,
      'Next compatibility removal batch authorization requires valid post-removal runtime evidence.',
      { issueCount: postRemovalVerification.validation?.issueCount ?? null }
    ));
  }

  return {
    removedPaths: uniqueNormalizedPaths(postRemovalVerification.applyEvidence?.appliedPaths),
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
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .EXECUTION_PLAN_NOT_READY,
      'Next compatibility removal batch authorization requires a ready compatibility deletion execution plan.',
      { statusId: executionPlan.statusId || null }
    ));
  }

  if (executionPlan.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .EXECUTION_PLAN_VALIDATION_FAILED,
      'Next compatibility removal batch authorization requires a valid compatibility deletion execution plan.',
      { issueCount: executionPlan.validation?.issueCount ?? null }
    ));
  }

  if (entries.length === 0) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.NO_MANIFEST_ENTRIES,
      'Next compatibility removal batch authorization requires approved manifest entries.'
    ));
  }

  return {
    entries,
    risks,
  };
}

function buildRemainingManifest({ manifestEntries = [], removedPaths = [] } = {}) {
  const removedPathSet = new Set(removedPaths);
  const remainingEntries = manifestEntries.filter(entry => !removedPathSet.has(entry.path));

  return {
    totalCount: manifestEntries.length,
    removedCount: manifestEntries.length - remainingEntries.length,
    remainingCount: remainingEntries.length,
    removedPaths,
    remainingPaths: remainingEntries.map(entry => entry.path),
    entries: remainingEntries,
  };
}

function evaluateRequestedBatch({
  requestedPaths = [],
  manifestEntries = [],
  remainingManifest = {},
  maxBatchSize = DEFAULT_MAX_BATCH_SIZE,
} = {}) {
  const risks = [];
  const normalizedRequestedPaths = uniqueNormalizedPaths(requestedPaths);
  const manifestPathSet = new Set(manifestEntries.map(entry => entry.path));
  const remainingPathSet = new Set(asArray(remainingManifest.remainingPaths));
  const removedPathSet = new Set(asArray(remainingManifest.removedPaths));

  if (remainingManifest.remainingCount === 0) {
    return {
      requestedPaths: normalizedRequestedPaths,
      entries: [],
      risks,
    };
  }

  if (normalizedRequestedPaths.length === 0) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.NO_PATHS_REQUESTED,
      'Next compatibility removal batch authorization requires at least one requested remaining path.'
    ));
  }

  if (normalizedRequestedPaths.length > maxBatchSize) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.BATCH_SCOPE_TOO_BROAD,
      'Next compatibility removal batch is wider than the configured maximum batch size.',
      {
        requestedCount: normalizedRequestedPaths.length,
        maxBatchSize,
      }
    ));
  }

  normalizedRequestedPaths.forEach(path => {
    if (!manifestPathSet.has(path)) {
      risks.push(buildRisk(
        POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
          .REQUESTED_PATH_NOT_IN_MANIFEST,
        'Requested compatibility removal path is not in the approved manifest.',
        { path }
      ));
    } else if (removedPathSet.has(path) || !remainingPathSet.has(path)) {
      risks.push(buildRisk(
        POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
          .REQUESTED_PATH_ALREADY_REMOVED,
        'Requested compatibility removal path was already removed and cannot re-enter a batch.',
        { path }
      ));
    }
  });

  const requestedPathSet = new Set(normalizedRequestedPaths);
  const entries = asArray(remainingManifest.entries)
    .filter(entry => requestedPathSet.has(entry.path));

  return {
    requestedPaths: normalizedRequestedPaths,
    entries,
    risks,
  };
}

function evaluateAuthorization({
  remainingCount = 0,
  authorizationReason = '',
  authorizedBy = '',
} = {}) {
  if (remainingCount === 0) {
    return [];
  }

  const risks = [];

  if (!normalizeText(authorizationReason)) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .MISSING_AUTHORIZATION_REASON,
      'Next compatibility removal batch authorization requires an authorization reason.'
    ));
  }

  if (!normalizeText(authorizedBy)) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.MISSING_AUTHORIZER,
      'Next compatibility removal batch authorization requires the authorizing operator.'
    ));
  }

  return risks;
}

function determineStatusId({ risks = [], remainingCount = 0 } = {}) {
  if (risks.some(risk => [
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .POST_REMOVAL_NOT_VERIFIED,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .POST_REMOVAL_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
      .BLOCKED_BY_POST_REMOVAL_VERIFICATION;
  }

  if (risks.some(risk => [
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .EXECUTION_PLAN_NOT_READY,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .EXECUTION_PLAN_VALIDATION_FAILED,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.NO_MANIFEST_ENTRIES,
  ].includes(risk.riskId))) {
    return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
      .BLOCKED_BY_EXECUTION_PLAN;
  }

  if (remainingCount === 0) {
    return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
      .COMPLETE_NO_REMAINING_PATHS;
  }

  if (risks.some(risk => risk.riskId ===
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.BATCH_SCOPE_TOO_BROAD)) {
    return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
      .BLOCKED_BY_SCOPE;
  }

  if (risks.some(risk => [
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.NO_PATHS_REQUESTED,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .REQUESTED_PATH_NOT_IN_MANIFEST,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .REQUESTED_PATH_ALREADY_REMOVED,
  ].includes(risk.riskId))) {
    return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
      .BLOCKED_BY_SELECTION;
  }

  if (risks.some(risk => [
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .MISSING_AUTHORIZATION_REASON,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.MISSING_AUTHORIZER,
  ].includes(risk.riskId))) {
    return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
      .BLOCKED_BY_AUTHORIZATION;
  }

  return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS.READY_FOR_NEXT_BATCH;
}

function buildPolicyNextCompatibilityRemovalBatchAuthorization({
  postRemovalVerification = {},
  executionPlan = null,
  requestedPaths = [],
  maxBatchSize = DEFAULT_MAX_BATCH_SIZE,
  authorizationReason = '',
  authorizedBy = '',
} = {}) {
  const resolvedExecutionPlan =
    executionPlan || buildPolicyCompatibilityDeletionExecutionPlan();
  const postRemovalEvaluation = evaluatePostRemovalVerification(postRemovalVerification);
  const executionPlanEvaluation = evaluateExecutionPlan(resolvedExecutionPlan);
  const remainingManifest = buildRemainingManifest({
    manifestEntries: executionPlanEvaluation.entries,
    removedPaths: postRemovalEvaluation.removedPaths,
  });
  const batchEvaluation = evaluateRequestedBatch({
    requestedPaths,
    manifestEntries: executionPlanEvaluation.entries,
    remainingManifest,
    maxBatchSize,
  });
  const risks = [
    ...postRemovalEvaluation.risks,
    ...executionPlanEvaluation.risks,
    ...batchEvaluation.risks,
    ...evaluateAuthorization({
      remainingCount: remainingManifest.remainingCount,
      authorizationReason,
      authorizedBy,
    }),
  ];
  const statusId = determineStatusId({
    risks,
    remainingCount: remainingManifest.remainingCount,
  });
  const authorization = {
    version: POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_VERSION,
    statusId,
    readyForNextBatch:
      statusId ===
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS.READY_FOR_NEXT_BATCH,
    completedNoRemainingPaths:
      statusId ===
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .COMPLETE_NO_REMAINING_PATHS,
    postRemovalVerification: {
      statusId: postRemovalVerification.statusId || null,
      verified: postRemovalVerification.verified === true,
      validationOk: postRemovalVerification.validation?.ok === true,
      appliedPathCount: postRemovalEvaluation.removedPaths.length,
    },
    executionPlan: {
      statusId: resolvedExecutionPlan.statusId || null,
      readyForExecutionGate: resolvedExecutionPlan.readyForExecutionGate === true,
      validationOk: resolvedExecutionPlan.validation?.ok === true,
      manifestEntryCount: executionPlanEvaluation.entries.length,
    },
    remainingManifest,
    authorizedBatch: {
      requestedCount: batchEvaluation.requestedPaths.length,
      authorizedCount:
        statusId ===
        POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS.READY_FOR_NEXT_BATCH
          ? batchEvaluation.entries.length
          : 0,
      maxBatchSize,
      authorizedBy: normalizeText(authorizedBy) || null,
      authorizationReason: normalizeText(authorizationReason) || null,
      entries:
        statusId ===
        POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS.READY_FOR_NEXT_BATCH
          ? batchEvaluation.entries
          : [],
    },
    riskCount: risks.length,
    risks,
    executionPolicy: {
      executeDeletionNow: false,
      requireControlledRemovalBatchBuilder: true,
      requireVerifiedPostRemoval: true,
      requireRemainingManifestPath: true,
      requireSmallBatch: true,
      preventAlreadyRemovedPathReuse: true,
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
    nextStep: {
      stepId: 'compatibility_removal_completion_audit',
      label: 'Compatibility Removal Completion Audit',
      reason:
        'After the next batch is authorized, the removal loop should either run the next controlled removal batch or audit that no approved compatibility paths remain.',
    },
  };

  return {
    ...authorization,
    validation:
      validatePolicyNextCompatibilityRemovalBatchAuthorization(authorization),
  };
}

function validatePolicyNextCompatibilityRemovalBatchAuthorization(
  authorization = {}
) {
  const issues = [];

  if (!Object.values(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS)
    .includes(authorization.statusId)) {
    issues.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.UNKNOWN_STATUS,
      'Next compatibility removal batch authorization status must be known.'
    ));
  }

  if (authorization.riskCount !== asArray(authorization.risks).length) {
    issues.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.RISK_COUNT_MISMATCH,
      'Next compatibility removal batch authorization risk count must match risk list length.'
    ));
  }

  Object.entries(authorization.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
          .SIDE_EFFECT_PERFORMED,
        `Next compatibility removal batch authorization cannot perform side effect "${key}".`
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
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS,
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS,
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_VERSION,
  buildPolicyNextCompatibilityRemovalBatchAuthorization,
  validatePolicyNextCompatibilityRemovalBatchAuthorization,
};
