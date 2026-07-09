import {
  PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS,
} from './policyBuilderPhase8CompletionEvidenceRun.mjs';
import {
  buildPolicyBuilderPhase8CurrentEvidenceRun,
} from './policyBuilderPhase8CurrentEvidenceCollector.mjs';
import {
  PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS,
  buildPolicyBuilderPhase8CompletionCheckpointArtifact,
} from './policyBuilderPhase8CompletionCheckpointArtifact.mjs';
import {
  PHASE8R_FINAL_CLOSURE_READOUT_STATUS_IDS,
  buildPolicyBuilderPhase8FinalClosureReadout,
} from './policyBuilderPhase8FinalClosureReadout.mjs';

const PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_VERSION =
  'phase8r.current_repository_closure_audit.v1';

const PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  BLOCKED_BY_CURRENT_EVIDENCE: 'blocked_by_current_evidence',
  BLOCKED_BY_CHECKPOINT_ARTIFACT: 'blocked_by_checkpoint_artifact',
  BLOCKED_BY_FINAL_READOUT: 'blocked_by_final_readout',
  BLOCKED_BY_SIDE_EFFECTS: 'blocked_by_side_effects',
});

const PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS = Object.freeze({
  COMPLETION_AUDIT_ARTIFACT_MISSING: 'completion_audit_artifact_missing',
  COMPLETION_AUDIT_ARTIFACT_NOT_COMPLETE:
    'completion_audit_artifact_not_complete',
  COMPLETION_AUDIT_ARTIFACT_VALIDATION_FAILED:
    'completion_audit_artifact_validation_failed',
  VALIDATION_EVIDENCE_MISSING: 'validation_evidence_missing',
  CURRENT_EVIDENCE_RUN_NOT_COMPLETE: 'current_evidence_run_not_complete',
  CHECKPOINT_ARTIFACT_NOT_COMPLETE: 'checkpoint_artifact_not_complete',
  FINAL_READOUT_NOT_COMPLETE: 'final_readout_not_complete',
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

function hasValidationEvidence(validationEvidence = {}) {
  return ['focused', 'lint', 'markdown', 'full']
    .every(key => asObject(validationEvidence)[key]?.passed === true);
}

function summarizeSideEffects({
  currentEvidenceRun = {},
  checkpointArtifact = {},
  finalReadout = {},
  sideEffects = {},
} = {}) {
  return {
    filesRead: sideEffects.filesRead === true,
    filesWritten:
      currentEvidenceRun.sideEffects?.filesWritten === true ||
      checkpointArtifact.sideEffects?.filesWritten === true ||
      finalReadout.sideEffects?.filesWritten === true ||
      sideEffects.filesWritten === true,
    storageChanged:
      currentEvidenceRun.sideEffects?.storageChanged === true ||
      checkpointArtifact.sideEffects?.storageChanged === true ||
      finalReadout.sideEffects?.storageChanged === true ||
      sideEffects.storageChanged === true,
    gitCommandsRun:
      currentEvidenceRun.sideEffects?.gitCommandsRun === true ||
      checkpointArtifact.sideEffects?.gitCommandsRun === true ||
      finalReadout.sideEffects?.gitCommandsRun === true ||
      sideEffects.gitCommandsRun === true,
    commandsExecuted:
      currentEvidenceRun.sideEffects?.commandsExecuted === true ||
      checkpointArtifact.sideEffects?.commandsExecuted === true ||
      finalReadout.sideEffects?.commandsExecuted === true ||
      sideEffects.commandsExecuted === true,
    manifestWritten:
      checkpointArtifact.sideEffects?.manifestWritten === true ||
      finalReadout.sideEffects?.manifestWritten === true ||
      sideEffects.manifestWritten === true,
  };
}

function buildAuditRisks({
  completionAuditArtifact = {},
  validationEvidence = {},
  currentEvidenceRun = {},
  checkpointArtifact = {},
  finalReadout = {},
  sideEffects = {},
} = {}) {
  const risks = [];
  const normalizedCompletionArtifact = asObject(completionAuditArtifact);

  if (Object.keys(normalizedCompletionArtifact).length === 0) {
    risks.push(buildRisk(
      PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_MISSING,
      'Current repository closure audit requires compatibility-removal completion-audit artifact evidence.'
    ));
  }

  if (
    Object.keys(normalizedCompletionArtifact).length > 0 &&
    normalizedCompletionArtifact.complete !== true
  ) {
    risks.push(buildRisk(
      PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_NOT_COMPLETE,
      'Current repository closure audit requires a complete compatibility-removal completion-audit artifact.',
      {
        completionAuditArtifactStatusId:
          normalizedCompletionArtifact.statusId || null,
      }
    ));
  }

  if (
    Object.keys(normalizedCompletionArtifact).length > 0 &&
    normalizedCompletionArtifact.validation?.ok !== true
  ) {
    risks.push(buildRisk(
      PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_VALIDATION_FAILED,
      'Current repository closure audit requires valid compatibility-removal completion-audit artifact evidence.',
      {
        completionAuditArtifactValidationIssueCount:
          normalizedCompletionArtifact.validation?.issueCount ?? null,
      }
    ));
  }

  if (!hasValidationEvidence(validationEvidence)) {
    risks.push(buildRisk(
      PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS
        .VALIDATION_EVIDENCE_MISSING,
      'Current repository closure audit requires focused, lint, markdown, and full validation evidence to pass.'
    ));
  }

  if (
    currentEvidenceRun.statusId !==
      PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS.COMPLETE ||
    currentEvidenceRun.complete !== true
  ) {
    risks.push(buildRisk(
      PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS
        .CURRENT_EVIDENCE_RUN_NOT_COMPLETE,
      'Current repository evidence run must complete before Phase 8R can close.',
      {
        evidenceRunStatusId: currentEvidenceRun.statusId || null,
        evidenceRunRiskCount: currentEvidenceRun.riskCount ?? null,
      }
    ));
  }

  if (
    checkpointArtifact.statusId !==
      PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.COMPLETE ||
    checkpointArtifact.complete !== true
  ) {
    risks.push(buildRisk(
      PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS
        .CHECKPOINT_ARTIFACT_NOT_COMPLETE,
      'Current repository closure audit requires a complete Phase 8R.32 checkpoint artifact.',
      {
        checkpointArtifactStatusId: checkpointArtifact.statusId || null,
        checkpointArtifactRiskCount: checkpointArtifact.riskCount ?? null,
      }
    ));
  }

  if (
    finalReadout.statusId !== PHASE8R_FINAL_CLOSURE_READOUT_STATUS_IDS.COMPLETE ||
    finalReadout.complete !== true
  ) {
    risks.push(buildRisk(
      PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS
        .FINAL_READOUT_NOT_COMPLETE,
      'Current repository closure audit requires a complete Phase 8R.33 final closure readout.',
      {
        finalReadoutStatusId: finalReadout.statusId || null,
        finalReadoutRiskCount: finalReadout.riskCount ?? null,
      }
    ));
  }

  Object.entries(sideEffects || {}).forEach(([key, value]) => {
    if (key !== 'filesRead' && value === true) {
      risks.push(buildRisk(
        PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS.SIDE_EFFECT_REPORTED,
        `Current repository closure audit cannot report side effect "${key}".`,
        { sideEffect: key }
      ));
    }
  });

  return risks;
}

function determineStatusId({
  risks = [],
  currentEvidenceRun = {},
  checkpointArtifact = {},
  finalReadout = {},
  sideEffects = {},
} = {}) {
  if (risks.length === 0) {
    return PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS.COMPLETE;
  }

  if (Object.entries(sideEffects || {}).some(([key, value]) => (
    key !== 'filesRead' && value === true
  ))) {
    return PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS
      .BLOCKED_BY_SIDE_EFFECTS;
  }

  if (
    currentEvidenceRun.statusId !==
      PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS.COMPLETE ||
    currentEvidenceRun.complete !== true
  ) {
    return PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS
      .BLOCKED_BY_CURRENT_EVIDENCE;
  }

  if (
    checkpointArtifact.statusId !==
      PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.COMPLETE ||
    checkpointArtifact.complete !== true
  ) {
    return PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS
      .BLOCKED_BY_CHECKPOINT_ARTIFACT;
  }

  if (
    finalReadout.statusId !== PHASE8R_FINAL_CLOSURE_READOUT_STATUS_IDS.COMPLETE ||
    finalReadout.complete !== true
  ) {
    return PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS
      .BLOCKED_BY_FINAL_READOUT;
  }

  return PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS
    .BLOCKED_BY_CHECKPOINT_ARTIFACT;
}

function buildPolicyBuilderPhase8CurrentRepositoryClosureAudit({
  cwd = process.cwd(),
  completionAuditArtifact = {},
  validationEvidence = {},
  generatedAt = null,
  sideEffects = {},
  fileExists,
  readTextFile,
} = {}) {
  const finalRemovalAudit = asObject(completionAuditArtifact).audit || {};
  const currentEvidence = buildPolicyBuilderPhase8CurrentEvidenceRun({
    cwd,
    finalRemovalAudit,
    validationEvidence,
    sideEffects,
    fileExists,
    readTextFile,
  });
  const checkpointArtifact = buildPolicyBuilderPhase8CompletionCheckpointArtifact({
    componentEvidence: currentEvidence.evidenceRun.componentEvidence,
    roadmapEvidence: currentEvidence.roadmapEvidence,
    completionAuditArtifact,
    validationEvidence,
    changelogEvidence: currentEvidence.changelogEvidence,
    generatedAt,
    sideEffects,
  });
  const finalReadout = buildPolicyBuilderPhase8FinalClosureReadout({
    checkpointArtifact,
    generatedAt,
    sideEffects,
  });
  const combinedSideEffects = summarizeSideEffects({
    currentEvidenceRun: currentEvidence.evidenceRun,
    checkpointArtifact,
    finalReadout,
    sideEffects: {
      filesRead: true,
      ...sideEffects,
    },
  });
  const risks = buildAuditRisks({
    completionAuditArtifact,
    validationEvidence,
    currentEvidenceRun: currentEvidence.evidenceRun,
    checkpointArtifact,
    finalReadout,
    sideEffects: combinedSideEffects,
  });
  const statusId = determineStatusId({
    risks,
    currentEvidenceRun: currentEvidence.evidenceRun,
    checkpointArtifact,
    finalReadout,
    sideEffects: combinedSideEffects,
  });
  const audit = {
    version: PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_VERSION,
    generatedAt: normalizeGeneratedAt(generatedAt),
    statusId,
    complete:
      statusId ===
        PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS.COMPLETE,
    currentEvidence: {
      roadmapPath: currentEvidence.roadmapPath,
      changelogPath: currentEvidence.changelogPath,
      artifactInventory: currentEvidence.artifactInventory,
      roadmapEvidence: currentEvidence.roadmapEvidence,
      changelogEvidence: currentEvidence.changelogEvidence,
      evidenceRun: currentEvidence.evidenceRun,
    },
    checkpointArtifact,
    finalReadout,
    summary: {
      evidenceRunStatusId: currentEvidence.evidenceRun.statusId,
      evidenceRunComplete: currentEvidence.evidenceRun.complete === true,
      checkpointArtifactStatusId: checkpointArtifact.statusId,
      checkpointArtifactComplete: checkpointArtifact.complete === true,
      finalReadoutStatusId: finalReadout.statusId,
      finalReadoutComplete: finalReadout.complete === true,
      missingCurrentArtifactCount:
        currentEvidence.artifactInventory?.missingPathCount ?? 0,
      validationEvidenceComplete: hasValidationEvidence(validationEvidence),
    },
    riskCount: risks.length,
    risks,
    sideEffects: combinedSideEffects,
    executionPolicy: {
      readsCurrentRepositoryFiles: true,
      requireCompletionAuditArtifact: true,
      requireValidationEvidence: true,
      requireCurrentRoadmapEvidence: true,
      requireCurrentChangelogEvidence: true,
      requireCurrentArtifactInventory: true,
      allowFileWrites: false,
      allowStorageMutation: false,
      allowGitCommandsInsideAudit: false,
      allowCommandExecutionInsideService: false,
      allowManifestWrite: false,
    },
    nextPhase: {
      phaseId: '8r_complete',
      label: 'Phase 8R Completion Decision',
      reason:
        'A complete current-repository closure audit proves the current checkout satisfies the Phase 8R closure chain.',
    },
  };

  return {
    ...audit,
    validation:
      validatePolicyBuilderPhase8CurrentRepositoryClosureAudit(audit),
  };
}

function validatePolicyBuilderPhase8CurrentRepositoryClosureAudit(audit = {}) {
  const issues = [];

  if (!Object.values(PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS)
    .includes(audit.statusId)) {
    issues.push(buildRisk(
      PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS.UNKNOWN_STATUS,
      'Current repository closure audit status must be known.'
    ));
  }

  if (audit.riskCount !== asArray(audit.risks).length) {
    issues.push(buildRisk(
      PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS.RISK_COUNT_MISMATCH,
      'Current repository closure audit risk count must match risk list length.'
    ));
  }

  if (
    audit.statusId ===
      PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS.COMPLETE &&
    audit.complete !== true
  ) {
    issues.push(buildRisk(
      PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS
        .COMPLETE_FLAG_MISMATCH,
      'Current repository closure audit complete flag must match complete status.'
    ));
  }

  Object.entries(audit.sideEffects || {}).forEach(([key, value]) => {
    if (key !== 'filesRead' && value === true) {
      issues.push(buildRisk(
        PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS
          .SIDE_EFFECT_REPORTED,
        `Current repository closure audit cannot report side effect "${key}".`,
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
  PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS,
  PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS,
  PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_VERSION,
  buildPolicyBuilderPhase8CurrentRepositoryClosureAudit,
  validatePolicyBuilderPhase8CurrentRepositoryClosureAudit,
};
