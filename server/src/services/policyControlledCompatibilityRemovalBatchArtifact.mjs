import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION,
  validatePolicyCompatibilityDeletionExecutionPlanArtifact,
} from './policyCompatibilityDeletionExecutionPlanArtifact.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS,
  buildPolicyCompatibilityDeletionExecutionGate,
} from './policyCompatibilityDeletionExecutionGate.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS,
  buildPolicyControlledCompatibilityPathRemoval,
} from './policyControlledCompatibilityPathRemoval.mjs';

const POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_VERSION =
  'policy.controlled_compatibility_removal_batch_artifact.v2';

const POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED: 'blocked',
});

const POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS = Object.freeze({
  EXECUTION_PLAN_ARTIFACT_NOT_READY: 'execution_plan_artifact_not_ready',
  EXECUTION_PLAN_ARTIFACT_VALIDATION_FAILED: 'execution_plan_artifact_validation_failed',
  EXECUTION_GATE_NOT_READY: 'execution_gate_not_ready',
  EXECUTION_GATE_VALIDATION_FAILED: 'execution_gate_validation_failed',
  REMOVAL_BATCH_NOT_READY: 'removal_batch_not_ready',
  REMOVAL_BATCH_VALIDATION_FAILED: 'removal_batch_validation_failed',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
});

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

function normalizeGeneratedAt(value) {
  return value || new Date().toISOString();
}

function buildGateFromInput({
  executionPlanArtifact = {},
  input = {},
  generatedAt = null,
  now = null,
} = {}) {
  const evidence = asObject(input);

  return buildPolicyCompatibilityDeletionExecutionGate({
    executionPlanArtifact,
    operatorEvidence: evidence.operatorEvidence,
    preflightEvidenceArtifact: evidence.preflightEvidenceArtifact,
    generatedAt,
    now,
  });
}

function buildRemovalBatchFromInput({
  executionPlanArtifact = {},
  executionGate = {},
  input = {},
} = {}) {
  const evidence = asObject(input);

  return buildPolicyControlledCompatibilityPathRemoval({
    executionPlanArtifact,
    executionGate,
    selectedPaths: evidence.selectedPaths,
    maxBatchSize: evidence.maxBatchSize,
    removalReason: evidence.removalReason,
    reviewedBy: evidence.reviewedBy,
  });
}

function buildArtifactRisks({
  executionPlanArtifact = {},
  executionGate = {},
  removalBatch = {},
  sideEffects = {},
} = {}) {
  const risks = [];

  const executionPlanArtifactValidation =
    validatePolicyCompatibilityDeletionExecutionPlanArtifact(executionPlanArtifact);

  if (
    executionPlanArtifact.version !==
    POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION ||
    executionPlanArtifact.statusId !==
    POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS.READY ||
    executionPlanArtifact.ready !== true
  ) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_NOT_READY,
      'Controlled compatibility removal batch artifact requires a ready versioned execution-plan artifact.',
      {
        version: executionPlanArtifact.version || null,
        statusId: executionPlanArtifact.statusId || null,
      }
    ));
  }

  if (executionPlanArtifactValidation.ok !== true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_VALIDATION_FAILED,
      'Controlled compatibility removal batch artifact requires valid execution-plan artifact evidence.',
      { issueCount: executionPlanArtifactValidation.issueCount }
    ));
  }

  if (
    executionGate.statusId !==
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
      .READY_FOR_CONTROLLED_DELETION ||
    executionGate.allowControlledDeletion !== true
  ) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS.EXECUTION_GATE_NOT_READY,
      'Controlled compatibility removal batch artifact requires a ready compatibility deletion execution gate.',
      { statusId: executionGate.statusId || null }
    ));
  }

  if (executionGate.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS
        .EXECUTION_GATE_VALIDATION_FAILED,
      'Controlled compatibility removal batch artifact requires valid compatibility deletion execution-gate evidence.',
      { issueCount: executionGate.validation?.issueCount ?? null }
    ));
  }

  if (
    removalBatch.statusId !==
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.READY_FOR_REMOVAL_REVIEW ||
    removalBatch.readyForRemovalReview !== true
  ) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS.REMOVAL_BATCH_NOT_READY,
      'Controlled compatibility removal batch artifact requires a ready reviewed removal batch.',
      { statusId: removalBatch.statusId || null }
    ));
  }

  if (removalBatch.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS
        .REMOVAL_BATCH_VALIDATION_FAILED,
      'Controlled compatibility removal batch artifact requires valid reviewed removal-batch evidence.',
      { issueCount: removalBatch.validation?.issueCount ?? null }
    ));
  }

  Object.entries(sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
        `Controlled removal batch artifact cannot report side effect "${key}".`
      ));
    }
  });

  return risks;
}

function determineArtifactStatusId(risks = []) {
  return risks.length === 0
    ? POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_STATUS_IDS.READY
    : POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_STATUS_IDS.BLOCKED;
}

function buildPolicyControlledCompatibilityRemovalBatchArtifact({
  executionPlanArtifact = {},
  input = {},
  generatedAt = null,
  now = null,
  sideEffects = {},
} = {}) {
  const executionGate = buildGateFromInput({
    executionPlanArtifact,
    input,
    generatedAt,
    now,
  });
  const removalBatch = buildRemovalBatchFromInput({
    executionPlanArtifact,
    executionGate,
    input,
  });
  const risks = buildArtifactRisks({
    executionPlanArtifact,
    executionGate,
    removalBatch,
    sideEffects,
  });
  const artifact = {
    version: POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_VERSION,
    generatedAt: normalizeGeneratedAt(generatedAt),
    statusId: determineArtifactStatusId(risks),
    ready: risks.length === 0,
    executionGate,
    removalBatch,
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
  };

  return {
    ...artifact,
    validation: validatePolicyControlledCompatibilityRemovalBatchArtifact(artifact),
  };
}

function validatePolicyControlledCompatibilityRemovalBatchArtifact(artifact = {}) {
  const issues = [];

  if (!Object.values(POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_STATUS_IDS)
    .includes(artifact.statusId)) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS.UNKNOWN_STATUS,
      'Controlled removal batch artifact status must be known.'
    ));
  }

  if (artifact.riskCount !== (artifact.risks || []).length) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS.RISK_COUNT_MISMATCH,
      'Controlled removal batch artifact risk count must match risk list length.'
    ));
  }

  Object.entries(artifact.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
        `Controlled removal batch artifact cannot report side effect "${key}".`
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
  POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_STATUS_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_VERSION,
  buildPolicyControlledCompatibilityRemovalBatchArtifact,
  validatePolicyControlledCompatibilityRemovalBatchArtifact,
};
