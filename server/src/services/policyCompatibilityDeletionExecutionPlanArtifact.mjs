import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
  buildPolicyCompatibilityDeletionExecutionPlan,
} from './policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_VERSION,
  validatePolicyCompatibilityDeletionExecutionPlanEvidenceBundle,
} from './policyCompatibilityDeletionExecutionPlanEvidenceBundle.mjs';
import {
  buildPolicyCompatibilityDeletionExecutionPlanArtifactFingerprint,
  validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint,
} from './policyCompatibilityDeletionExecutionPlanArtifactFingerprint.mjs';

const POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION =
  'policy.compatibility_deletion_execution_plan_artifact.v2';

const POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED: 'blocked',
});

const POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS = Object.freeze({
  INPUT_NOT_OBJECT: 'input_not_object',
  EVIDENCE_BUNDLE_MISSING: 'evidence_bundle_missing',
  EVIDENCE_BUNDLE_NOT_READY: 'evidence_bundle_not_ready',
  EVIDENCE_BUNDLE_VALIDATION_FAILED: 'evidence_bundle_validation_failed',
  EXECUTION_PLAN_NOT_READY: 'execution_plan_not_ready',
  EXECUTION_PLAN_VALIDATION_FAILED: 'execution_plan_validation_failed',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
  READY_STATE_MISMATCH: 'ready_state_mismatch',
  ARTIFACT_FINGERPRINT_INVALID: 'artifact_fingerprint_invalid',
  UNKNOWN_VERSION: 'unknown_version',
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
  const evidenceBundle = asObject(evidence.evidenceBundle);

  return {
    evidenceBundle,
    executionPlan: buildPolicyCompatibilityDeletionExecutionPlan({
      deletionReadiness: evidenceBundle.deletionReadiness,
      deletionGatePlan: evidenceBundle.deletionGatePlan,
      replacementEvidence: evidence.replacementEvidence,
      rollbackStance: evidence.rollbackStance,
      supportStance: evidence.supportStance,
      manifestApproved: evidence.manifestApproved,
      approvedBy: evidence.approvedBy,
    }),
  };
}

function buildArtifactRisks({
  input = {},
  evidenceBundle = {},
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

  if (Object.keys(evidenceBundle).length === 0) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS
        .EVIDENCE_BUNDLE_MISSING,
      'Compatibility deletion execution-plan artifact requires a current execution-plan evidence bundle.'
    ));
  } else {
    const bundleValidation =
      validatePolicyCompatibilityDeletionExecutionPlanEvidenceBundle(evidenceBundle);

    if (
      evidenceBundle.version !==
        POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_VERSION ||
      evidenceBundle.statusId !==
        POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS.READY ||
      evidenceBundle.readyForExecutionPlan !== true
    ) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS
          .EVIDENCE_BUNDLE_NOT_READY,
        'Compatibility deletion execution-plan artifact requires a ready current evidence bundle.',
        { statusId: evidenceBundle.statusId || null }
      ));
    }

    if (evidenceBundle.validation?.ok !== true || bundleValidation.ok !== true) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS
          .EVIDENCE_BUNDLE_VALIDATION_FAILED,
        'Compatibility deletion execution-plan artifact requires valid current evidence-bundle invariants.',
        { issueCount: bundleValidation.issueCount }
      ));
    }
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
  const { evidenceBundle, executionPlan } = buildPlanFromInput(input);
  const risks = buildArtifactRisks({
    input,
    evidenceBundle,
    executionPlan,
    sideEffects,
  });
  const artifact = {
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION,
    generatedAt: normalizeGeneratedAt(generatedAt),
    statusId: determineArtifactStatusId(risks),
    ready: risks.length === 0,
    evidenceBundle: {
      version: evidenceBundle.version || null,
      generatedAt: evidenceBundle.generatedAt || null,
      statusId: evidenceBundle.statusId || null,
      validationOk: evidenceBundle.validation?.ok === true,
    },
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
  const artifactWithFingerprint = {
    ...artifact,
    artifactFingerprint: buildPolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({
      artifact,
    }),
  };

  return {
    ...artifactWithFingerprint,
    validation: validatePolicyCompatibilityDeletionExecutionPlanArtifact(artifactWithFingerprint),
  };
}

function validatePolicyCompatibilityDeletionExecutionPlanArtifact(artifact = {}) {
  const issues = [];

  if (artifact.version !== POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS.UNKNOWN_VERSION,
      'Compatibility deletion execution-plan artifact version must be recognized.',
      { version: artifact.version || null }
    ));
  }

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

  const shouldBeReady =
    artifact.statusId === POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS.READY &&
    artifact.riskCount === 0;
  if (artifact.ready !== shouldBeReady) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS.READY_STATE_MISMATCH,
      'Compatibility deletion execution-plan artifact ready state must match its status and risks.'
    ));
  }

  const fingerprintValidation =
    validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({
      artifact,
      artifactFingerprint: artifact.artifactFingerprint,
    });
  if (!fingerprintValidation.ok) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_RISK_IDS
        .ARTIFACT_FINGERPRINT_INVALID,
      'Compatibility deletion execution-plan artifact fingerprint must bind the artifact contents.',
      { issueCount: fingerprintValidation.issueCount }
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
