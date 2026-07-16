import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS,
  buildPolicyCompatibilityRemovalCompletionAuditArtifact,
} from './policyCompatibilityRemovalCompletionAuditArtifact.mjs';
import {
  buildFinalImportScan,
} from './policyStorageClosureFinalRemovalAudit.mjs';
import {
  buildManifestPathState,
} from './policyStorageClosureManifestPathState.mjs';
import {
  resolvePolicyStorageClosureExecutionPlanSource,
} from './policyStorageClosureExecutionPlanSource.mjs';

const POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_VERSION =
  'policy.compatibility_removal_evidence_regeneration.v2';

const POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS = Object.freeze({
  ARTIFACT_VALIDATION_FAILED: 'artifact_validation_failed',
  EXECUTION_PLAN_ARTIFACT_MISSING: 'execution_plan_artifact_missing',
  EXECUTION_PLAN_ARTIFACT_INVALID: 'execution_plan_artifact_invalid',
  NEXT_BATCH_AUTHORIZATION_ARTIFACT_MISSING:
    'next_batch_authorization_artifact_missing',
  REVIEW_ARTIFACT_FINGERPRINT_MISSING: 'review_artifact_fingerprint_missing',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
  SOURCE_SCAN_INCOMPLETE: 'source_scan_incomplete',
  UNKNOWN_STATUS: 'unknown_status',
  VALIDATION_EVIDENCE_MISSING: 'validation_evidence_missing',
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

function hasObjectValues(value) {
  return Object.keys(asObject(value)).length > 0;
}

function buildInputEvidence({
  executionPlanArtifact = null,
  nextBatchAuthorizationArtifact = null,
  reviewArtifactFingerprint = '',
  validationEvidence = null,
} = {}) {
  return {
    executionPlanArtifactProvided: hasObjectValues(executionPlanArtifact),
    nextBatchAuthorizationArtifactProvided:
      hasObjectValues(nextBatchAuthorizationArtifact),
    reviewArtifactFingerprintProvided:
      String(reviewArtifactFingerprint || '').trim().length > 0,
    validationEvidenceProvided: hasObjectValues(validationEvidence),
  };
}

function summarizeValidationCheck(value) {
  if (!hasObjectValues(value)) {
    return null;
  }

  return {
    passed: asObject(value).passed === true,
  };
}

function summarizeValidationEvidence(value) {
  const evidence = asObject(value);

  return {
    focused: summarizeValidationCheck(evidence.focused),
    full: summarizeValidationCheck(evidence.full),
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
  executionPlanSource = {},
  inputEvidence = {},
  referenceScan = {},
} = {}) {
  const risks = [
    ...asArray(completionAuditArtifact.audit?.risks),
    ...asArray(completionAuditArtifact.risks),
  ];

  if (inputEvidence.executionPlanArtifactProvided !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_MISSING,
      'Compatibility removal evidence regeneration requires a current execution-plan artifact before closure can be evaluated.'
    ));
  }

  if (inputEvidence.nextBatchAuthorizationArtifactProvided !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS
        .NEXT_BATCH_AUTHORIZATION_ARTIFACT_MISSING,
      'Compatibility removal evidence regeneration requires a current next-batch authorization artifact before closure can be evaluated.'
    ));
  }

  if (inputEvidence.reviewArtifactFingerprintProvided !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS
        .REVIEW_ARTIFACT_FINGERPRINT_MISSING,
      'Compatibility removal evidence regeneration requires the applied removal-review fingerprint before closure can be evaluated.'
    ));
  }

  if (inputEvidence.validationEvidenceProvided !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS
        .VALIDATION_EVIDENCE_MISSING,
      'Compatibility removal evidence regeneration requires current validation evidence before closure can be evaluated.'
    ));
  }

  if (executionPlanSource.ok !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_INVALID,
      'Compatibility removal evidence regeneration requires a ready fingerprint-valid execution-plan artifact.',
      {
        issueCount: executionPlanSource.issueCount ?? null,
        issueRiskIds: asArray(executionPlanSource.issues).map(issue => issue.riskId),
      }
    ));
  }

  if (
    executionPlanSource.ok === true &&
    referenceScan.completed !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS
        .SOURCE_SCAN_INCOMPLETE,
      'Compatibility removal evidence regeneration requires a completed current-source reference scan.'
    ));
  }

  return risks;
}

function summarizeExecutionPlan(executionPlan = {}, artifactFingerprint = '') {
  return {
    version: executionPlan.version || null,
    statusId: executionPlan.statusId || null,
    readyForExecutionGate: executionPlan.readyForExecutionGate === true,
    validationOk: executionPlan.validation?.ok === true,
    manifestEntryCount: asArray(executionPlan.manifest?.entries).length,
    artifactFingerprint: artifactFingerprint || null,
  };
}

function getExecutionPlanManifestPaths(executionPlan = {}) {
  return asArray(executionPlan.manifest?.entries)
    .map(entry => String(entry?.path || '').replace(/\\/g, '/').trim())
    .filter(Boolean);
}

async function buildPolicyCompatibilityRemovalEvidenceRegeneration({
  executionPlanArtifact = null,
  nextBatchAuthorizationArtifact = null,
  reviewArtifactFingerprint = '',
  validationEvidence = {},
  referenceScan = {},
  fileExists = () => false,
  generatedAt = null,
} = {}) {
  const inputEvidence = buildInputEvidence({
    executionPlanArtifact,
    nextBatchAuthorizationArtifact,
    reviewArtifactFingerprint,
    validationEvidence,
  });
  const boundedValidationEvidence = summarizeValidationEvidence(validationEvidence);
  const executionPlanSource = resolvePolicyStorageClosureExecutionPlanSource({
    executionPlanArtifact,
  });
  const plan = asObject(executionPlanSource.executionPlan);
  const pathState = buildManifestPathState({
    manifestPaths: getExecutionPlanManifestPaths(plan),
    fileExists,
  });
  const finalImportScan = buildCurrentFinalImportScan({
    manifestPaths: pathState.manifestPaths,
    referenceScan,
  });
  const completionAuditArtifact =
    await buildPolicyCompatibilityRemovalCompletionAuditArtifact({
      nextBatchAuthorizationArtifact,
      executionPlanArtifact,
      input: {
        reviewArtifactFingerprint,
        finalImportScan,
        validationEvidence: boundedValidationEvidence,
      },
      generatedAt,
    });
  const risks = buildEvidenceRisks({
    completionAuditArtifact,
    executionPlanSource,
    inputEvidence,
    referenceScan: asObject(referenceScan),
  });
  const statusId = completionAuditArtifact.statusId;
  const complete = completionAuditArtifact.complete === true && risks.length === 0;
  const evidence = {
    version: POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_VERSION,
    generatedAt: generatedAt || new Date().toISOString(),
    statusId,
    complete,
    inputEvidence,
    executionPlan: summarizeExecutionPlan(
      plan,
      executionPlanSource.artifactFingerprint
    ),
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
    nextStep: complete === true
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
