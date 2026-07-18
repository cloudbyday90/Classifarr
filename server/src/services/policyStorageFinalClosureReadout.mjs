import {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS,
} from './policyStorageCompletionCheckpointArtifact.mjs';
import {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS,
} from './policyStorageCompletionCheckpoint.mjs';
import {
  validatePolicyStorageCompletionCheckpointArtifactIntegrity,
} from './policyStorageCompletionCheckpointArtifactIntegrity.mjs';
import {
  buildPolicyStorageClosureScopes,
  isPolicyStorageImplementationReady,
  isPolicyStorageInstanceCutoverReady,
} from './policyStorageClosureScopes.mjs';

const POLICY_STORAGE_FINAL_CLOSURE_READOUT_VERSION =
  'policy.storage_final_closure_readout.v1';

const POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  BLOCKED_BY_COMPONENT_EVIDENCE: 'blocked_by_component_evidence',
  BLOCKED_BY_ROADMAP_EVIDENCE: 'blocked_by_roadmap_evidence',
  BLOCKED_BY_REMOVAL_AUDIT: 'blocked_by_removal_audit',
  BLOCKED_BY_VALIDATION: 'blocked_by_validation',
  BLOCKED_BY_CHANGELOG: 'blocked_by_changelog',
  BLOCKED_BY_ARTIFACT_VALIDATION: 'blocked_by_artifact_validation',
  BLOCKED_BY_SIDE_EFFECTS: 'blocked_by_side_effects',
  BLOCKED_BY_UNKNOWN_CHECKPOINT_STATE: 'blocked_by_unknown_checkpoint_state',
});

const POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS = Object.freeze({
  CHECKPOINT_ARTIFACT_MISSING: 'checkpoint_artifact_missing',
  CHECKPOINT_ARTIFACT_NOT_COMPLETE: 'checkpoint_artifact_not_complete',
  CHECKPOINT_ARTIFACT_VALIDATION_FAILED:
    'checkpoint_artifact_validation_failed',
  CHECKPOINT_ARTIFACT_INTEGRITY_FAILED:
    'checkpoint_artifact_integrity_failed',
  CHECKPOINT_MISSING: 'checkpoint_missing',
  CHECKPOINT_NOT_COMPLETE: 'checkpoint_not_complete',
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

function hasAnySideEffect(sideEffects = {}) {
  return Object.values(sideEffects || {}).some(value => value === true);
}

function summarizeSideEffects(checkpointArtifact = {}, sideEffects = {}) {
  return {
    filesWritten:
      checkpointArtifact.sideEffects?.filesWritten === true ||
      sideEffects.filesWritten === true,
    storageChanged:
      checkpointArtifact.sideEffects?.storageChanged === true ||
      sideEffects.storageChanged === true,
    gitCommandsRun:
      checkpointArtifact.sideEffects?.gitCommandsRun === true ||
      sideEffects.gitCommandsRun === true,
    commandsExecuted:
      checkpointArtifact.sideEffects?.commandsExecuted === true ||
      sideEffects.commandsExecuted === true,
    manifestWritten:
      checkpointArtifact.sideEffects?.manifestWritten === true ||
      sideEffects.manifestWritten === true,
  };
}

function normalizeCheckpointArtifact(checkpointArtifact = {}) {
  const artifact = asObject(checkpointArtifact);
  const checkpoint = asObject(artifact.checkpoint);

  return {
    artifact,
    checkpoint,
    artifactPresent: Object.keys(artifact).length > 0,
    checkpointPresent: Object.keys(checkpoint).length > 0,
    artifactStatusId: artifact.statusId || null,
    artifactComplete: artifact.complete === true,
    artifactValidationOk: artifact.validation?.ok === true,
    checkpointStatusId: checkpoint.statusId || null,
    checkpointComplete: checkpoint.complete === true,
    checkpointValidationOk: checkpoint.validation?.ok === true,
  };
}

function buildReadoutRisks({
  checkpointArtifact = {},
  checkpointArtifactIntegrity = {},
  sideEffects = {},
} = {}) {
  const risks = [];
  const normalized = normalizeCheckpointArtifact(checkpointArtifact);

  if (checkpointArtifactIntegrity.ok !== true) {
    risks.push(buildRisk(
      POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS
        .CHECKPOINT_ARTIFACT_INTEGRITY_FAILED,
      'Policy storage final closure readout requires a fingerprint-valid replayable completion-checkpoint artifact.',
      {
        integrityIssueCount: checkpointArtifactIntegrity.issueCount ?? null,
        integrityIssueRiskIds:
          asArray(checkpointArtifactIntegrity.issues).map(issue => issue.riskId),
      }
    ));
  }

  if (!normalized.artifactPresent) {
    risks.push(buildRisk(
      POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS.CHECKPOINT_ARTIFACT_MISSING,
      'Policy storage final closure readout requires a policy storage completion-checkpoint artifact.'
    ));
  }

  if (
    normalized.artifactPresent &&
    (
      normalized.artifactStatusId !==
        POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.COMPLETE ||
      normalized.artifactComplete !== true
    )
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS
        .CHECKPOINT_ARTIFACT_NOT_COMPLETE,
      'Policy storage final closure readout requires a complete policy storage completion-checkpoint artifact.',
      {
        artifactStatusId: normalized.artifactStatusId,
        artifactComplete: normalized.artifactComplete,
      }
    ));
  }

  if (
    normalized.artifactPresent &&
    normalized.artifactValidationOk !== true
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS
        .CHECKPOINT_ARTIFACT_VALIDATION_FAILED,
      'Policy storage final closure readout requires valid policy storage completion-checkpoint artifact output.',
      {
        artifactValidationIssueCount:
          normalized.artifact.validation?.issueCount ?? null,
      }
    ));
  }

  if (!normalized.checkpointPresent) {
    risks.push(buildRisk(
      POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS.CHECKPOINT_MISSING,
      'Policy storage final closure readout requires nested policy storage checkpoint evidence.'
    ));
  }

  if (
    normalized.checkpointPresent &&
    (
      normalized.checkpointStatusId !==
        POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE ||
      normalized.checkpointComplete !== true ||
      normalized.checkpointValidationOk !== true
    )
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS.CHECKPOINT_NOT_COMPLETE,
      'Policy storage final closure readout requires the nested policy storage checkpoint to be complete and valid.',
      {
        checkpointStatusId: normalized.checkpointStatusId,
        checkpointComplete: normalized.checkpointComplete,
        checkpointValidationOk: normalized.checkpointValidationOk,
      }
    ));
  }

  Object.entries(sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      risks.push(buildRisk(
        POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS.SIDE_EFFECT_REPORTED,
        `Policy storage final closure readout cannot report side effect "${key}".`,
        { sideEffect: key }
      ));
    }
  });

  return risks;
}

function determineBlockedStatusId({
  checkpointArtifact = {},
  checkpointArtifactIntegrity = {},
  sideEffects = {},
} = {}) {
  const normalized = normalizeCheckpointArtifact(checkpointArtifact);

  if (hasAnySideEffect(sideEffects)) {
    return POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_SIDE_EFFECTS;
  }

  if (checkpointArtifactIntegrity.ok !== true) {
    return POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS
      .BLOCKED_BY_ARTIFACT_VALIDATION;
  }

  switch (normalized.checkpointStatusId) {
    case POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS
      .BLOCKED_BY_COMPONENT_COVERAGE:
      return POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS
        .BLOCKED_BY_COMPONENT_EVIDENCE;
    case POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_ROADMAP_EVIDENCE:
      return POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS
        .BLOCKED_BY_ROADMAP_EVIDENCE;
    case POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_FINAL_REMOVAL_AUDIT:
      return POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS
        .BLOCKED_BY_REMOVAL_AUDIT;
    case POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_VALIDATION:
      return POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_VALIDATION;
    case POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_CHANGELOG:
      return POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_CHANGELOG;
    default:
      return POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS
        .BLOCKED_BY_UNKNOWN_CHECKPOINT_STATE;
  }
}

function determineStatusId({
  risks = [],
  checkpointArtifact = {},
  checkpointArtifactIntegrity = {},
  sideEffects = {},
} = {}) {
  if (risks.length === 0) {
    return POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.COMPLETE;
  }

  return determineBlockedStatusId({
    checkpointArtifact,
    checkpointArtifactIntegrity,
    sideEffects,
  });
}

function buildOperatorSummary({
  statusId,
  checkpointArtifact = {},
  implementationReadiness = {},
  instanceCutover = {},
  risks = [],
} = {}) {
  const normalized = normalizeCheckpointArtifact(checkpointArtifact);
  const checkpoint = normalized.checkpoint;
  const artifactRisks = asArray(normalized.artifact.risks);
  const checkpointRisks = asArray(checkpoint.risks);

  if (statusId === POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.COMPLETE) {
    return {
      decision: 'complete',
      message:
        'Policy storage closure evidence is complete. Native storage migration, compatibility removal, validation, roadmap, and changelog proof are aligned.',
      nextAction: 'Policy storage closure can be treated as complete.',
    };
  }

  if (
    isPolicyStorageImplementationReady({ implementationReadiness, instanceCutover }) &&
    !isPolicyStorageInstanceCutoverReady({ implementationReadiness, instanceCutover })
  ) {
    return {
      decision: 'implementation_ready_instance_cutover_pending',
      message:
        'Repository implementation readiness is complete. Active-installation cutover evidence remains pending and does not change repository readiness.',
      nextAction:
        'Complete the active-installation compatibility-removal evidence and controlled cutover workflow.',
      artifactRiskCount: artifactRisks.length,
      checkpointRiskCount: checkpointRisks.length,
      readoutRiskCount: risks.length,
    };
  }

  return {
    decision: 'blocked',
    message:
      'Policy storage closure evidence is not complete. Resolve the reported evidence category before claiming storage closure complete.',
    nextAction: buildNextAction(statusId),
    artifactRiskCount: artifactRisks.length,
    checkpointRiskCount: checkpointRisks.length,
    readoutRiskCount: risks.length,
  };
}

function buildNextAction(statusId) {
  switch (statusId) {
    case POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS
      .BLOCKED_BY_COMPONENT_EVIDENCE:
      return 'Fix missing implementation, design-doc, contract, or test evidence.';
    case POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS
      .BLOCKED_BY_ROADMAP_EVIDENCE:
      return 'Update the roadmap sequence and implementation status evidence.';
    case POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_REMOVAL_AUDIT:
      return 'Complete the compatibility-removal audit or continue the removal loop.';
    case POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_VALIDATION:
      return 'Refresh focused, lint, markdown, and full validation evidence.';
    case POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_CHANGELOG:
      return 'Update changelog evidence for the missing policy storage components.';
    case POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_SIDE_EFFECTS:
      return 'Regenerate the readout without side effects in the evidence contract.';
    case POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS
      .BLOCKED_BY_ARTIFACT_VALIDATION:
      return 'Regenerate or fix the policy storage completion-checkpoint artifact.';
    default:
      return 'Inspect the checkpoint artifact and nested checkpoint status.';
  }
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
    stepId: 'policy_storage_closure_complete',
    label: 'Policy Storage Closure Complete',
    reason:
      'The final closure readout is the operator-facing completion decision for policy storage migration closure.',
  };
}

async function buildPolicyStorageFinalClosureReadout({
  checkpointArtifact = {},
  generatedAt = null,
  sideEffects = {},
} = {}) {
  const checkpointArtifactIntegrity =
    await validatePolicyStorageCompletionCheckpointArtifactIntegrity({
      checkpointArtifact,
    });
  const verifiedCheckpointArtifact = checkpointArtifactIntegrity.ok === true
    ? checkpointArtifactIntegrity.artifact
    : checkpointArtifact;
  const normalized = normalizeCheckpointArtifact(verifiedCheckpointArtifact);
  const {
    implementationReadiness,
    instanceCutover,
  } = buildPolicyStorageClosureScopes({
    implementationReadiness: normalized.checkpoint.implementationReadiness,
    finalRemovalAudit: normalized.checkpoint.finalRemovalAudit,
  });
  const combinedSideEffects = summarizeSideEffects(
    normalized.artifact,
    sideEffects
  );
  const risks = buildReadoutRisks({
    checkpointArtifact: verifiedCheckpointArtifact,
    checkpointArtifactIntegrity,
    sideEffects: combinedSideEffects,
  });
  const statusId = determineStatusId({
    risks,
    checkpointArtifact: verifiedCheckpointArtifact,
    checkpointArtifactIntegrity,
    sideEffects: combinedSideEffects,
  });
  const readout = {
    version: POLICY_STORAGE_FINAL_CLOSURE_READOUT_VERSION,
    generatedAt: normalizeGeneratedAt(generatedAt),
    statusId,
    complete: statusId === POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.COMPLETE,
    operatorSummary: buildOperatorSummary({
      statusId,
      checkpointArtifact: verifiedCheckpointArtifact,
      implementationReadiness,
      instanceCutover,
      risks,
    }),
    implementationReadiness,
    instanceCutover,
    checkpointArtifactSummary: {
      statusId: normalized.artifactStatusId,
      complete: normalized.artifactComplete,
      validationOk: normalized.artifactValidationOk,
      riskCount: normalized.artifact.riskCount ?? null,
    },
    checkpointArtifactIntegrity: {
      ok: checkpointArtifactIntegrity.ok,
      issueCount: checkpointArtifactIntegrity.issueCount,
      artifactFingerprint: checkpointArtifactIntegrity.artifactFingerprint,
    },
    checkpointSummary: {
      statusId: normalized.checkpointStatusId,
      complete: normalized.checkpointComplete,
      validationOk: normalized.checkpointValidationOk,
      riskCount: normalized.checkpoint.riskCount ?? null,
      componentExpectedCount:
        normalized.checkpoint.componentCoverage?.expectedCount ?? 0,
      componentImplementedCount:
        normalized.checkpoint.componentCoverage?.implementedCount ?? 0,
    },
    blockerBreakdown: {
      artifactRisks: asArray(normalized.artifact.risks),
      checkpointRisks: asArray(normalized.checkpoint.risks),
      readoutRisks: risks,
    },
    riskCount: risks.length,
    risks,
    sideEffects: combinedSideEffects,
    executionPolicy: {
      requireCheckpointArtifact: true,
      requireFingerprintValidCheckpointArtifact: true,
      requireReplayedCheckpointArtifact: true,
      requireCompleteCheckpointArtifact: true,
      requireCompleteNestedCheckpoint: true,
      separateImplementationReadinessAndInstanceCutover: true,
      allowFileWrites: false,
      allowStorageMutation: false,
      allowGitCommandsInsideReadout: false,
      allowCommandExecutionInsideService: false,
      allowManifestWrite: false,
    },
    nextStep: buildNextStep({ implementationReadiness, instanceCutover }),
  };

  return {
    ...readout,
    validation: validatePolicyStorageFinalClosureReadout(readout),
  };
}

function validatePolicyStorageFinalClosureReadout(readout = {}) {
  const issues = [];

  if (!Object.values(POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS)
    .includes(readout.statusId)) {
    issues.push(buildRisk(
      POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS.UNKNOWN_STATUS,
      'Policy storage final closure readout status must be known.'
    ));
  }

  if (readout.riskCount !== asArray(readout.risks).length) {
    issues.push(buildRisk(
      POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS.RISK_COUNT_MISMATCH,
      'Policy storage final closure readout risk count must match risk list length.'
    ));
  }

  if (
    readout.statusId === POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.COMPLETE &&
    readout.complete !== true
  ) {
    issues.push(buildRisk(
      POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS.COMPLETE_FLAG_MISMATCH,
      'Policy storage final closure readout complete flag must match complete status.'
    ));
  }

  Object.entries(readout.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS.SIDE_EFFECT_REPORTED,
        `Policy storage final closure readout cannot report side effect "${key}".`,
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
  POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS,
  POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS,
  POLICY_STORAGE_FINAL_CLOSURE_READOUT_VERSION,
  buildPolicyStorageFinalClosureReadout,
  validatePolicyStorageFinalClosureReadout,
};
