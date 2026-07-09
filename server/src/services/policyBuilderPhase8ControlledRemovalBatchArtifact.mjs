import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from './policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS,
  buildPolicyCompatibilityDeletionExecutionGate,
} from './policyCompatibilityDeletionExecutionGate.mjs';
import {
  PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS,
  buildPolicyBuilderPhase8ControlledCompatibilityPathRemoval,
} from './policyBuilderPhase8ControlledCompatibilityPathRemoval.mjs';

const PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_VERSION =
  'phase8r.controlled_removal_batch_artifact.v1';

const PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED: 'blocked',
});

const PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_RISK_IDS = Object.freeze({
  EXECUTION_PLAN_NOT_READY: 'execution_plan_not_ready',
  EXECUTION_PLAN_VALIDATION_FAILED: 'execution_plan_validation_failed',
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

function buildGateFromInput({ executionPlan = {}, input = {} } = {}) {
  const evidence = asObject(input);

  return buildPolicyCompatibilityDeletionExecutionGate({
    executionPlan,
    worktreeClean: evidence.worktreeClean,
    backupRestoreVerified: evidence.backupRestoreVerified,
    backupRestoreFresh: evidence.backupRestoreFresh,
    operatorApproval: evidence.operatorApproval,
    rollbackStanceFinal: evidence.rollbackStanceFinal,
    supportStanceFinal: evidence.supportStanceFinal,
    manifestFresh: evidence.manifestFresh,
    manifestMatchesCurrentPlan: evidence.manifestMatchesCurrentPlan,
  });
}

function buildRemovalBatchFromInput({
  executionPlan = {},
  executionGate = {},
  input = {},
} = {}) {
  const evidence = asObject(input);

  return buildPolicyBuilderPhase8ControlledCompatibilityPathRemoval({
    executionPlan,
    executionGate,
    selectedPaths: evidence.selectedPaths,
    maxBatchSize: evidence.maxBatchSize,
    removalReason: evidence.removalReason,
    reviewedBy: evidence.reviewedBy,
  });
}

function buildArtifactRisks({
  executionPlan = {},
  executionGate = {},
  removalBatch = {},
  sideEffects = {},
} = {}) {
  const risks = [];

  if (
    executionPlan.statusId !==
    POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE ||
    executionPlan.readyForExecutionGate !== true
  ) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_RISK_IDS.EXECUTION_PLAN_NOT_READY,
      'Controlled removal batch artifact requires a ready Phase 8R.15 execution plan.',
      { statusId: executionPlan.statusId || null }
    ));
  }

  if (executionPlan.validation?.ok !== true) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_RISK_IDS
        .EXECUTION_PLAN_VALIDATION_FAILED,
      'Controlled removal batch artifact requires valid Phase 8R.15 execution-plan evidence.',
      { issueCount: executionPlan.validation?.issueCount ?? null }
    ));
  }

  if (
    executionGate.statusId !==
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
      .READY_FOR_CONTROLLED_DELETION ||
    executionGate.allowControlledDeletion !== true
  ) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_RISK_IDS.EXECUTION_GATE_NOT_READY,
      'Controlled removal batch artifact requires a ready Phase 8R.16 execution gate.',
      { statusId: executionGate.statusId || null }
    ));
  }

  if (executionGate.validation?.ok !== true) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_RISK_IDS
        .EXECUTION_GATE_VALIDATION_FAILED,
      'Controlled removal batch artifact requires valid Phase 8R.16 execution-gate evidence.',
      { issueCount: executionGate.validation?.issueCount ?? null }
    ));
  }

  if (
    removalBatch.statusId !==
    PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.READY_FOR_REMOVAL_REVIEW ||
    removalBatch.readyForRemovalReview !== true
  ) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_RISK_IDS.REMOVAL_BATCH_NOT_READY,
      'Controlled removal batch artifact requires a ready Phase 8R.17 removal batch.',
      { statusId: removalBatch.statusId || null }
    ));
  }

  if (removalBatch.validation?.ok !== true) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_RISK_IDS
        .REMOVAL_BATCH_VALIDATION_FAILED,
      'Controlled removal batch artifact requires valid Phase 8R.17 removal-batch evidence.',
      { issueCount: removalBatch.validation?.issueCount ?? null }
    ));
  }

  Object.entries(sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      risks.push(buildRisk(
        PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
        `Controlled removal batch artifact cannot report side effect "${key}".`
      ));
    }
  });

  return risks;
}

function determineArtifactStatusId(risks = []) {
  return risks.length === 0
    ? PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_STATUS_IDS.READY
    : PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_STATUS_IDS.BLOCKED;
}

function buildPolicyBuilderPhase8ControlledRemovalBatchArtifact({
  executionPlan = {},
  input = {},
  generatedAt = null,
  sideEffects = {},
} = {}) {
  const executionGate = buildGateFromInput({ executionPlan, input });
  const removalBatch = buildRemovalBatchFromInput({
    executionPlan,
    executionGate,
    input,
  });
  const risks = buildArtifactRisks({
    executionPlan,
    executionGate,
    removalBatch,
    sideEffects,
  });
  const artifact = {
    version: PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_VERSION,
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
    validation: validatePolicyBuilderPhase8ControlledRemovalBatchArtifact(artifact),
  };
}

function validatePolicyBuilderPhase8ControlledRemovalBatchArtifact(artifact = {}) {
  const issues = [];

  if (!Object.values(PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_STATUS_IDS)
    .includes(artifact.statusId)) {
    issues.push(buildRisk(
      PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_RISK_IDS.UNKNOWN_STATUS,
      'Controlled removal batch artifact status must be known.'
    ));
  }

  if (artifact.riskCount !== (artifact.risks || []).length) {
    issues.push(buildRisk(
      PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_RISK_IDS.RISK_COUNT_MISMATCH,
      'Controlled removal batch artifact risk count must match risk list length.'
    ));
  }

  Object.entries(artifact.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
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
  PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_RISK_IDS,
  PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_STATUS_IDS,
  PHASE8R_CONTROLLED_REMOVAL_BATCH_ARTIFACT_VERSION,
  buildPolicyBuilderPhase8ControlledRemovalBatchArtifact,
  validatePolicyBuilderPhase8ControlledRemovalBatchArtifact,
};
