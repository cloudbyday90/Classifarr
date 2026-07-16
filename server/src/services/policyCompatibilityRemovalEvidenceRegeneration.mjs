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
  DIAGNOSTIC_SHAPE_INVALID: 'diagnostic_shape_invalid',
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

const POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_DIAGNOSTIC_CATEGORY_IDS =
  Object.freeze({
    MISSING_REQUIRED_EVIDENCE: 'missing_required_evidence',
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

function buildMissingInputEvidenceRisks(inputEvidence = {}) {
  const risks = [];

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

  return risks;
}

function hasMissingRequiredEvidence(inputEvidence = {}) {
  return buildMissingInputEvidenceRisks(inputEvidence).length > 0;
}

function buildEmptyPathState() {
  return {
    totalCount: 0,
    existingCount: 0,
    removedCount: 0,
    manifestPaths: [],
    existingPaths: [],
    removedPaths: [],
  };
}

function buildMissingRequiredEvidenceDiagnostic({
  inputEvidence = {},
  generatedAt = null,
} = {}) {
  const risks = buildMissingInputEvidenceRisks(inputEvidence);
  const evidence = {
    version: POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_VERSION,
    generatedAt: generatedAt || new Date().toISOString(),
    statusId: POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS.BLOCKED,
    complete: false,
    diagnostic: {
      categoryId:
        POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_DIAGNOSTIC_CATEGORY_IDS
          .MISSING_REQUIRED_EVIDENCE,
      authoritative: false,
      completionAuditArtifactGenerated: false,
    },
    inputEvidence,
    executionPlan: summarizeExecutionPlan(),
    pathState: buildEmptyPathState(),
    finalImportScan: {
      completed: false,
      checkedPaths: [],
      references: [],
    },
    completionAuditArtifact: null,
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
    nextStep: {
      stepId: 'policy_compatibility_deletion_readiness',
      label: 'Policy Compatibility Deletion Readiness',
      reason:
        'Compatibility-removal evidence needs the missing approval-chain inputs before closure can be evaluated.',
    },
  };

  return {
    ...evidence,
    validation: validatePolicyCompatibilityRemovalEvidenceRegeneration(evidence),
  };
}

function buildEvidenceRisks({
  completionAuditArtifact = {},
  executionPlanSource = {},
  referenceScan = {},
} = {}) {
  const risks = [
    ...asArray(completionAuditArtifact.audit?.risks),
    ...asArray(completionAuditArtifact.risks),
  ];

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

  if (hasMissingRequiredEvidence(inputEvidence)) {
    return buildMissingRequiredEvidenceDiagnostic({
      inputEvidence,
      generatedAt,
    });
  }

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
  const diagnostic = asObject(evidence.diagnostic);

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

  const isMissingRequiredEvidenceDiagnostic =
    diagnostic.categoryId ===
    POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_DIAGNOSTIC_CATEGORY_IDS
      .MISSING_REQUIRED_EVIDENCE;

  if (isMissingRequiredEvidenceDiagnostic) {
    const expectedRiskIds = buildMissingInputEvidenceRisks(evidence.inputEvidence)
      .map(risk => risk.riskId)
      .sort();
    const receivedRiskIds = asArray(evidence.risks)
      .map(risk => risk?.riskId)
      .sort();

    if (
      evidence.statusId !==
        POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS.BLOCKED ||
      evidence.complete !== false ||
      diagnostic.authoritative !== false ||
      diagnostic.completionAuditArtifactGenerated !== false ||
      evidence.completionAuditArtifact !== null ||
      expectedRiskIds.length === 0 ||
      JSON.stringify(receivedRiskIds) !== JSON.stringify(expectedRiskIds)
    ) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS
          .DIAGNOSTIC_SHAPE_INVALID,
        'Missing-evidence diagnostics must remain bounded, non-authoritative, and free of completion-audit output.'
      ));
    }
  } else if (evidence.completionAuditArtifact?.validation?.ok !== true) {
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
  POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_DIAGNOSTIC_CATEGORY_IDS,
  POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS,
  POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_VERSION,
  buildPolicyCompatibilityRemovalEvidenceRegeneration,
  validatePolicyCompatibilityRemovalEvidenceRegeneration,
};
