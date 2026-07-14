import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS,
  buildPolicyCompatibilityRemovalCompletionAuditArtifact,
} from './policyCompatibilityRemovalCompletionAuditArtifact.mjs';
import {
  buildCompletionAuthorization,
  buildFinalImportScan,
  buildManifestPathState,
  buildRemovalVerifications,
} from './policyStorageClosureFinalRemovalAudit.mjs';

const POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_VERSION =
  'policy.compatibility_removal_evidence_regeneration.v1';

const POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS = Object.freeze({
  ARTIFACT_VALIDATION_FAILED: 'artifact_validation_failed',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
  SOURCE_SCAN_INCOMPLETE: 'source_scan_incomplete',
  UNKNOWN_STATUS: 'unknown_status',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

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

function buildCurrentFinalImportScan({
  manifestPaths = [],
  referenceScan = {},
} = {}) {
  const scan = asObject(referenceScan);
  const finalImportScan = buildFinalImportScan({
    manifestPaths,
    referenceScan: scan,
  });

  return {
    ...finalImportScan,
    completed: scan.completed === true,
  };
}

function buildEvidenceRisks({
  completionAuditArtifact = {},
  referenceScan = {},
} = {}) {
  const risks = [
    ...asArray(completionAuditArtifact.audit?.risks),
    ...asArray(completionAuditArtifact.risks),
  ];

  if (referenceScan.completed !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS
        .SOURCE_SCAN_INCOMPLETE,
      'Compatibility removal evidence regeneration requires a completed current-source reference scan.'
    ));
  }

  return risks;
}

function summarizeExecutionPlan(executionPlan = {}) {
  return {
    version: executionPlan.version || null,
    statusId: executionPlan.statusId || null,
    readyForExecutionGate: executionPlan.readyForExecutionGate === true,
    validationOk: executionPlan.validation?.ok === true,
    manifestEntryCount: asArray(executionPlan.manifest?.entries).length,
  };
}

function buildPolicyCompatibilityRemovalEvidenceRegeneration({
  executionPlan = {},
  validationEvidence = {},
  referenceScan = {},
  fileExists = () => false,
  generatedAt = null,
} = {}) {
  const plan = asObject(executionPlan);
  const pathState = buildManifestPathState({
    executionPlan: plan,
    fileExists,
  });
  const finalImportScan = buildCurrentFinalImportScan({
    manifestPaths: pathState.manifestPaths,
    referenceScan,
  });
  const completionAuthorization = buildCompletionAuthorization(pathState);
  const completionAuditArtifact =
    buildPolicyCompatibilityRemovalCompletionAuditArtifact({
      completionAuthorization,
      executionPlan: plan,
      input: {
        removalVerifications: buildRemovalVerifications(pathState),
        finalImportScan,
        validationEvidence: asObject(validationEvidence),
      },
      generatedAt,
    });
  const risks = buildEvidenceRisks({
    completionAuditArtifact,
    referenceScan: asObject(referenceScan),
  });
  const statusId = completionAuditArtifact.statusId;
  const evidence = {
    version: POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_VERSION,
    generatedAt: generatedAt || new Date().toISOString(),
    statusId,
    complete: completionAuditArtifact.complete === true && risks.length === 0,
    executionPlan: summarizeExecutionPlan(plan),
    pathState,
    finalImportScan,
    completionAuditArtifact,
    riskCount: risks.length,
    risks,
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      routesRemoved: false,
      testsRemoved: false,
      storageChanged: false,
      manifestWritten: false,
      gitCommandsRun: false,
    },
    nextStep: completionAuditArtifact.complete === true
      ? {
        stepId: 'policy_storage_current_closure_audit',
        label: 'Policy Storage Current Closure Audit',
        reason:
          'Current compatibility-removal evidence is complete and can now be consumed by the storage closure gate.',
      }
      : {
        stepId: 'policy_compatibility_deletion_readiness',
        label: 'Policy Compatibility Deletion Readiness',
        reason:
          'Compatibility-removal evidence remains incomplete; resolve current readiness, manifest, or reference-scan blockers before attempting closure.',
      },
  };

  return {
    ...evidence,
    validation: validatePolicyCompatibilityRemovalEvidenceRegeneration(evidence),
  };
}

function validatePolicyCompatibilityRemovalEvidenceRegeneration(evidence = {}) {
  const issues = [];

  if (!Object.values(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS)
    .includes(evidence.statusId)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS.UNKNOWN_STATUS,
      'Compatibility removal evidence regeneration status must be known.'
    ));
  }

  if (evidence.riskCount !== asArray(evidence.risks).length) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS
        .RISK_COUNT_MISMATCH,
      'Compatibility removal evidence regeneration risk count must match risk list length.'
    ));
  }

  if (evidence.completionAuditArtifact?.validation?.ok !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS
        .ARTIFACT_VALIDATION_FAILED,
      'Compatibility removal evidence regeneration requires a valid completion-audit artifact.'
    ));
  }

  Object.entries(evidence.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS
          .SIDE_EFFECT_REPORTED,
        `Compatibility removal evidence regeneration cannot perform side effect "${key}".`,
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
  POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS,
  POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_VERSION,
  buildPolicyCompatibilityRemovalEvidenceRegeneration,
  validatePolicyCompatibilityRemovalEvidenceRegeneration,
};
