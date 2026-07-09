import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
  buildPolicyCompatibilityDeletionExecutionPlan,
} from './policyCompatibilityDeletionExecutionPlan.mjs';

const POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION =
  'policy.compatibility_deletion_execution_plan_artifact.v1';

const POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED: 'blocked',
});

const POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS = Object.freeze({
  INPUT_NOT_OBJECT: 'input_not_object',
  EXECUTION_PLAN_NOT_READY: 'execution_plan_not_ready',
  EXECUTION_PLAN_VALIDATION_FAILED: 'execution_plan_validation_failed',
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

function buildPlanFromInput(input = {}) {
  const evidence = asObject(input);

  return buildPolicyCompatibilityDeletionExecutionPlan({
    deletionReadiness: evidence.deletionReadiness,
    deletionGatePlan: evidence.deletionGatePlan,
    replacementEvidence: evidence.replacementEvidence,
    rollbackStance: evidence.rollbackStance,
    supportStance: evidence.supportStance,
    manifestApproved: evidence.manifestApproved,
    approvedBy: evidence.approvedBy,
  });
}

function buildArtifactRisks({
  input = {},
  executionPlan = {},
  sideEffects = {},
} = {}) {
  const risks = [];

  if (input !== null && typeof input !== 'object') {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS.INPUT_NOT_OBJECT,
      'Compatibility deletion execution-plan artifact input must be a JSON object.'
    ));
  }

  if (
    executionPlan.statusId !==
    POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE ||
    executionPlan.readyForExecutionGate !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS.EXECUTION_PLAN_NOT_READY,
      'Compatibility deletion execution-plan artifact requires a ready deletion execution plan.',
      { statusId: executionPlan.statusId || null }
    ));
  }

  if (executionPlan.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS.EXECUTION_PLAN_VALIDATION_FAILED,
      'Compatibility deletion execution-plan artifact requires valid deletion execution-plan evidence.',
      { issueCount: executionPlan.validation?.issueCount ?? null }
    ));
  }

  Object.entries(sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
        `Compatibility deletion execution-plan artifact cannot report side effect "${key}".`
      ));
    }
  });

  return risks;
}

function determineArtifactStatusId(risks = []) {
  return risks.length === 0
    ? POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS.READY
    : POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS.BLOCKED;
}

function buildPolicyCompatibilityDeletionExecutionPlanArtifact({
  input = {},
  generatedAt = null,
  sideEffects = {},
} = {}) {
  const executionPlan = buildPlanFromInput(input);
  const risks = buildArtifactRisks({
    input,
    executionPlan,
    sideEffects,
  });
  const artifact = {
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION,
    generatedAt: normalizeGeneratedAt(generatedAt),
    statusId: determineArtifactStatusId(risks),
    ready: risks.length === 0,
    executionPlan,
    riskCount: risks.length,
    risks,
    sideEffects: {
      filesDeleted: sideEffects.filesDeleted === true,
      filesArchived: sideEffects.filesArchived === true,
      storageChanged: sideEffects.storageChanged === true,
      gitCommandsRun: sideEffects.gitCommandsRun === true,
    },
  };

  return {
    ...artifact,
    validation: validatePolicyCompatibilityDeletionExecutionPlanArtifact(artifact),
  };
}

function validatePolicyCompatibilityDeletionExecutionPlanArtifact(artifact = {}) {
  const issues = [];

  if (!Object.values(POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS)
    .includes(artifact.statusId)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS.UNKNOWN_STATUS,
      'Compatibility deletion execution-plan artifact status must be known.'
    ));
  }

  if (artifact.riskCount !== (artifact.risks || []).length) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS.RISK_COUNT_MISMATCH,
      'Compatibility deletion execution-plan artifact risk count must match risk list length.'
    ));
  }

  Object.entries(artifact.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
        `Compatibility deletion execution-plan artifact cannot report side effect "${key}".`
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
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION,
  buildPolicyCompatibilityDeletionExecutionPlanArtifact,
  validatePolicyCompatibilityDeletionExecutionPlanArtifact,
};
