import {
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS,
  buildPolicyPostRemovalRuntimeVerification,
} from './policyPostRemovalRuntimeVerification.mjs';

const POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_VERSION =
  'policy.post_removal_runtime_verification_artifact.v1';

const POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS = Object.freeze({
  VERIFIED: 'verified',
  BLOCKED: 'blocked',
});

const POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS = Object.freeze({
  VERIFICATION_NOT_VERIFIED: 'verification_not_verified',
  VERIFICATION_VALIDATION_FAILED: 'verification_validation_failed',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
  VERIFIED_FLAG_MISMATCH: 'verified_flag_mismatch',
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

function summarizeSideEffects(verification = {}, sideEffects = {}) {
  return {
    storageChanged:
      verification.sideEffects?.storageChanged === true ||
      sideEffects.storageChanged === true,
    gitCommandsRun:
      verification.sideEffects?.gitCommandsRun === true ||
      sideEffects.gitCommandsRun === true,
  };
}

function buildArtifactRisks({
  verification = {},
  sideEffects = {},
} = {}) {
  const risks = [];

  if (
    verification.statusId !==
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.VERIFIED ||
    verification.verified !== true
  ) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS
        .VERIFICATION_NOT_VERIFIED,
      'Post-removal runtime verification artifact requires verified runtime evidence.',
      {
        statusId: verification.statusId || null,
        verificationRiskCount: verification.riskCount ?? null,
      }
    ));
  }

  if (verification.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS
        .VERIFICATION_VALIDATION_FAILED,
      'Post-removal runtime verification artifact requires valid runtime evidence.',
      { issueCount: verification.validation?.issueCount ?? null }
    ));
  }

  if (sideEffects.storageChanged === true) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS
        .SIDE_EFFECT_REPORTED,
      'Post-removal runtime verification artifact must not mutate storage.',
      { sideEffect: 'storageChanged' }
    ));
  }

  if (sideEffects.gitCommandsRun === true) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS
        .SIDE_EFFECT_REPORTED,
      'Post-removal runtime verification artifact must not run Git commands.',
      { sideEffect: 'gitCommandsRun' }
    ));
  }

  return risks;
}

function determineArtifactStatusId(risks = []) {
  return risks.length === 0
    ? POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS.VERIFIED
    : POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS.BLOCKED;
}

async function buildPolicyPostRemovalRuntimeVerificationArtifact({
  applyEvidence = {},
  input = {},
  generatedAt = null,
  sideEffects = {},
} = {}) {
  const evidence = asObject(input);
  const verification = await buildPolicyPostRemovalRuntimeVerification({
    applyEvidence,
    importScan: asObject(evidence.importScan),
    runtimeChecks: asArray(evidence.runtimeChecks),
    validationEvidence: asObject(evidence.validationEvidence),
    sideEffects,
  });
  const combinedSideEffects = summarizeSideEffects(verification, sideEffects);
  const risks = buildArtifactRisks({
    verification,
    sideEffects: combinedSideEffects,
  });
  const artifact = {
    version: POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_VERSION,
    generatedAt: normalizeGeneratedAt(generatedAt),
    statusId: determineArtifactStatusId(risks),
    verified: risks.length === 0,
    verification,
    applyEvidence: verification.applyEvidence,
    verificationSummary: {
      appliedPathCount: verification.applyEvidence?.appliedPathCount ?? 0,
      checkedPathCount: verification.importScan?.checkedPathCount ?? 0,
      referenceCount: verification.importScan?.referenceCount ?? 0,
      runtimeCheckCount: verification.runtimeChecks?.checkCount ?? 0,
      runtimePassedCount: verification.runtimeChecks?.passedCount ?? 0,
    },
    riskCount: risks.length,
    risks,
    sideEffects: combinedSideEffects,
    executionPolicy: {
      requireAppliedControlledRemovalEvidence: true,
      requireCompletedImportScan: true,
      requireRuntimeChecks: true,
      requireFocusedValidation: true,
      requireFullValidation: true,
      allowStorageMutation: false,
      allowGitCommandsInsideArtifact: false,
    },
    nextStep: {
      stepId: 'next_compatibility_removal_batch_authorization',
      label: 'Next Compatibility Removal Batch Authorization',
      reason:
        'Verified post-removal runtime evidence can authorize only the next bounded compatibility removal batch.',
    },
  };

  return {
    ...artifact,
    validation: validatePolicyPostRemovalRuntimeVerificationArtifact(artifact),
  };
}

function validatePolicyPostRemovalRuntimeVerificationArtifact(artifact = {}) {
  const issues = [];

  if (!Object.values(POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS)
    .includes(artifact.statusId)) {
    issues.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS.UNKNOWN_STATUS,
      'Post-removal runtime verification artifact status must be known.'
    ));
  }

  if (artifact.riskCount !== asArray(artifact.risks).length) {
    issues.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS.RISK_COUNT_MISMATCH,
      'Post-removal runtime verification artifact risk count must match risk list length.'
    ));
  }

  if (
    artifact.statusId ===
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS.VERIFIED &&
    artifact.verified !== true
  ) {
    issues.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS
        .VERIFIED_FLAG_MISMATCH,
      'Post-removal runtime verification artifact verified flag must match verified status.'
    ));
  }

  if (artifact.sideEffects?.storageChanged === true) {
    issues.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS
        .SIDE_EFFECT_REPORTED,
      'Post-removal runtime verification artifact must not mutate storage.',
      { sideEffect: 'storageChanged' }
    ));
  }

  if (artifact.sideEffects?.gitCommandsRun === true) {
    issues.push(buildRisk(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS
        .SIDE_EFFECT_REPORTED,
      'Post-removal runtime verification artifact must not run Git commands.',
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
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS,
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS,
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_VERSION,
  buildPolicyPostRemovalRuntimeVerificationArtifact,
  validatePolicyPostRemovalRuntimeVerificationArtifact,
};
