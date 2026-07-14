import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION,
  validatePolicyCompatibilityDeletionExecutionPlanArtifact,
} from './policyCompatibilityDeletionExecutionPlanArtifact.mjs';
import {
  validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint,
} from './policyCompatibilityDeletionExecutionPlanArtifactFingerprint.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS,
} from './policyCompatibilityDeletionExecutionGate.mjs';
import {
  buildPolicyControlledCompatibilityPathRemovalReviewArtifact,
  validatePolicyControlledCompatibilityPathRemovalReviewArtifact,
} from './policyControlledCompatibilityPathRemovalReviewArtifact.mjs';

const POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_VERSION =
  'policy.controlled_compatibility_path_removal.v2';

const POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS = Object.freeze({
  READY_FOR_REMOVAL_REVIEW: 'ready_for_removal_review',
  BLOCKED_BY_EXECUTION_ARTIFACT: 'blocked_by_execution_artifact',
  BLOCKED_BY_EXECUTION_GATE: 'blocked_by_execution_gate',
  BLOCKED_BY_SELECTION: 'blocked_by_selection',
  BLOCKED_BY_SCOPE: 'blocked_by_scope',
  BLOCKED_BY_APPROVAL: 'blocked_by_approval',
});

const POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS = Object.freeze({
  EXECUTION_PLAN_ARTIFACT_NOT_READY: 'execution_plan_artifact_not_ready',
  EXECUTION_PLAN_ARTIFACT_VALIDATION_FAILED: 'execution_plan_artifact_validation_failed',
  EXECUTION_PLAN_ARTIFACT_FINGERPRINT_INVALID:
    'execution_plan_artifact_fingerprint_invalid',
  EXECUTION_GATE_NOT_READY: 'execution_gate_not_ready',
  EXECUTION_GATE_VALIDATION_FAILED: 'execution_gate_validation_failed',
  EXECUTION_GATE_ARTIFACT_MISSING: 'execution_gate_artifact_missing',
  EXECUTION_GATE_ARTIFACT_INVALID: 'execution_gate_artifact_invalid',
  EXECUTION_GATE_ARTIFACT_MISMATCH: 'execution_gate_artifact_mismatch',
  REVIEW_ARTIFACT_INVALID: 'review_artifact_invalid',
  NO_PATHS_SELECTED: 'no_paths_selected',
  SELECTED_PATH_NOT_IN_MANIFEST: 'selected_path_not_in_manifest',
  SELECTED_ENTRY_NOT_READY: 'selected_entry_not_ready',
  REMOVAL_SCOPE_TOO_BROAD: 'removal_scope_too_broad',
  MISSING_REVIEW_REASON: 'missing_review_reason',
  MISSING_REVIEWER: 'missing_reviewer',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').trim();
}

function normalizeFingerprint(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function uniqueNormalizedPaths(paths = []) {
  return [...new Set(asArray(paths).map(normalizePath).filter(Boolean))];
}

function evaluateExecutionPlanArtifact(executionPlanArtifact) {
  const artifact = asObject(executionPlanArtifact);
  const risks = [];
  const artifactValidation = validatePolicyCompatibilityDeletionExecutionPlanArtifact(artifact);
  const fingerprintValidation =
    validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({
      artifact,
      artifactFingerprint: artifact.artifactFingerprint,
    });

  if (
    artifact.version !== POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION ||
    artifact.statusId !== POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS.READY ||
    artifact.ready !== true
  ) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_NOT_READY,
      'Controlled compatibility path removal requires a ready versioned execution-plan artifact.',
      {
        version: artifact.version || null,
        statusId: artifact.statusId || null,
      }
    ));
  }

  if (artifact.validation?.ok !== true || artifactValidation.ok !== true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_VALIDATION_FAILED,
      'Controlled compatibility path removal requires valid execution-plan artifact evidence.',
      { issueCount: artifactValidation.issueCount }
    ));
  }

  if (!fingerprintValidation.ok) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_FINGERPRINT_INVALID,
      'Controlled compatibility path removal requires an intact execution-plan artifact fingerprint.',
      { issueCount: fingerprintValidation.issueCount }
    ));
  }

  return {
    artifact,
    risks,
  };
}

function evaluateExecutionGate({ executionGate, executionPlanArtifact }) {
  const gate = asObject(executionGate);
  const gateArtifact = asObject(gate.executionPlanArtifact);
  const risks = [];
  const gateArtifactValidation =
    validatePolicyCompatibilityDeletionExecutionPlanArtifact(gateArtifact);
  const gateArtifactFingerprintValidation =
    validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({
      artifact: gateArtifact,
      artifactFingerprint: gateArtifact.artifactFingerprint,
    });
  const expectedFingerprint = normalizeFingerprint(
    executionPlanArtifact.artifactFingerprint?.fingerprint
  );
  const gateFingerprint = normalizeFingerprint(
    gateArtifact.artifactFingerprint?.fingerprint
  );

  if (
    gate.statusId !==
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS.READY_FOR_CONTROLLED_DELETION ||
    gate.allowControlledDeletion !== true
  ) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_GATE_NOT_READY,
      'Controlled compatibility path removal requires a ready compatibility deletion execution gate.',
      { statusId: gate.statusId || null }
    ));
  }

  if (gate.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_GATE_VALIDATION_FAILED,
      'Controlled compatibility path removal requires a valid execution gate.',
      { issueCount: gate.validation?.issueCount ?? null }
    ));
  }

  if (Object.keys(gateArtifact).length === 0) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_GATE_ARTIFACT_MISSING,
      'Controlled compatibility path removal requires the execution gate to carry its execution-plan artifact.'
    ));
  } else if (
    gateArtifactValidation.ok !== true ||
    gateArtifactFingerprintValidation.ok !== true
  ) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_GATE_ARTIFACT_INVALID,
      'Controlled compatibility path removal requires valid execution-plan artifact evidence embedded in the execution gate.',
      {
        issueCount:
          gateArtifactValidation.issueCount + gateArtifactFingerprintValidation.issueCount,
      }
    ));
  }

  if (expectedFingerprint && gateFingerprint && expectedFingerprint !== gateFingerprint) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_GATE_ARTIFACT_MISMATCH,
      'Controlled compatibility path removal requires the execution gate to be bound to the same execution-plan artifact used for manifest selection.',
      {
        executionPlanArtifactFingerprint: expectedFingerprint,
        executionGateArtifactFingerprint: gateFingerprint,
      }
    ));
  }

  return {
    gate,
    gateArtifact,
    risks,
  };
}

function buildSelectedEntries({
  manifestEntries = [],
  selectedPaths = [],
}) {
  const entryByPath = new Map(
    manifestEntries.map(entry => [normalizePath(entry.path), entry])
  );
  const normalizedPaths = uniqueNormalizedPaths(selectedPaths);

  return {
    normalizedPaths,
    entries: normalizedPaths
      .map(path => entryByPath.get(path))
      .filter(Boolean),
    missingPaths: normalizedPaths.filter(path => !entryByPath.has(path)),
  };
}

function evaluateSelection({
  selectedEntries = [],
  selectedPaths = [],
  missingPaths = [],
  maxBatchSize,
}) {
  const risks = [];

  if (selectedPaths.length === 0) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.NO_PATHS_SELECTED,
      'Controlled compatibility path removal requires at least one selected manifest path.'
    ));
  }

  missingPaths.forEach(path => {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.SELECTED_PATH_NOT_IN_MANIFEST,
      'Controlled compatibility path removal can only target paths from the approved manifest.',
      { path }
    ));
  });

  selectedEntries.forEach(entry => {
    if (entry.ready !== true) {
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.SELECTED_ENTRY_NOT_READY,
        'Selected compatibility path removal entries must include replacement evidence.',
        {
          path: entry.path,
          categoryId: entry.categoryId,
        }
      ));
    }
  });

  if (selectedPaths.length > maxBatchSize) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.REMOVAL_SCOPE_TOO_BROAD,
      'Controlled compatibility path removal requires a narrow, reviewable batch.',
      {
        selectedCount: selectedPaths.length,
        maxBatchSize,
      }
    ));
  }

  return risks;
}

function evaluateReviewMetadata({
  removalReason,
  reviewedBy,
}) {
  const risks = [];

  if (!String(removalReason || '').trim()) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.MISSING_REVIEW_REASON,
      'Controlled compatibility path removal requires a review reason.'
    ));
  }

  if (!String(reviewedBy || '').trim()) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.MISSING_REVIEWER,
      'Controlled compatibility path removal requires a reviewing actor.'
    ));
  }

  return risks;
}

function determineStatusId(risks = []) {
  if (risks.some(risk => [
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_PLAN_ARTIFACT_NOT_READY,
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS
      .EXECUTION_PLAN_ARTIFACT_VALIDATION_FAILED,
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS
      .EXECUTION_PLAN_ARTIFACT_FINGERPRINT_INVALID,
  ].includes(risk.riskId))) {
    return POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
      .BLOCKED_BY_EXECUTION_ARTIFACT;
  }

  if (risks.some(risk => [
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_GATE_NOT_READY,
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_GATE_VALIDATION_FAILED,
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_GATE_ARTIFACT_MISSING,
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_GATE_ARTIFACT_INVALID,
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_GATE_ARTIFACT_MISMATCH,
  ].includes(risk.riskId))) {
    return POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
      .BLOCKED_BY_EXECUTION_GATE;
  }

  if (risks.some(risk => [
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.NO_PATHS_SELECTED,
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.SELECTED_PATH_NOT_IN_MANIFEST,
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.SELECTED_ENTRY_NOT_READY,
  ].includes(risk.riskId))) {
    return POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.BLOCKED_BY_SELECTION;
  }

  if (risks.some(risk =>
    risk.riskId ===
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.REMOVAL_SCOPE_TOO_BROAD
  )) {
    return POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.BLOCKED_BY_SCOPE;
  }

  if (risks.some(risk => [
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.MISSING_REVIEW_REASON,
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.MISSING_REVIEWER,
  ].includes(risk.riskId))) {
    return POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.BLOCKED_BY_APPROVAL;
  }

  return POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.READY_FOR_REMOVAL_REVIEW;
}

function buildRemovalBatchEntries(entries = []) {
  return entries.map(entry => ({
    categoryId: entry.categoryId,
    actionId: entry.actionId,
    path: entry.path,
    deletionIntent: entry.deletionIntent,
    replacementEvidence: entry.replacementEvidence,
  }));
}

function buildPolicyControlledCompatibilityPathRemoval({
  executionPlanArtifact = null,
  executionGate = null,
  selectedPaths = [],
  maxBatchSize = 3,
  removalReason = null,
  reviewedBy = null,
} = {}) {
  const artifactEvaluation = evaluateExecutionPlanArtifact(executionPlanArtifact);
  const gateEvaluation = evaluateExecutionGate({
    executionGate,
    executionPlanArtifact: artifactEvaluation.artifact,
  });
  const selected = buildSelectedEntries({
    manifestEntries: artifactEvaluation.artifact.executionPlan?.manifest?.entries,
    selectedPaths,
  });
  const boundedMaxBatchSize = Number.isFinite(Number(maxBatchSize))
    ? Math.max(1, Number(maxBatchSize))
    : 3;
  const risks = [
    ...artifactEvaluation.risks,
    ...gateEvaluation.risks,
    ...evaluateSelection({
      selectedEntries: selected.entries,
      selectedPaths: selected.normalizedPaths,
      missingPaths: selected.missingPaths,
      maxBatchSize: boundedMaxBatchSize,
    }),
    ...evaluateReviewMetadata({
      removalReason,
      reviewedBy,
    }),
  ];
  const removal = {
    version: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_VERSION,
    statusId: determineStatusId(risks),
    readyForRemovalReview: risks.length === 0,
    executionPlanArtifact: {
      version: artifactEvaluation.artifact.version || null,
      statusId: artifactEvaluation.artifact.statusId || null,
      validationOk: artifactEvaluation.artifact.validation?.ok === true,
      ready: artifactEvaluation.artifact.ready === true,
      artifactFingerprint:
        artifactEvaluation.artifact.artifactFingerprint?.fingerprint || null,
      manifestEntryCount:
        artifactEvaluation.artifact.executionPlan?.manifest?.entryCount ?? null,
    },
    executionGate: {
      statusId: gateEvaluation.gate.statusId || null,
      validationOk: gateEvaluation.gate.validation?.ok === true,
      allowControlledDeletion: gateEvaluation.gate.allowControlledDeletion === true,
      executionPlanArtifactFingerprint:
        gateEvaluation.gateArtifact.artifactFingerprint?.fingerprint || null,
    },
    executionContext: {
      executionPlanArtifact: artifactEvaluation.artifact,
      executionGate: gateEvaluation.gate,
    },
    removalBatch: {
      selectedCount: selected.entries.length,
      requestedPathCount: selected.normalizedPaths.length,
      maxBatchSize: boundedMaxBatchSize,
      removalReason: removalReason || null,
      reviewedBy: reviewedBy || null,
      missingPaths: selected.missingPaths,
      entries: buildRemovalBatchEntries(selected.entries),
    },
    riskCount: risks.length,
    risks,
    executionPolicy: {
      executeDeletionNow: false,
      requireManualApplyStep: true,
      requireFreshGateForApply: true,
      requireSmallBatch: true,
      requireApprovedManifestPath: true,
      requireGateArtifactCohesion: true,
    },
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
      stepId: 'controlled_compatibility_path_removal_apply',
      label: 'Controlled Compatibility Path Removal Apply',
      reason:
        'The selected removal batch can be reviewed separately before any file, route, test, or storage removal is applied.',
    },
  };
  const removalWithReviewArtifact = {
    ...removal,
    reviewArtifact: buildPolicyControlledCompatibilityPathRemovalReviewArtifact({
      removalReview: removal,
    }),
  };

  return {
    ...removalWithReviewArtifact,
    validation: validatePolicyControlledCompatibilityPathRemoval(removalWithReviewArtifact),
  };
}

function validatePolicyControlledCompatibilityPathRemoval(removal = {}) {
  const issues = [];

  if (!Object.values(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS)
    .includes(removal.statusId)) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.UNKNOWN_STATUS,
      'Controlled compatibility path removal status must be known.'
    ));
  }

  if (removal.riskCount !== asArray(removal.risks).length) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.RISK_COUNT_MISMATCH,
      'Controlled compatibility path removal risk count must match risk list length.'
    ));
  }

  Object.entries(removal.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Controlled compatibility path removal cannot perform side effect "${key}".`
      ));
    }
  });

  const reviewArtifactValidation =
    validatePolicyControlledCompatibilityPathRemovalReviewArtifact({
      removalReview: removal,
      reviewArtifact: removal.reviewArtifact,
    });
  if (!reviewArtifactValidation.ok) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.REVIEW_ARTIFACT_INVALID,
      'Controlled compatibility path removal review artifact must bind its execution context and batch.',
      { issueCount: reviewArtifactValidation.issueCount }
    ));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_VERSION,
  buildPolicyControlledCompatibilityPathRemoval,
  validatePolicyControlledCompatibilityPathRemoval,
};
