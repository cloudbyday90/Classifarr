import {
  PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS,
  buildPolicyBuilderPhase8CompletionCheckpoint,
} from './policyBuilderPhase8CompletionCheckpoint.mjs';

const PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_VERSION =
  'phase8r.completion_checkpoint_artifact.v1';

const PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  BLOCKED: 'blocked',
});

const PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS = Object.freeze({
  COMPLETION_AUDIT_ARTIFACT_NOT_COMPLETE:
    'completion_audit_artifact_not_complete',
  COMPLETION_AUDIT_ARTIFACT_VALIDATION_FAILED:
    'completion_audit_artifact_validation_failed',
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
      PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.COMPLETION_AUDIT_MISSING,
      'Phase 8R completion checkpoint artifact requires the Phase 8R.31 completion-audit artifact.'
    ));
  }

  if (
    completionAudit.auditPresent &&
    completionAudit.artifactComplete !== true
  ) {
    risks.push(buildRisk(
      PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_NOT_COMPLETE,
      'Phase 8R completion checkpoint artifact requires a complete Phase 8R.31 completion-audit artifact.',
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
      PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_VALIDATION_FAILED,
      'Phase 8R completion checkpoint artifact requires valid Phase 8R.31 completion-audit artifact evidence.',
      {
        artifactValidationIssueCount:
          completionAudit.artifact.validation?.issueCount ?? null,
      }
    ));
  }

  if (checkpoint.statusId !== PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE) {
    risks.push(buildRisk(
      PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.CHECKPOINT_BLOCKED,
      'Phase 8R completion checkpoint artifact requires a complete Phase 8R.22 checkpoint.',
      {
        checkpointStatusId: checkpoint.statusId || null,
        checkpointRiskCount: checkpoint.riskCount ?? null,
      }
    ));
  }

  if (checkpoint.validation?.ok !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS
        .CHECKPOINT_VALIDATION_FAILED,
      'Phase 8R completion checkpoint artifact requires valid Phase 8R.22 checkpoint output.',
      {
        checkpointValidationIssueCount:
          checkpoint.validation?.issueCount ?? null,
      }
    ));
  }

  Object.entries(sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      risks.push(buildRisk(
        PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS
          .SIDE_EFFECT_REPORTED,
        `Phase 8R completion checkpoint artifact cannot report side effect "${key}".`,
        { sideEffect: key }
      ));
    }
  });

  return risks;
}

function determineArtifactStatusId(risks = []) {
  if (risks.length > 0) {
    return PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.BLOCKED;
  }

  return PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.COMPLETE;
}

function buildPolicyBuilderPhase8CompletionCheckpointArtifact({
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
  const checkpoint = buildPolicyBuilderPhase8CompletionCheckpoint({
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
    version: PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_VERSION,
    generatedAt: normalizeGeneratedAt(generatedAt),
    statusId: determineArtifactStatusId(risks),
    complete:
      risks.length === 0 &&
      checkpoint.statusId === PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE &&
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
    nextPhase: {
      phaseId: '8r_complete',
      label: 'Phase 8R Complete',
      reason:
        'Complete checkpoint artifact evidence proves the Phase 8R roadmap, implementation artifacts, validation, changelog, and removal-loop closure evidence are aligned.',
    },
  };

  return {
    ...artifact,
    validation:
      validatePolicyBuilderPhase8CompletionCheckpointArtifact(artifact),
  };
}

function validatePolicyBuilderPhase8CompletionCheckpointArtifact(artifact = {}) {
  const issues = [];

  if (!Object.values(PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS)
    .includes(artifact.statusId)) {
    issues.push(buildRisk(
      PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.UNKNOWN_STATUS,
      'Phase 8R completion checkpoint artifact status must be known.'
    ));
  }

  if (artifact.riskCount !== asArray(artifact.risks).length) {
    issues.push(buildRisk(
      PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.RISK_COUNT_MISMATCH,
      'Phase 8R completion checkpoint artifact risk count must match risk list length.'
    ));
  }

  if (
    artifact.statusId ===
      PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.COMPLETE &&
    artifact.complete !== true
  ) {
    issues.push(buildRisk(
      PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.COMPLETE_FLAG_MISMATCH,
      'Phase 8R completion checkpoint artifact complete flag must match complete status.'
    ));
  }

  Object.entries(artifact.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS
          .SIDE_EFFECT_REPORTED,
        `Phase 8R completion checkpoint artifact cannot report side effect "${key}".`,
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
  PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS,
  PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS,
  PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_VERSION,
  buildPolicyBuilderPhase8CompletionCheckpointArtifact,
  validatePolicyBuilderPhase8CompletionCheckpointArtifact,
};
