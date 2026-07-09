import {
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS,
  buildPolicyNextCompatibilityRemovalBatchAuthorization,
} from './policyNextCompatibilityRemovalBatchAuthorization.mjs';

const POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_VERSION =
  'policy.next_compatibility_removal_batch_authorization_artifact.v1';

const POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS =
  Object.freeze({
    READY_FOR_NEXT_BATCH: 'ready_for_next_batch',
    COMPLETE_NO_REMAINING_PATHS: 'complete_no_remaining_paths',
    BLOCKED: 'blocked',
  });

const POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS =
  Object.freeze({
    AUTHORIZATION_NOT_READY: 'authorization_not_ready',
    AUTHORIZATION_VALIDATION_FAILED: 'authorization_validation_failed',
    SIDE_EFFECT_REPORTED: 'side_effect_reported',
    READY_FLAG_MISMATCH: 'ready_flag_mismatch',
    COMPLETION_FLAG_MISMATCH: 'completion_flag_mismatch',
    RISK_COUNT_MISMATCH: 'risk_count_mismatch',
    UNKNOWN_STATUS: 'unknown_status',
  });

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

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

function normalizeGeneratedAt(value) {
  return value || new Date().toISOString();
}

function summarizeSideEffects(authorization = {}, sideEffects = {}) {
  return {
    filesDeleted:
      authorization.sideEffects?.filesDeleted === true ||
      sideEffects.filesDeleted === true,
    filesArchived:
      authorization.sideEffects?.filesArchived === true ||
      sideEffects.filesArchived === true,
    routesRemoved:
      authorization.sideEffects?.routesRemoved === true ||
      sideEffects.routesRemoved === true,
    testsRemoved:
      authorization.sideEffects?.testsRemoved === true ||
      sideEffects.testsRemoved === true,
    storageChanged:
      authorization.sideEffects?.storageChanged === true ||
      sideEffects.storageChanged === true,
    manifestWritten:
      authorization.sideEffects?.manifestWritten === true ||
      sideEffects.manifestWritten === true,
    gitCommandsRun:
      authorization.sideEffects?.gitCommandsRun === true ||
      sideEffects.gitCommandsRun === true,
  };
}

function determineArtifactStatusId(authorization = {}, risks = []) {
  if (risks.length > 0) {
    return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS
      .BLOCKED;
  }

  if (authorization.completedNoRemainingPaths === true) {
    return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS
      .COMPLETE_NO_REMAINING_PATHS;
  }

  return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS
    .READY_FOR_NEXT_BATCH;
}

function buildArtifactRisks({
  authorization = {},
  sideEffects = {},
} = {}) {
  const risks = [];
  const acceptableStatusIds = [
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS.READY_FOR_NEXT_BATCH,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
      .COMPLETE_NO_REMAINING_PATHS,
  ];

  if (!acceptableStatusIds.includes(authorization.statusId)) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS
        .AUTHORIZATION_NOT_READY,
      'Next compatibility removal batch authorization artifact requires ready or complete next-batch authorization evidence.',
      {
        statusId: authorization.statusId || null,
        authorizationRiskCount: authorization.riskCount ?? null,
      }
    ));
  }

  if (authorization.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS
        .AUTHORIZATION_VALIDATION_FAILED,
      'Next compatibility removal batch authorization artifact requires valid next-batch authorization evidence.',
      { issueCount: authorization.validation?.issueCount ?? null }
    ));
  }

  Object.entries(sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      risks.push(buildRisk(
        POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS
          .SIDE_EFFECT_REPORTED,
        `Next compatibility removal batch authorization artifact cannot report side effect "${key}".`,
        { sideEffect: key }
      ));
    }
  });

  return risks;
}

function buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
  postRemovalVerification = {},
  executionPlan = {},
  input = {},
  generatedAt = null,
  sideEffects = {},
} = {}) {
  const evidence = asObject(input);
  const authorization =
    buildPolicyNextCompatibilityRemovalBatchAuthorization({
      postRemovalVerification,
      executionPlan,
      requestedPaths: evidence.requestedPaths,
      maxBatchSize: evidence.maxBatchSize,
      authorizationReason: evidence.authorizationReason,
      authorizedBy: evidence.authorizedBy,
    });
  const combinedSideEffects = summarizeSideEffects(authorization, sideEffects);
  const risks = buildArtifactRisks({
    authorization,
    sideEffects: combinedSideEffects,
  });
  const artifact = {
    version: POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_VERSION,
    generatedAt: normalizeGeneratedAt(generatedAt),
    statusId: determineArtifactStatusId(authorization, risks),
    readyForNextBatch:
      risks.length === 0 && authorization.readyForNextBatch === true,
    completedNoRemainingPaths:
      risks.length === 0 && authorization.completedNoRemainingPaths === true,
    authorization,
    authorizationSummary: {
      remainingCount: authorization.remainingManifest?.remainingCount ?? 0,
      removedCount: authorization.remainingManifest?.removedCount ?? 0,
      requestedCount: authorization.authorizedBatch?.requestedCount ?? 0,
      authorizedCount: authorization.authorizedBatch?.authorizedCount ?? 0,
      maxBatchSize: authorization.authorizedBatch?.maxBatchSize ?? null,
    },
    riskCount: risks.length,
    risks,
    sideEffects: combinedSideEffects,
    executionPolicy: {
      requireVerifiedPostRemovalEvidence: true,
      requireReadyCompatibilityDeletionManifest: true,
      requireRemainingManifestSelection: true,
      requireSmallBatch: true,
      allowFileDeletion: false,
      allowArchive: false,
      allowStorageMutation: false,
      allowManifestWrite: false,
      allowGitCommandsInsideArtifact: false,
    },
    nextStep: {
      stepId: 'compatibility_removal_completion_audit',
      label: 'Compatibility Removal Completion Audit',
      reason:
        'Authorized next-batch evidence must either feed the next removal loop or prove no approved compatibility paths remain.',
    },
  };

  return {
    ...artifact,
    validation:
      validatePolicyNextCompatibilityRemovalBatchAuthorizationArtifact(artifact),
  };
}

function validatePolicyNextCompatibilityRemovalBatchAuthorizationArtifact(
  artifact = {}
) {
  const issues = [];

  if (!Object.values(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS)
    .includes(artifact.statusId)) {
    issues.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS
        .UNKNOWN_STATUS,
      'Next compatibility removal batch authorization artifact status must be known.'
    ));
  }

  if (artifact.riskCount !== asArray(artifact.risks).length) {
    issues.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS
        .RISK_COUNT_MISMATCH,
      'Next compatibility removal batch authorization artifact risk count must match risk list length.'
    ));
  }

  if (
    artifact.statusId ===
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS
        .READY_FOR_NEXT_BATCH &&
    artifact.readyForNextBatch !== true
  ) {
    issues.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS
        .READY_FLAG_MISMATCH,
      'Next compatibility removal batch authorization artifact ready flag must match ready status.'
    ));
  }

  if (
    artifact.statusId ===
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS
        .COMPLETE_NO_REMAINING_PATHS &&
    artifact.completedNoRemainingPaths !== true
  ) {
    issues.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS
        .COMPLETION_FLAG_MISMATCH,
      'Next compatibility removal batch authorization artifact completion flag must match completion status.'
    ));
  }

  Object.entries(artifact.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS
          .SIDE_EFFECT_REPORTED,
        `Next compatibility removal batch authorization artifact cannot report side effect "${key}".`,
        { sideEffect: key }
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
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_RISK_IDS,
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS,
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_VERSION,
  buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact,
  validatePolicyNextCompatibilityRemovalBatchAuthorizationArtifact,
};
