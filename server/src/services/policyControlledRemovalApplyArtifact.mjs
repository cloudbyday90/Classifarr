import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
  applyPolicyControlledCompatibilityPathRemoval,
} from './policyControlledCompatibilityPathRemovalApply.mjs';

const POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_VERSION =
  'policy.controlled_removal_apply_artifact.v1';

const POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS = Object.freeze({
  APPLIED: 'applied',
  BLOCKED: 'blocked',
});

const POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS = Object.freeze({
  APPLY_RESULT_BLOCKED: 'apply_result_blocked',
  APPLY_RESULT_VALIDATION_FAILED: 'apply_result_validation_failed',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
  APPLIED_FLAG_MISMATCH: 'applied_flag_mismatch',
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

function summarizeSideEffects(applyResult = {}, sideEffects = {}) {
  return {
    filesDeleted:
      applyResult.sideEffects?.filesDeleted === true ||
      sideEffects.filesDeleted === true,
    filesArchived:
      applyResult.sideEffects?.filesArchived === true ||
      sideEffects.filesArchived === true,
    routesRemoved:
      applyResult.sideEffects?.routesRemoved === true ||
      sideEffects.routesRemoved === true,
    testsRemoved:
      applyResult.sideEffects?.testsRemoved === true ||
      sideEffects.testsRemoved === true,
    storageChanged:
      applyResult.sideEffects?.storageChanged === true ||
      sideEffects.storageChanged === true,
    gitCommandsRun:
      applyResult.sideEffects?.gitCommandsRun === true ||
      sideEffects.gitCommandsRun === true,
  };
}

function buildApplyArtifactRisks({
  applyResult = {},
  sideEffects = {},
} = {}) {
  const risks = [];

  if (
    applyResult.statusId !==
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED ||
    applyResult.applied !== true
  ) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS.APPLY_RESULT_BLOCKED,
      'Controlled removal apply artifact requires applied controlled removal evidence.',
      {
        statusId: applyResult.statusId || null,
        applyRiskCount: applyResult.riskCount ?? null,
      }
    ));
  }

  if (applyResult.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS
        .APPLY_RESULT_VALIDATION_FAILED,
      'Controlled removal apply artifact requires valid controlled removal apply evidence.',
      { issueCount: applyResult.validation?.issueCount ?? null }
    ));
  }

  if (sideEffects.filesArchived === true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
      'Controlled removal apply artifact must not archive compatibility paths.',
      { sideEffect: 'filesArchived' }
    ));
  }

  if (sideEffects.storageChanged === true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
      'Controlled removal apply artifact must not mutate storage.',
      { sideEffect: 'storageChanged' }
    ));
  }

  if (sideEffects.gitCommandsRun === true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
      'Controlled removal apply artifact must not run Git commands.',
      { sideEffect: 'gitCommandsRun' }
    ));
  }

  return risks;
}

function determineArtifactStatusId(risks = []) {
  return risks.length === 0
    ? POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS.APPLIED
    : POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS.BLOCKED;
}

async function buildPolicyControlledRemovalApplyArtifact({
  removalBatch = {},
  input = {},
  applyAdapter = null,
  generatedAt = null,
  sideEffects = {},
} = {}) {
  const evidence = asObject(input);
  const operatorConfirmation = asObject(evidence.operatorConfirmation);
  const applyResult = await applyPolicyControlledCompatibilityPathRemoval({
    removalReview: removalBatch,
    executeApply: evidence.executeApply,
    operatorConfirmation,
    applyAdapter,
  });
  const combinedSideEffects = summarizeSideEffects(applyResult, sideEffects);
  const risks = buildApplyArtifactRisks({
    applyResult,
    sideEffects: combinedSideEffects,
  });
  const artifact = {
    version: POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_VERSION,
    generatedAt: normalizeGeneratedAt(generatedAt),
    statusId: determineArtifactStatusId(risks),
    applied: risks.length === 0,
    removalReview: applyResult.removalReview,
    operatorConfirmation: applyResult.operatorConfirmation,
    applyResult,
    applySummary: {
      requestedCount: applyResult.applyBatch?.requestedCount ?? 0,
      appliedCount: applyResult.applyBatch?.appliedCount ?? 0,
      resultCount: asArray(applyResult.applyBatch?.results).length,
    },
    riskCount: risks.length,
    risks,
    sideEffects: combinedSideEffects,
    executionPolicy: {
      requireReadyRemovalReview: true,
      requireExplicitExecuteApply: true,
      requireOperatorConfirmation: true,
      requireApplyAdapter: true,
      allowArchive: false,
      allowStorageMutation: false,
      allowGitCommandsInsideArtifact: false,
    },
    nextStep: {
      stepId: 'post_removal_runtime_verification',
      label: 'Post-Removal Runtime Verification',
      reason:
        'Applied compatibility path removal must be followed by runtime, import, and test verification before additional batches are considered.',
    },
  };

  return {
    ...artifact,
    validation: validatePolicyControlledRemovalApplyArtifact(artifact),
  };
}

function validatePolicyControlledRemovalApplyArtifact(artifact = {}) {
  const issues = [];

  if (!Object.values(POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS)
    .includes(artifact.statusId)) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS.UNKNOWN_STATUS,
      'Controlled removal apply artifact status must be known.'
    ));
  }

  if (artifact.riskCount !== asArray(artifact.risks).length) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS.RISK_COUNT_MISMATCH,
      'Controlled removal apply artifact risk count must match risk list length.'
    ));
  }

  if (
    artifact.statusId ===
      POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS.APPLIED &&
    artifact.applied !== true
  ) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS.APPLIED_FLAG_MISMATCH,
      'Controlled removal apply artifact applied flag must match applied status.'
    ));
  }

  if (artifact.sideEffects?.filesArchived === true) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
      'Controlled removal apply artifact must not archive compatibility paths.',
      { sideEffect: 'filesArchived' }
    ));
  }

  if (artifact.sideEffects?.storageChanged === true) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
      'Controlled removal apply artifact must not mutate storage.',
      { sideEffect: 'storageChanged' }
    ));
  }

  if (artifact.sideEffects?.gitCommandsRun === true) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
      'Controlled removal apply artifact must not run Git commands.',
      { sideEffect: 'gitCommandsRun' }
    ));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS,
  POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS,
  POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_VERSION,
  buildPolicyControlledRemovalApplyArtifact,
  validatePolicyControlledRemovalApplyArtifact,
};
