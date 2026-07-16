import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
  buildPolicyCompatibilityRemovalCompletionAudit,
} from './policyCompatibilityRemovalCompletionAudit.mjs';
import {
  buildPolicyCompatibilityRemovalCompletionAuditArtifactFingerprint,
  validatePolicyCompatibilityRemovalCompletionAuditArtifactFingerprint,
} from './policyCompatibilityRemovalCompletionAuditArtifactFingerprint.mjs';
import {
  resolvePolicyStorageClosureExecutionPlanSource,
} from './policyStorageClosureExecutionPlanSource.mjs';

const POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_VERSION =
  'policy.compatibility_removal_completion_audit_artifact.v4';

const POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS =
  Object.freeze({
    COMPLETE: 'complete',
    REMAINING_INVENTORY: 'remaining_inventory',
    BLOCKED: 'blocked',
  });

const POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS =
  Object.freeze({
    AUDIT_BLOCKED: 'audit_blocked',
    AUDIT_VALIDATION_FAILED: 'audit_validation_failed',
    EXECUTION_PLAN_ARTIFACT_INVALID: 'execution_plan_artifact_invalid',
    EXECUTION_PLAN_ARTIFACT_FINGERPRINT_MISMATCH:
      'execution_plan_artifact_fingerprint_mismatch',
    EXECUTION_PLAN_ARTIFACT_CONTENT_MISMATCH:
      'execution_plan_artifact_content_mismatch',
    SIDE_EFFECT_REPORTED: 'side_effect_reported',
    ARTIFACT_FINGERPRINT_INVALID: 'artifact_fingerprint_invalid',
    UNKNOWN_VERSION: 'unknown_version',
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

function stableValue(value) {
  if (Array.isArray(value)) return value.map(item => stableValue(item));
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value)
    .sort()
    .reduce((normalized, key) => {
      normalized[key] = stableValue(value[key]);
      return normalized;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
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
    return POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
      .BLOCKED;
  }

  if (audit.statusId === POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE) {
    return POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS.COMPLETE;
  }

  return POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
    .REMAINING_INVENTORY;
}

function buildArtifactRisks({
  audit = {},
  executionPlanSource = {},
  sideEffects = {},
} = {}) {
  const risks = [];
  const acceptableStatusIds = [
    POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE,
    POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.REMAINING_INVENTORY,
  ];

  if (executionPlanSource.ok !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_INVALID,
      'Compatibility removal completion audit artifact requires a ready fingerprint-valid execution-plan artifact.',
      {
        issueCount: executionPlanSource.issueCount ?? null,
        issueRiskIds: asArray(executionPlanSource.issues).map(issue => issue.riskId),
      }
    ));
  }

  if (!acceptableStatusIds.includes(audit.statusId)) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
        .AUDIT_BLOCKED,
      'Compatibility removal completion audit artifact requires complete or remaining-inventory audit evidence.',
      {
        statusId: audit.statusId || null,
        auditRiskCount: audit.riskCount ?? null,
      }
    ));
  }

  if (audit.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
        .AUDIT_VALIDATION_FAILED,
      'Compatibility removal completion audit artifact requires valid completion audit evidence.',
      { issueCount: audit.validation?.issueCount ?? null }
    ));
  }

  Object.entries(sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
          .SIDE_EFFECT_REPORTED,
        `Compatibility removal completion audit artifact cannot report side effect "${key}".`,
        { sideEffect: key }
      ));
    }
  });

  return risks;
}

async function buildPolicyCompatibilityRemovalCompletionAuditArtifact({
  nextBatchAuthorizationArtifact = null,
  executionPlanArtifact = null,
  input = {},
  generatedAt = null,
  sideEffects = {},
} = {}) {
  const evidence = asObject(input);
  const executionPlanSource = resolvePolicyStorageClosureExecutionPlanSource({
    executionPlanArtifact,
  });
  const executionPlan = structuredClone(executionPlanSource.executionPlan || {});
  const auditInput = {
    ...evidence,
    executionPlanArtifactFingerprint: executionPlanSource.artifactFingerprint || '',
  };
  const audit = await buildPolicyCompatibilityRemovalCompletionAudit({
    nextBatchAuthorizationArtifact,
    executionPlan,
    expectedExecutionPlanArtifactFingerprint:
      auditInput.executionPlanArtifactFingerprint,
    reviewArtifactFingerprint: auditInput.reviewArtifactFingerprint,
    finalImportScan: asObject(auditInput.finalImportScan),
    validationEvidence: asObject(auditInput.validationEvidence),
    sideEffects,
  });
  const combinedSideEffects = summarizeSideEffects(audit, sideEffects);
  const risks = buildArtifactRisks({
    audit,
    executionPlanSource,
    sideEffects: combinedSideEffects,
  });
  const artifact = {
    version: POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_VERSION,
    generatedAt: normalizeGeneratedAt(generatedAt),
    statusId: determineArtifactStatusId(audit, risks),
    complete:
      risks.length === 0 &&
      audit.statusId === POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE &&
      audit.complete === true,
    remainingInventory:
      risks.length === 0 &&
      audit.statusId ===
        POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.REMAINING_INVENTORY,
    nextBatchAuthorizationArtifact,
    // Retain the verified wrapper for replay. The nested plan below is derived
    // only from this wrapper and is diagnostic, not an authorization input.
    executionPlanArtifact: asObject(executionPlanArtifact),
    executionPlan: asObject(executionPlan),
    auditInput: {
      reviewArtifactFingerprint: auditInput.reviewArtifactFingerprint || '',
      executionPlanArtifactFingerprint:
        auditInput.executionPlanArtifactFingerprint || '',
      finalImportScan: asObject(auditInput.finalImportScan),
      validationEvidence: asObject(auditInput.validationEvidence),
    },
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
      requireFingerprintValidNextBatchAuthorizationArtifact: true,
      requireFingerprintValidExecutionPlanArtifact: true,
      requireAuthorizationReviewArtifactContext: true,
      requireReadyExecutionPlanManifest: true,
      requireVerifiedRuntimeEvidenceArtifact: true,
      requireFinalReferenceScan: true,
      requireFocusedValidation: true,
      requireFullValidation: true,
      allowFileDeletion: false,
      allowArchive: false,
      allowStorageMutation: false,
      allowManifestWrite: false,
      allowGitCommandsInsideArtifact: false,
    },
    nextStep: {
      stepId: 'policy_storage_completion_checkpoint',
      label: 'Policy Storage Completion Checkpoint',
      reason:
        'Complete compatibility removal audit evidence can feed the storage completion checkpoint; remaining inventory should continue the bounded removal loop.',
    },
  };

  const artifactWithFingerprint = {
    ...artifact,
    artifactFingerprint:
      buildPolicyCompatibilityRemovalCompletionAuditArtifactFingerprint({ artifact }),
  };

  return {
    ...artifactWithFingerprint,
    validation: validatePolicyCompatibilityRemovalCompletionAuditArtifact(
      artifactWithFingerprint
    ),
  };
}

function validatePolicyCompatibilityRemovalCompletionAuditArtifact(
  artifact = {}
) {
  const issues = [];
  const executionPlanSource = resolvePolicyStorageClosureExecutionPlanSource({
    executionPlanArtifact: artifact.executionPlanArtifact,
  });

  if (artifact.version !== POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_VERSION) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS.UNKNOWN_VERSION,
      'Compatibility removal completion audit artifact version must be recognized.',
      { version: artifact.version || null }
    ));
  }

  if (!Object.values(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS)
    .includes(artifact.statusId)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
        .UNKNOWN_STATUS,
      'Compatibility removal completion audit artifact status must be known.'
    ));
  }

  if (artifact.riskCount !== asArray(artifact.risks).length) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
        .RISK_COUNT_MISMATCH,
      'Compatibility removal completion audit artifact risk count must match risk list length.'
    ));
  }

  if (
    artifact.statusId ===
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS.COMPLETE &&
    artifact.complete !== true
  ) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
        .COMPLETE_FLAG_MISMATCH,
      'Compatibility removal completion audit artifact complete flag must match complete status.'
    ));
  }

  if (executionPlanSource.ok !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_INVALID,
      'Compatibility removal completion audit artifact requires a ready fingerprint-valid execution-plan artifact.',
      { issueCount: executionPlanSource.issueCount }
    ));
  }

  if (
    artifact.auditInput?.executionPlanArtifactFingerprint !==
      (executionPlanSource.artifactFingerprint || '')
  ) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_FINGERPRINT_MISMATCH,
      'Completion-audit evidence must bind the exact execution-plan artifact fingerprint.',
      {
        expectedExecutionPlanArtifactFingerprint:
          executionPlanSource.artifactFingerprint || null,
        receivedExecutionPlanArtifactFingerprint:
          artifact.auditInput?.executionPlanArtifactFingerprint || null,
      }
    ));
  }

  if (
    executionPlanSource.ok === true &&
    stableStringify(artifact.executionPlan) !==
      stableStringify(executionPlanSource.executionPlan)
  ) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_CONTENT_MISMATCH,
      'Completion-audit diagnostic execution-plan data must match the verified execution-plan artifact.',
      {
        executionPlanArtifactFingerprint:
          executionPlanSource.artifactFingerprint || null,
      }
    ));
  }

  const fingerprintValidation =
    validatePolicyCompatibilityRemovalCompletionAuditArtifactFingerprint({
      artifact,
      artifactFingerprint: artifact.artifactFingerprint,
    });
  if (!fingerprintValidation.ok) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
        .ARTIFACT_FINGERPRINT_INVALID,
      'Compatibility removal completion audit artifact fingerprint must bind the artifact contents.',
      { issueCount: fingerprintValidation.issueCount }
    ));
  }

  Object.entries(artifact.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
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
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS,
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS,
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_VERSION,
  buildPolicyCompatibilityRemovalCompletionAuditArtifact,
  validatePolicyCompatibilityRemovalCompletionAuditArtifact,
};
