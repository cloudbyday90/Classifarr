import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_VERSION,
} from './policyCompatibilityRemovalCompletionAuditArtifact.mjs';
import {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS,
  buildPolicyStorageCompletionCheckpoint,
} from './policyStorageCompletionCheckpoint.mjs';

const POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_VERSION =
  'policy.storage_completion_checkpoint_artifact.v1';

const POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  BLOCKED: 'blocked',
});

const POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS = Object.freeze({
  COMPLETION_AUDIT_ARTIFACT_NOT_COMPLETE:
    'completion_audit_artifact_not_complete',
  COMPLETION_AUDIT_ARTIFACT_VALIDATION_FAILED:
    'completion_audit_artifact_validation_failed',
  COMPLETION_AUDIT_ARTIFACT_VERSION_UNSUPPORTED:
    'completion_audit_artifact_version_unsupported',
  COMPLETION_AUDIT_MISSING: 'completion_audit_missing',
  CHECKPOINT_BLOCKED: 'checkpoint_blocked',
  CHECKPOINT_VALIDATION_FAILED: 'checkpoint_validation_failed',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  COMPLETE_FLAG_MISMATCH: 'complete_flag_mismatch',
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

function summarizeSideEffects(checkpoint = {}, sideEffects = {}) {
  return {
    filesWritten:
      checkpoint.sideEffects?.filesWritten === true ||
      sideEffects.filesWritten === true,
    storageChanged:
      checkpoint.sideEffects?.storageChanged === true ||
      sideEffects.storageChanged === true,
    gitCommandsRun:
      checkpoint.sideEffects?.gitCommandsRun === true ||
      sideEffects.gitCommandsRun === true,
    commandsExecuted:
      checkpoint.sideEffects?.commandsExecuted === true ||
      sideEffects.commandsExecuted === true,
    manifestWritten: sideEffects.manifestWritten === true,
  };
}

function normalizeCompletionAuditArtifact(completionAuditArtifact = {}) {
  const artifact = asObject(completionAuditArtifact);
  const audit = asObject(artifact.audit);

  return {
    artifact,
    audit,
    artifactStatusId: artifact.statusId || null,
    artifactVersion: artifact.version || null,
    artifactComplete: artifact.complete === true,
    artifactValidationOk: artifact.validation?.ok === true,
    auditPresent: Object.keys(audit).length > 0,
  };
}

function buildArtifactRisks({
  checkpoint = {},
  completionAuditArtifact = {},
  sideEffects = {},
} = {}) {
  const risks = [];
  const completionAudit = normalizeCompletionAuditArtifact(completionAuditArtifact);

  if (!completionAudit.auditPresent) {
    risks.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.COMPLETION_AUDIT_MISSING,
      'Policy storage completion checkpoint artifact requires compatibility-removal completion-audit artifact evidence.'
    ));
  }

  if (
    completionAudit.auditPresent &&
    completionAudit.artifactComplete !== true
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_NOT_COMPLETE,
      'Policy storage completion checkpoint artifact requires a complete compatibility-removal completion-audit artifact.',
      {
        artifactStatusId: completionAudit.artifactStatusId,
        artifactComplete: completionAudit.artifactComplete,
      }
    ));
  }

  if (
    completionAudit.auditPresent &&
    completionAudit.artifactValidationOk !== true
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_VALIDATION_FAILED,
      'Policy storage completion checkpoint artifact requires valid compatibility-removal completion-audit artifact evidence.',
      {
        artifactValidationIssueCount:
          completionAudit.artifact.validation?.issueCount ?? null,
      }
    ));
  }

  if (
    completionAudit.auditPresent &&
    completionAudit.artifactVersion !==
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_VERSION
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_VERSION_UNSUPPORTED,
      'Policy storage completion checkpoint artifact requires the current compatibility-removal completion-audit artifact version.',
      {
        expectedVersion:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_VERSION,
        receivedVersion: completionAudit.artifactVersion,
      }
    ));
  }

  if (checkpoint.statusId !== POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE) {
    risks.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.CHECKPOINT_BLOCKED,
      'Policy storage completion checkpoint artifact requires a complete storage checkpoint.',
      {
        checkpointStatusId: checkpoint.statusId || null,
        checkpointRiskCount: checkpoint.riskCount ?? null,
      }
    ));
  }

  if (checkpoint.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS
        .CHECKPOINT_VALIDATION_FAILED,
      'Policy storage completion checkpoint artifact requires valid storage checkpoint output.',
      {
        checkpointValidationIssueCount:
          checkpoint.validation?.issueCount ?? null,
      }
    ));
  }

  Object.entries(sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      risks.push(buildRisk(
        POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS
          .SIDE_EFFECT_REPORTED,
        `Policy storage completion checkpoint artifact cannot report side effect "${key}".`,
        { sideEffect: key }
      ));
    }
  });

  return risks;
}

function determineArtifactStatusId(risks = []) {
  if (risks.length > 0) {
    return POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.BLOCKED;
  }

  return POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.COMPLETE;
}

function buildPolicyStorageCompletionCheckpointArtifact({
  componentEvidence = [],
  roadmapEvidence = {},
  completionAuditArtifact = {},
  validationEvidence = {},
  changelogEvidence = {},
  generatedAt = null,
  sideEffects = {},
} = {}) {
  const completionAudit =
    normalizeCompletionAuditArtifact(completionAuditArtifact);
  const checkpoint = buildPolicyStorageCompletionCheckpoint({
    componentEvidence: asArray(componentEvidence),
    roadmapEvidence: asObject(roadmapEvidence),
    finalRemovalAudit: completionAudit.audit,
    validationEvidence: asObject(validationEvidence),
    changelogEvidence: asObject(changelogEvidence),
    sideEffects,
  });
  const combinedSideEffects = summarizeSideEffects(checkpoint, sideEffects);
  const risks = buildArtifactRisks({
    checkpoint,
    completionAuditArtifact,
    sideEffects: combinedSideEffects,
  });
  const artifact = {
    version: POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_VERSION,
    generatedAt: normalizeGeneratedAt(generatedAt),
    statusId: determineArtifactStatusId(risks),
    complete:
      risks.length === 0 &&
      checkpoint.statusId === POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE &&
      checkpoint.complete === true,
    checkpoint,
    checkpointSummary: {
      checkpointStatusId: checkpoint.statusId,
      checkpointComplete: checkpoint.complete === true,
      componentExpectedCount: checkpoint.componentCoverage?.expectedCount ?? 0,
      componentImplementedCount:
        checkpoint.componentCoverage?.implementedCount ?? 0,
      checkpointRiskCount: checkpoint.riskCount ?? 0,
      finalRemovalAuditStatusId:
        checkpoint.finalRemovalAudit?.statusId || null,
      validationPassedCount: [
        checkpoint.validationEvidence?.focused,
        checkpoint.validationEvidence?.lint,
        checkpoint.validationEvidence?.markdown,
        checkpoint.validationEvidence?.full,
      ].filter(evidence => evidence?.passed === true).length,
    },
    completionAuditArtifact: {
      version: completionAudit.artifactVersion,
      statusId: completionAudit.artifactStatusId,
      complete: completionAudit.artifactComplete,
      validationOk: completionAudit.artifactValidationOk,
      riskCount: completionAudit.artifact.riskCount ?? null,
    },
    riskCount: risks.length,
    risks,
    sideEffects: combinedSideEffects,
    executionPolicy: {
      requireCompletionAuditArtifact: true,
      requireCurrentCompletionAuditArtifactVersion: true,
      requireCompleteCheckpoint: true,
      requireComponentEvidence: true,
      requireRoadmapEvidence: true,
      requireValidationEvidence: true,
      requireChangelogEvidence: true,
      allowFileWrites: false,
      allowStorageMutation: false,
      allowGitCommandsInsideArtifact: false,
      allowCommandExecutionInsideService: false,
      allowManifestWrite: false,
    },
    nextStep: {
      stepId: 'policy_storage_final_closure_readout',
      label: 'Policy Storage Final Closure Readout',
      reason:
        'Complete checkpoint artifact evidence proves storage migration roadmap, implementation artifacts, validation, changelog, and removal-loop closure evidence are aligned.',
    },
  };

  return {
    ...artifact,
    validation:
      validatePolicyStorageCompletionCheckpointArtifact(artifact),
  };
}

function validatePolicyStorageCompletionCheckpointArtifact(artifact = {}) {
  const issues = [];

  if (!Object.values(POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS)
    .includes(artifact.statusId)) {
    issues.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.UNKNOWN_STATUS,
      'Policy storage completion checkpoint artifact status must be known.'
    ));
  }

  if (artifact.riskCount !== asArray(artifact.risks).length) {
    issues.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.RISK_COUNT_MISMATCH,
      'Policy storage completion checkpoint artifact risk count must match risk list length.'
    ));
  }

  if (
    artifact.statusId ===
      POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.COMPLETE &&
    artifact.complete !== true
  ) {
    issues.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.COMPLETE_FLAG_MISMATCH,
      'Policy storage completion checkpoint artifact complete flag must match complete status.'
    ));
  }

  Object.entries(artifact.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS
          .SIDE_EFFECT_REPORTED,
        `Policy storage completion checkpoint artifact cannot report side effect "${key}".`,
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
  POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS,
  POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS,
  POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_VERSION,
  buildPolicyStorageCompletionCheckpointArtifact,
  validatePolicyStorageCompletionCheckpointArtifact,
};
