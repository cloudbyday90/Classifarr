import {
  PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
  buildPolicyBuilderPhase8CompatibilityRemovalCompletionAudit,
} from './policyBuilderPhase8CompatibilityRemovalCompletionAudit.mjs';

const PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_VERSION =
  'phase8r.compatibility_removal_completion_audit_artifact.v1';

const PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS =
  Object.freeze({
    COMPLETE: 'complete',
    REMAINING_INVENTORY: 'remaining_inventory',
    BLOCKED: 'blocked',
  });

const PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS =
  Object.freeze({
    AUDIT_BLOCKED: 'audit_blocked',
    AUDIT_VALIDATION_FAILED: 'audit_validation_failed',
    SIDE_EFFECT_REPORTED: 'side_effect_reported',
    COMPLETE_FLAG_MISMATCH: 'complete_flag_mismatch',
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

function summarizeSideEffects(audit = {}, sideEffects = {}) {
  return {
    filesDeleted:
      audit.sideEffects?.filesDeleted === true ||
      sideEffects.filesDeleted === true,
    filesArchived:
      audit.sideEffects?.filesArchived === true ||
      sideEffects.filesArchived === true,
    routesRemoved:
      audit.sideEffects?.routesRemoved === true ||
      sideEffects.routesRemoved === true,
    testsRemoved:
      audit.sideEffects?.testsRemoved === true ||
      sideEffects.testsRemoved === true,
    storageChanged:
      audit.sideEffects?.storageChanged === true ||
      sideEffects.storageChanged === true,
    manifestWritten:
      audit.sideEffects?.manifestWritten === true ||
      sideEffects.manifestWritten === true,
    gitCommandsRun:
      audit.sideEffects?.gitCommandsRun === true ||
      sideEffects.gitCommandsRun === true,
  };
}

function determineArtifactStatusId(audit = {}, risks = []) {
  if (risks.length > 0) {
    return PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
      .BLOCKED;
  }

  if (audit.statusId === PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE) {
    return PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS.COMPLETE;
  }

  return PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
    .REMAINING_INVENTORY;
}

function buildArtifactRisks({
  audit = {},
  sideEffects = {},
} = {}) {
  const risks = [];
  const acceptableStatusIds = [
    PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE,
    PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.REMAINING_INVENTORY,
  ];

  if (!acceptableStatusIds.includes(audit.statusId)) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
        .AUDIT_BLOCKED,
      'Compatibility removal completion audit artifact requires complete or remaining-inventory Phase 8R.21 evidence.',
      {
        statusId: audit.statusId || null,
        auditRiskCount: audit.riskCount ?? null,
      }
    ));
  }

  if (audit.validation?.ok !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
        .AUDIT_VALIDATION_FAILED,
      'Compatibility removal completion audit artifact requires valid Phase 8R.21 evidence.',
      { issueCount: audit.validation?.issueCount ?? null }
    ));
  }

  Object.entries(sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      risks.push(buildRisk(
        PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
          .SIDE_EFFECT_REPORTED,
        `Compatibility removal completion audit artifact cannot report side effect "${key}".`,
        { sideEffect: key }
      ));
    }
  });

  return risks;
}

function buildPolicyBuilderPhase8CompatibilityRemovalCompletionAuditArtifact({
  completionAuthorization = {},
  executionPlan = {},
  input = {},
  generatedAt = null,
  sideEffects = {},
} = {}) {
  const evidence = asObject(input);
  const audit = buildPolicyBuilderPhase8CompatibilityRemovalCompletionAudit({
    completionAuthorization,
    executionPlan,
    removalVerifications: asArray(evidence.removalVerifications),
    finalImportScan: asObject(evidence.finalImportScan),
    validationEvidence: asObject(evidence.validationEvidence),
    sideEffects,
  });
  const combinedSideEffects = summarizeSideEffects(audit, sideEffects);
  const risks = buildArtifactRisks({
    audit,
    sideEffects: combinedSideEffects,
  });
  const artifact = {
    version: PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_VERSION,
    generatedAt: normalizeGeneratedAt(generatedAt),
    statusId: determineArtifactStatusId(audit, risks),
    complete:
      risks.length === 0 &&
      audit.statusId === PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE &&
      audit.complete === true,
    remainingInventory:
      risks.length === 0 &&
      audit.statusId ===
        PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.REMAINING_INVENTORY,
    audit,
    auditSummary: {
      manifestTotalCount: audit.manifestInventory?.totalCount ?? 0,
      manifestRemovedCount: audit.manifestInventory?.removedCount ?? 0,
      manifestRemainingCount: audit.manifestInventory?.remainingCount ?? 0,
      removalVerificationCount: audit.removalEvidence?.verificationCount ?? 0,
      removalVerifiedCount: audit.removalEvidence?.verifiedCount ?? 0,
      finalScanReferenceCount: audit.finalImportScan?.referenceCount ?? 0,
    },
    riskCount: risks.length,
    risks,
    sideEffects: combinedSideEffects,
    executionPolicy: {
      requireCompletionAuthorization: true,
      requireReadyExecutionPlanManifest: true,
      requireRemovalVerificationEvidence: true,
      requireFinalReferenceScan: true,
      requireFocusedValidation: true,
      requireFullValidation: true,
      allowFileDeletion: false,
      allowArchive: false,
      allowStorageMutation: false,
      allowManifestWrite: false,
      allowGitCommandsInsideArtifact: false,
    },
    nextPhase: {
      phaseId: '8r_22',
      label: 'Phase 8R Completion Checkpoint',
      reason:
        'Complete compatibility removal audit evidence can feed the Phase 8R completion checkpoint; remaining inventory should continue the bounded removal loop.',
    },
  };

  return {
    ...artifact,
    validation:
      validatePolicyBuilderPhase8CompatibilityRemovalCompletionAuditArtifact(artifact),
  };
}

function validatePolicyBuilderPhase8CompatibilityRemovalCompletionAuditArtifact(
  artifact = {}
) {
  const issues = [];

  if (!Object.values(PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS)
    .includes(artifact.statusId)) {
    issues.push(buildRisk(
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
        .UNKNOWN_STATUS,
      'Compatibility removal completion audit artifact status must be known.'
    ));
  }

  if (artifact.riskCount !== asArray(artifact.risks).length) {
    issues.push(buildRisk(
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
        .RISK_COUNT_MISMATCH,
      'Compatibility removal completion audit artifact risk count must match risk list length.'
    ));
  }

  if (
    artifact.statusId ===
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS.COMPLETE &&
    artifact.complete !== true
  ) {
    issues.push(buildRisk(
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
        .COMPLETE_FLAG_MISMATCH,
      'Compatibility removal completion audit artifact complete flag must match complete status.'
    ));
  }

  Object.entries(artifact.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
          .SIDE_EFFECT_REPORTED,
        `Compatibility removal completion audit artifact cannot report side effect "${key}".`,
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
  PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS,
  PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS,
  PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_VERSION,
  buildPolicyBuilderPhase8CompatibilityRemovalCompletionAuditArtifact,
  validatePolicyBuilderPhase8CompatibilityRemovalCompletionAuditArtifact,
};
