import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_VERSION,
} from './policyCompatibilityRemovalCompletionAuditArtifact.mjs';
import {
  POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS,
} from './policyStorageClosureEvidenceRun.mjs';
import {
  buildPolicyStorageClosureCurrentEvidenceRun,
} from './policyStorageClosureCurrentEvidenceCollector.mjs';
import {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS,
  buildPolicyStorageCompletionCheckpointArtifact,
} from './policyStorageCompletionCheckpointArtifact.mjs';
import {
  POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS,
  buildPolicyStorageFinalClosureReadout,
} from './policyStorageFinalClosureReadout.mjs';
import {
  buildPolicyStorageCurrentClosureAuditFingerprint,
  validatePolicyStorageCurrentClosureAuditFingerprint,
} from './policyStorageCurrentClosureAuditFingerprint.mjs';
import {
  validatePolicyStorageClosureValidationEvidenceIntegrity,
} from './policyStorageClosureValidationEvidenceIntegrity.mjs';
import {
  isPolicyStorageImplementationReady,
  isPolicyStorageInstanceCutoverReady,
} from './policyStorageClosureScopes.mjs';

const POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_VERSION =
  'policy.storage_current_closure_audit.v6';

const POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  BLOCKED_BY_CURRENT_EVIDENCE: 'blocked_by_current_evidence',
  BLOCKED_BY_INSTANCE_CUTOVER: 'blocked_by_instance_cutover',
  BLOCKED_BY_CHECKPOINT_ARTIFACT: 'blocked_by_checkpoint_artifact',
  BLOCKED_BY_FINAL_READOUT: 'blocked_by_final_readout',
  BLOCKED_BY_SIDE_EFFECTS: 'blocked_by_side_effects',
});

const POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS = Object.freeze({
  COMPLETION_AUDIT_ARTIFACT_MISSING: 'completion_audit_artifact_missing',
  COMPLETION_AUDIT_ARTIFACT_NOT_COMPLETE:
    'completion_audit_artifact_not_complete',
  COMPLETION_AUDIT_ARTIFACT_VALIDATION_FAILED:
    'completion_audit_artifact_validation_failed',
  COMPLETION_AUDIT_ARTIFACT_VERSION_UNSUPPORTED:
    'completion_audit_artifact_version_unsupported',
  VALIDATION_EVIDENCE_MISSING: 'validation_evidence_missing',
  VALIDATION_EVIDENCE_ARTIFACT_INTEGRITY_FAILED:
    'validation_evidence_artifact_integrity_failed',
  UNKNOWN_VERSION: 'unknown_version',
  ARTIFACT_FINGERPRINT_INVALID: 'artifact_fingerprint_invalid',
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
  const validationIntegrity =
    validatePolicyStorageClosureValidationEvidenceIntegrity({ validationEvidence });

  return validationIntegrity.ok === true && ['focused', 'lint', 'markdown', 'full']
    .every(key => asObject(validationIntegrity.evidence)[key]?.passed === true);
}

function buildClosureInput({
  currentEvidence = {},
  completionAuditArtifact = {},
  validationEvidence = {},
  sideEffects = {},
} = {}) {
  const evidence = asObject(currentEvidence);

  return {
    currentEvidence: {
      version: evidence.version || null,
      roadmapPath: evidence.roadmapPath || null,
      changelogPath: evidence.changelogPath || null,
      artifactInventory: asObject(evidence.artifactInventory),
      roadmapEvidence: asObject(evidence.roadmapEvidence),
      changelogEvidence: asObject(evidence.changelogEvidence),
      currentEvidenceFingerprint: asObject(evidence.currentEvidenceFingerprint),
    },
    completionAuditArtifact: asObject(completionAuditArtifact),
    validationEvidence: asObject(validationEvidence),
    sideEffects: asObject(sideEffects),
  };
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
  const validationIntegrity =
    validatePolicyStorageClosureValidationEvidenceIntegrity({ validationEvidence });

  if (Object.keys(normalizedCompletionArtifact).length === 0) {
    risks.push(buildRisk(
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_MISSING,
      'Policy storage current closure audit requires compatibility-removal completion-audit artifact evidence.'
    ));
  }

  if (
    Object.keys(normalizedCompletionArtifact).length > 0 &&
    normalizedCompletionArtifact.complete !== true
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_NOT_COMPLETE,
      'Policy storage current closure audit requires a complete compatibility-removal completion-audit artifact.',
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
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_VALIDATION_FAILED,
      'Policy storage current closure audit requires valid compatibility-removal completion-audit artifact evidence.',
      {
        completionAuditArtifactValidationIssueCount:
          normalizedCompletionArtifact.validation?.issueCount ?? null,
      }
    ));
  }

  if (
    Object.keys(normalizedCompletionArtifact).length > 0 &&
    normalizedCompletionArtifact.version !==
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_VERSION
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_VERSION_UNSUPPORTED,
      'Policy storage current closure audit requires the current compatibility-removal completion-audit artifact version.',
      {
        expectedVersion:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_VERSION,
        receivedVersion: normalizedCompletionArtifact.version || null,
      }
    ));
  }

  if (!validationIntegrity.ok) {
    risks.push(buildRisk(
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
        .VALIDATION_EVIDENCE_ARTIFACT_INTEGRITY_FAILED,
      'Policy storage current closure audit requires fingerprint-valid, replay-verified validation evidence.',
      {
        issueCount: validationIntegrity.issueCount,
        issueRiskIds: validationIntegrity.issues.map(issue => issue.riskId),
      }
    ));
  }

  if (!hasValidationEvidence(validationEvidence)) {
    risks.push(buildRisk(
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
        .VALIDATION_EVIDENCE_MISSING,
      'Policy storage current closure audit requires focused, lint, markdown, and full validation evidence to pass.'
    ));
  }

  if (
    currentEvidenceRun.statusId !==
      POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.COMPLETE ||
    currentEvidenceRun.complete !== true
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
        .CURRENT_EVIDENCE_RUN_NOT_COMPLETE,
      'Current repository evidence run must complete before policy storage closure can pass.',
      {
        evidenceRunStatusId: currentEvidenceRun.statusId || null,
        evidenceRunRiskCount: currentEvidenceRun.riskCount ?? null,
      }
    ));
  }

  if (
    checkpointArtifact.statusId !==
      POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.COMPLETE ||
    checkpointArtifact.complete !== true
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
        .CHECKPOINT_ARTIFACT_NOT_COMPLETE,
      'Policy storage current closure audit requires a complete policy storage completion-checkpoint artifact.',
      {
        checkpointArtifactStatusId: checkpointArtifact.statusId || null,
        checkpointArtifactRiskCount: checkpointArtifact.riskCount ?? null,
      }
    ));
  }

  if (
    finalReadout.statusId !== POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.COMPLETE ||
    finalReadout.complete !== true
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
        .FINAL_READOUT_NOT_COMPLETE,
      'Policy storage current closure audit requires a complete policy storage final closure readout.',
      {
        finalReadoutStatusId: finalReadout.statusId || null,
        finalReadoutRiskCount: finalReadout.riskCount ?? null,
      }
    ));
  }

  Object.entries(sideEffects || {}).forEach(([key, value]) => {
    if (key !== 'filesRead' && value === true) {
      risks.push(buildRisk(
        POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS.SIDE_EFFECT_REPORTED,
        `Policy storage current closure audit cannot report side effect "${key}".`,
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
    return POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS.COMPLETE;
  }

  if (Object.entries(sideEffects || {}).some(([key, value]) => (
    key !== 'filesRead' && value === true
  ))) {
    return POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS
      .BLOCKED_BY_SIDE_EFFECTS;
  }

  if (
    isPolicyStorageImplementationReady({
      implementationReadiness: currentEvidenceRun.implementationReadiness,
      instanceCutover: currentEvidenceRun.instanceCutover,
    }) &&
    !isPolicyStorageInstanceCutoverReady({
      implementationReadiness: currentEvidenceRun.implementationReadiness,
      instanceCutover: currentEvidenceRun.instanceCutover,
    })
  ) {
    return POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS
      .BLOCKED_BY_INSTANCE_CUTOVER;
  }

  if (
    currentEvidenceRun.statusId !==
      POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.COMPLETE ||
    currentEvidenceRun.complete !== true
  ) {
    return POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS
      .BLOCKED_BY_CURRENT_EVIDENCE;
  }

  if (
    checkpointArtifact.statusId !==
      POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.COMPLETE ||
    checkpointArtifact.complete !== true
  ) {
    return POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS
      .BLOCKED_BY_CHECKPOINT_ARTIFACT;
  }

  if (
    finalReadout.statusId !== POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.COMPLETE ||
    finalReadout.complete !== true
  ) {
    return POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS
      .BLOCKED_BY_FINAL_READOUT;
  }

  return POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS
    .BLOCKED_BY_CHECKPOINT_ARTIFACT;
}

function buildNextStep({ implementationReadiness = {}, instanceCutover = {} } = {}) {
  if (
    isPolicyStorageImplementationReady({ implementationReadiness, instanceCutover }) &&
    !isPolicyStorageInstanceCutoverReady({ implementationReadiness, instanceCutover })
  ) {
    return {
      stepId: 'policy_storage_instance_cutover',
      label: 'Active Installation Cutover',
      reason:
        'Repository implementation readiness is complete; final storage closure remains scoped to active-installation cutover evidence.',
    };
  }

  return {
    stepId: 'policy_storage_current_closure_complete',
    label: 'Policy Storage Current Closure Complete',
    reason:
      'A complete policy storage current closure audit proves the current checkout satisfies the policy storage closure chain.',
  };
}

async function buildPolicyStorageCurrentClosureAuditFromEvidence({
  currentEvidence = {},
  completionAuditArtifact = {},
  validationEvidence = {},
  generatedAt = null,
  sideEffects = {},
} = {}) {
  const normalizedCurrentEvidence = asObject(currentEvidence);
  const checkpointArtifact = await buildPolicyStorageCompletionCheckpointArtifact({
    componentEvidence: normalizedCurrentEvidence.evidenceRun?.componentEvidence,
    roadmapEvidence: normalizedCurrentEvidence.roadmapEvidence,
    completionAuditArtifact,
    validationEvidence,
    changelogEvidence: normalizedCurrentEvidence.changelogEvidence,
    generatedAt,
    sideEffects,
  });
  const finalReadout = await buildPolicyStorageFinalClosureReadout({
    checkpointArtifact,
    generatedAt,
    sideEffects,
  });
  const combinedSideEffects = summarizeSideEffects({
    currentEvidenceRun: normalizedCurrentEvidence.evidenceRun,
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
    currentEvidenceRun: normalizedCurrentEvidence.evidenceRun,
    checkpointArtifact,
    finalReadout,
    sideEffects: combinedSideEffects,
  });
  const statusId = determineStatusId({
    risks,
    currentEvidenceRun: normalizedCurrentEvidence.evidenceRun,
    checkpointArtifact,
    finalReadout,
    sideEffects: combinedSideEffects,
  });
  const implementationReadiness =
    normalizedCurrentEvidence.evidenceRun?.implementationReadiness || {};
  const instanceCutover =
    normalizedCurrentEvidence.evidenceRun?.instanceCutover || {};
  const audit = {
    version: POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_VERSION,
    generatedAt: normalizeGeneratedAt(generatedAt),
    statusId,
    complete:
      statusId ===
        POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS.COMPLETE,
    currentEvidence: {
      roadmapPath: normalizedCurrentEvidence.roadmapPath,
      changelogPath: normalizedCurrentEvidence.changelogPath,
      artifactInventory: normalizedCurrentEvidence.artifactInventory,
      roadmapEvidence: normalizedCurrentEvidence.roadmapEvidence,
      changelogEvidence: normalizedCurrentEvidence.changelogEvidence,
      currentEvidenceFingerprint: normalizedCurrentEvidence.currentEvidenceFingerprint,
      evidenceRun: normalizedCurrentEvidence.evidenceRun,
    },
    implementationReadiness,
    instanceCutover,
    componentScopeMap:
      normalizedCurrentEvidence.evidenceRun?.componentScopeMap || {},
    closureInput: buildClosureInput({
      currentEvidence: normalizedCurrentEvidence,
      completionAuditArtifact,
      validationEvidence,
      sideEffects,
    }),
    checkpointArtifact,
    finalReadout,
    summary: {
      evidenceRunStatusId: normalizedCurrentEvidence.evidenceRun?.statusId || null,
      evidenceRunComplete: normalizedCurrentEvidence.evidenceRun?.complete === true,
      checkpointArtifactStatusId: checkpointArtifact.statusId,
      checkpointArtifactComplete: checkpointArtifact.complete === true,
      finalReadoutStatusId: finalReadout.statusId,
      finalReadoutComplete: finalReadout.complete === true,
      missingCurrentArtifactCount:
        normalizedCurrentEvidence.artifactInventory?.missingPathCount ?? 0,
      validationEvidenceComplete: hasValidationEvidence(validationEvidence),
      validationEvidenceArtifactFingerprint:
        validationEvidence.artifactFingerprint?.fingerprint || null,
      implementationReadinessReady: implementationReadiness.ready === true,
      instanceCutoverReady: instanceCutover.ready === true,
      implementationComponentCount:
        normalizedCurrentEvidence.evidenceRun?.componentScopeMap
          ?.implementationReadiness?.componentCount ?? 0,
      instanceCutoverComponentCount:
        normalizedCurrentEvidence.evidenceRun?.componentScopeMap
          ?.instanceCutover?.componentCount ?? 0,
    },
    riskCount: risks.length,
    risks,
    sideEffects: combinedSideEffects,
    executionPolicy: {
      readsCurrentRepositoryFiles: true,
      requireCompletionAuditArtifact: true,
      requireCurrentCompletionAuditArtifactVersion: true,
      requireValidationEvidence: true,
      requireFingerprintValidValidationEvidence: true,
      requireReplayedValidationEvidence: true,
      requireCurrentRoadmapEvidence: true,
      requireCurrentChangelogEvidence: true,
      requireCurrentArtifactInventory: true,
      retainClosureInputs: true,
      emitArtifactFingerprint: true,
      separateImplementationReadinessAndInstanceCutover: true,
      repositoryRetirementAffectsOnlyInstanceCutover: true,
      allowFileWrites: false,
      allowStorageMutation: false,
      allowGitCommandsInsideAudit: false,
      allowCommandExecutionInsideService: false,
      allowManifestWrite: false,
    },
    nextStep: buildNextStep({ implementationReadiness, instanceCutover }),
  };

  const auditWithFingerprint = {
    ...audit,
    artifactFingerprint: buildPolicyStorageCurrentClosureAuditFingerprint({ audit }),
  };

  return {
    ...auditWithFingerprint,
    validation:
      validatePolicyStorageCurrentClosureAudit(auditWithFingerprint),
  };
}

async function buildPolicyStorageCurrentClosureAudit({
  cwd = process.cwd(),
  completionAuditArtifact = {},
  validationEvidence = {},
  generatedAt = null,
  sideEffects = {},
  fileExists,
  readTextFile,
} = {}) {
  // Use one boundary timestamp so the emitted artifact can be rebuilt exactly.
  const resolvedGeneratedAt = normalizeGeneratedAt(generatedAt);
  const currentEvidence = await buildPolicyStorageClosureCurrentEvidenceRun({
    cwd,
    completionAuditArtifact,
    validationEvidence,
    sideEffects,
    fileExists,
    readTextFile,
  });

  return buildPolicyStorageCurrentClosureAuditFromEvidence({
    currentEvidence,
    completionAuditArtifact,
    validationEvidence,
    generatedAt: resolvedGeneratedAt,
    sideEffects,
  });
}

function validatePolicyStorageCurrentClosureAudit(audit = {}) {
  const issues = [];

  if (audit.version !== POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_VERSION) {
    issues.push(buildRisk(
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS.UNKNOWN_VERSION,
      'Policy storage current closure audit version must be recognized.',
      { version: audit.version || null }
    ));
  }

  if (!Object.values(POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS)
    .includes(audit.statusId)) {
    issues.push(buildRisk(
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS.UNKNOWN_STATUS,
      'Policy storage current closure audit status must be known.'
    ));
  }

  if (audit.riskCount !== asArray(audit.risks).length) {
    issues.push(buildRisk(
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS.RISK_COUNT_MISMATCH,
      'Policy storage current closure audit risk count must match risk list length.'
    ));
  }

  if (
    audit.statusId ===
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS.COMPLETE &&
    audit.complete !== true
  ) {
    issues.push(buildRisk(
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
        .COMPLETE_FLAG_MISMATCH,
      'Policy storage current closure audit complete flag must match complete status.'
    ));
  }

  const fingerprintValidation =
    validatePolicyStorageCurrentClosureAuditFingerprint({
      audit,
      artifactFingerprint: audit.artifactFingerprint,
    });
  if (!fingerprintValidation.ok) {
    issues.push(buildRisk(
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS.ARTIFACT_FINGERPRINT_INVALID,
      'Policy storage current closure audit fingerprint must bind the audit contents.',
      { issueCount: fingerprintValidation.issueCount }
    ));
  }

  Object.entries(audit.sideEffects || {}).forEach(([key, value]) => {
    if (key !== 'filesRead' && value === true) {
      issues.push(buildRisk(
        POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
          .SIDE_EFFECT_REPORTED,
        `Policy storage current closure audit cannot report side effect "${key}".`,
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
  POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS,
  POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS,
  POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_VERSION,
  buildPolicyStorageCurrentClosureAudit,
  buildPolicyStorageCurrentClosureAuditFromEvidence,
  validatePolicyStorageCurrentClosureAudit,
};
