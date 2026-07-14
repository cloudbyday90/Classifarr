import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from './policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS,
  buildPolicyCompatibilityDeletionExecutionGate,
} from './policyCompatibilityDeletionExecutionGate.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS,
  buildPolicyControlledCompatibilityPathRemoval,
} from './policyControlledCompatibilityPathRemoval.mjs';
import {
  validatePolicyControlledCompatibilityPathRemovalReviewArtifact,
} from './policyControlledCompatibilityPathRemovalReviewArtifact.mjs';

const POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_VERSION =
  'policy.controlled_compatibility_path_removal_apply.v2';

const POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS = Object.freeze({
  APPLIED: 'applied',
  BLOCKED_BY_REMOVAL_BATCH: 'blocked_by_removal_batch',
  BLOCKED_BY_REVIEW_INTEGRITY: 'blocked_by_review_integrity',
  BLOCKED_BY_CONFIRMATION: 'blocked_by_confirmation',
  BLOCKED_BY_ADAPTER: 'blocked_by_adapter',
  BLOCKED_BY_APPLY_RESULT: 'blocked_by_apply_result',
});

const POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS = Object.freeze({
  REMOVAL_BATCH_NOT_READY: 'removal_batch_not_ready',
  REMOVAL_BATCH_VALIDATION_FAILED: 'removal_batch_validation_failed',
  REVIEW_ARTIFACT_INVALID: 'review_artifact_invalid',
  REVIEW_EXECUTION_CONTEXT_MISSING: 'review_execution_context_missing',
  REVIEW_EXECUTION_GATE_REVALIDATION_FAILED:
    'review_execution_gate_revalidation_failed',
  REVIEW_CONTEXT_REPLAY_BLOCKED: 'review_context_replay_blocked',
  REVIEW_CONTEXT_REPLAY_MISMATCH: 'review_context_replay_mismatch',
  APPLY_NOT_ENABLED: 'apply_not_enabled',
  OPERATOR_CONFIRMATION_MISSING: 'operator_confirmation_missing',
  OPERATOR_CONFIRMATION_ACTOR_MISSING: 'operator_confirmation_actor_missing',
  APPLY_ADAPTER_MISSING: 'apply_adapter_missing',
  APPLY_ADAPTER_FAILED: 'apply_adapter_failed',
  APPLY_RESULT_COUNT_MISMATCH: 'apply_result_count_mismatch',
  APPLY_RESULT_NOT_APPLIED: 'apply_result_not_applied',
  APPLY_RESULT_PATH_MISMATCH: 'apply_result_path_mismatch',
  APPLY_RESULT_ACTION_MISMATCH: 'apply_result_action_mismatch',
  UNEXPECTED_SIDE_EFFECT: 'unexpected_side_effect',
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

function selectedPathsFromReview(review = {}) {
  return asArray(review.removalBatch?.entries)
    .map(entry => normalizePath(entry?.path))
    .filter(Boolean);
}

function evaluateReviewExecutionContext(review = {}) {
  const value = asObject(review);
  const executionContext = asObject(value.executionContext);
  const executionPlanArtifact = asObject(executionContext.executionPlanArtifact);
  const executionGate = asObject(executionContext.executionGate);
  const risks = [];
  const reviewArtifactValidation =
    validatePolicyControlledCompatibilityPathRemovalReviewArtifact({
      removalReview: value,
      reviewArtifact: value.reviewArtifact,
    });

  if (!reviewArtifactValidation.ok) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.REVIEW_ARTIFACT_INVALID,
      'Controlled compatibility path removal apply requires an intact review artifact.',
      { issueCount: reviewArtifactValidation.issueCount }
    ));
  }

  if (
    Object.keys(executionPlanArtifact).length === 0 ||
    Object.keys(executionGate).length === 0
  ) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .REVIEW_EXECUTION_CONTEXT_MISSING,
      'Controlled compatibility path removal apply requires the reviewed execution-plan artifact and execution gate.'
    ));

    return {
      executionPlanArtifact,
      executionGate,
      risks,
    };
  }

  const revalidatedGate = buildPolicyCompatibilityDeletionExecutionGate({
    executionPlanArtifact,
    preflightEvidence: executionGate.preflightEvidence,
    generatedAt: executionGate.generatedAt,
    now: executionGate.generatedAt,
  });

  if (
    revalidatedGate.statusId !==
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .READY_FOR_CONTROLLED_DELETION ||
    revalidatedGate.allowControlledDeletion !== true ||
    revalidatedGate.validation?.ok !== true
  ) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .REVIEW_EXECUTION_GATE_REVALIDATION_FAILED,
      'Controlled compatibility path removal apply requires preflight evidence that still rebuilds a ready execution gate.',
      { statusId: revalidatedGate.statusId || null }
    ));
  }

  const replay = buildPolicyControlledCompatibilityPathRemoval({
    executionPlanArtifact,
    executionGate,
    selectedPaths: selectedPathsFromReview(value),
    maxBatchSize: value.removalBatch?.maxBatchSize,
    removalReason: value.removalBatch?.removalReason,
    reviewedBy: value.removalBatch?.reviewedBy,
  });

  if (
    replay.statusId !==
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.READY_FOR_REMOVAL_REVIEW ||
    replay.readyForRemovalReview !== true ||
    replay.validation?.ok !== true
  ) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .REVIEW_CONTEXT_REPLAY_BLOCKED,
      'Controlled compatibility path removal apply requires execution context that still replays to a ready removal review.',
      { statusId: replay.statusId || null }
    ));
  } else if (
    normalizeFingerprint(replay.reviewArtifact?.fingerprint) !==
    normalizeFingerprint(value.reviewArtifact?.fingerprint)
  ) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .REVIEW_CONTEXT_REPLAY_MISMATCH,
      'Controlled compatibility path removal apply requires the replayed review artifact to match the approved review.',
      {
        expectedFingerprint: value.reviewArtifact?.fingerprint || null,
        actualFingerprint: replay.reviewArtifact?.fingerprint || null,
      }
    ));
  }

  return {
    executionPlanArtifact,
    executionGate,
    risks,
  };
}

function evaluateRemovalReview(removalReview) {
  const review = removalReview || buildPolicyControlledCompatibilityPathRemoval();
  const risks = [];

  if (
    review.statusId !==
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.READY_FOR_REMOVAL_REVIEW ||
    review.readyForRemovalReview !== true
  ) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.REMOVAL_BATCH_NOT_READY,
      'Controlled compatibility path removal apply requires a ready controlled removal batch.',
      { statusId: review.statusId || null }
    ));
  }

  if (review.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .REMOVAL_BATCH_VALIDATION_FAILED,
      'Controlled compatibility path removal apply requires a valid controlled removal batch.',
      { issueCount: review.validation?.issueCount ?? null }
    ));
  }

  const executionContext = risks.length === 0
    ? evaluateReviewExecutionContext(review)
    : {
      executionPlanArtifact: {},
      executionGate: {},
      risks: [],
    };
  risks.push(...executionContext.risks);

  return {
    review,
    executionContext,
    risks,
  };
}

function evaluateConfirmation({
  executeApply,
  operatorConfirmation = {},
}) {
  const risks = [];

  if (executeApply !== true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_NOT_ENABLED,
      'Controlled compatibility path removal apply requires executeApply=true.'
    ));
  }

  if (operatorConfirmation?.confirmed !== true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .OPERATOR_CONFIRMATION_MISSING,
      'Controlled compatibility path removal apply requires explicit operator confirmation.'
    ));
  }

  if (!String(operatorConfirmation?.confirmedBy || '').trim()) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .OPERATOR_CONFIRMATION_ACTOR_MISSING,
      'Controlled compatibility path removal apply confirmation must include an actor.'
    ));
  }

  return risks;
}

function evaluateAdapter(applyAdapter) {
  if (typeof applyAdapter?.applyEntry === 'function') {
    return [];
  }

  return [
    buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_ADAPTER_MISSING,
      'Controlled compatibility path removal apply requires an adapter with applyEntry(entry).'
    ),
  ];
}

function buildApplyResult({
  entry,
  result = {},
}) {
  return {
    path: normalizePath(result.path || entry.path),
    actionId: result.actionId || entry.actionId,
    categoryId: result.categoryId || entry.categoryId,
    applied: result.applied === true,
    operationId: result.operationId || null,
    sideEffects: {
      filesDeleted: result.sideEffects?.filesDeleted === true,
      filesArchived: result.sideEffects?.filesArchived === true,
      routesRemoved: result.sideEffects?.routesRemoved === true,
      testsRemoved: result.sideEffects?.testsRemoved === true,
      storageChanged: result.sideEffects?.storageChanged === true,
      gitCommandsRun: result.sideEffects?.gitCommandsRun === true,
    },
  };
}

async function applyEntries({ entries = [], applyAdapter }) {
  const results = [];
  const risks = [];

  for (const entry of entries) {
    try {
      const result = await applyAdapter.applyEntry(entry);
      results.push(buildApplyResult({ entry, result }));
    } catch (error) {
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_ADAPTER_FAILED,
        'Controlled compatibility path removal adapter failed for an entry.',
        {
          path: entry.path,
          actionId: entry.actionId,
          message: error?.message || 'unknown apply adapter failure',
        }
      ));
    }
  }

  return {
    results,
    risks,
  };
}

function evaluateApplyResults({
  entries = [],
  results = [],
}) {
  const risks = [];

  if (results.length !== entries.length) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .APPLY_RESULT_COUNT_MISMATCH,
      'Controlled compatibility path removal apply result count must match batch entry count.',
      {
        expectedCount: entries.length,
        actualCount: results.length,
      }
    ));
  }

  entries.forEach((entry, index) => {
    const result = results[index];
    if (!result) return;

    if (result.applied !== true) {
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_RESULT_NOT_APPLIED,
        'Controlled compatibility path removal result must report applied=true.',
        { path: entry.path }
      ));
    }

    if (normalizePath(result.path) !== normalizePath(entry.path)) {
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
          .APPLY_RESULT_PATH_MISMATCH,
        'Controlled compatibility path removal result path must match the selected entry path.',
        {
          expectedPath: entry.path,
          actualPath: result.path,
        }
      ));
    }

    if (result.actionId !== entry.actionId) {
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
          .APPLY_RESULT_ACTION_MISMATCH,
        'Controlled compatibility path removal result action must match the selected entry action.',
        {
          path: entry.path,
          expectedActionId: entry.actionId,
          actualActionId: result.actionId,
        }
      ));
    }
  });

  return risks;
}

function summarizeSideEffects(results = []) {
  return results.reduce((summary, result) => ({
    filesDeleted: summary.filesDeleted || result.sideEffects.filesDeleted === true,
    filesArchived: summary.filesArchived || result.sideEffects.filesArchived === true,
    routesRemoved: summary.routesRemoved || result.sideEffects.routesRemoved === true,
    testsRemoved: summary.testsRemoved || result.sideEffects.testsRemoved === true,
    storageChanged: summary.storageChanged || result.sideEffects.storageChanged === true,
    gitCommandsRun: summary.gitCommandsRun || result.sideEffects.gitCommandsRun === true,
  }), {
    filesDeleted: false,
    filesArchived: false,
    routesRemoved: false,
    testsRemoved: false,
    storageChanged: false,
    gitCommandsRun: false,
  });
}

function evaluateSideEffects(sideEffects = {}) {
  const risks = [];

  if (sideEffects.filesArchived === true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.UNEXPECTED_SIDE_EFFECT,
      'Controlled compatibility path removal apply must remove replaced paths, not archive them.',
      { sideEffect: 'filesArchived' }
    ));
  }

  if (sideEffects.storageChanged === true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.UNEXPECTED_SIDE_EFFECT,
      'Controlled compatibility path removal apply must not mutate storage.',
      { sideEffect: 'storageChanged' }
    ));
  }

  if (sideEffects.gitCommandsRun === true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.UNEXPECTED_SIDE_EFFECT,
      'Controlled compatibility path removal apply must not run Git commands inside the service.',
      { sideEffect: 'gitCommandsRun' }
    ));
  }

  return risks;
}

function determineStatusId(risks = []) {
  if (risks.some(risk => [
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.REVIEW_ARTIFACT_INVALID,
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
      .REVIEW_EXECUTION_CONTEXT_MISSING,
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
      .REVIEW_EXECUTION_GATE_REVALIDATION_FAILED,
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
      .REVIEW_CONTEXT_REPLAY_BLOCKED,
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
      .REVIEW_CONTEXT_REPLAY_MISMATCH,
  ].includes(risk.riskId))) {
    return POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
      .BLOCKED_BY_REVIEW_INTEGRITY;
  }

  if (risks.some(risk => [
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.REMOVAL_BATCH_NOT_READY,
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
      .REMOVAL_BATCH_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
      .BLOCKED_BY_REMOVAL_BATCH;
  }

  if (risks.some(risk => [
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_NOT_ENABLED,
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
      .OPERATOR_CONFIRMATION_MISSING,
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
      .OPERATOR_CONFIRMATION_ACTOR_MISSING,
  ].includes(risk.riskId))) {
    return POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
      .BLOCKED_BY_CONFIRMATION;
  }

  if (risks.some(risk => [
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_ADAPTER_MISSING,
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_ADAPTER_FAILED,
  ].includes(risk.riskId))) {
    return POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
      .BLOCKED_BY_ADAPTER;
  }

  if (risks.length > 0) {
    return POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
      .BLOCKED_BY_APPLY_RESULT;
  }

  return POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED;
}

async function applyPolicyControlledCompatibilityPathRemoval({
  removalReview = null,
  executeApply = false,
  operatorConfirmation = {},
  applyAdapter = null,
} = {}) {
  const reviewEvaluation = evaluateRemovalReview(removalReview);
  const removalEntries = asArray(reviewEvaluation.review.removalBatch?.entries);
  const preApplyRisks = [
    ...reviewEvaluation.risks,
    ...evaluateConfirmation({
      executeApply,
      operatorConfirmation,
    }),
    ...evaluateAdapter(applyAdapter),
  ];
  const applyAttempt = preApplyRisks.length === 0
    ? await applyEntries({
      entries: removalEntries,
      applyAdapter,
    })
    : { results: [], risks: [] };
  const sideEffects = summarizeSideEffects(applyAttempt.results);
  const risks = [
    ...preApplyRisks,
    ...applyAttempt.risks,
    ...evaluateApplyResults({
      entries: preApplyRisks.length === 0 ? removalEntries : [],
      results: applyAttempt.results,
    }),
    ...evaluateSideEffects(sideEffects),
  ];
  const applyResult = {
    version: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_VERSION,
    statusId: determineStatusId(risks),
    applied: risks.length === 0,
    removalReview: {
      statusId: reviewEvaluation.review.statusId || null,
      validationOk: reviewEvaluation.review.validation?.ok === true,
      readyForRemovalReview: reviewEvaluation.review.readyForRemovalReview === true,
      selectedCount: removalEntries.length,
      reviewedBy: reviewEvaluation.review.removalBatch?.reviewedBy || null,
      reviewArtifactFingerprint:
        reviewEvaluation.review.reviewArtifact?.fingerprint || null,
      executionPlanArtifactFingerprint:
        reviewEvaluation.executionContext.executionPlanArtifact.artifactFingerprint?.fingerprint ||
        null,
      executionGateArtifactFingerprint:
        reviewEvaluation.executionContext.executionGate.executionPlanArtifact?.artifactFingerprint
          ?.fingerprint || null,
    },
    operatorConfirmation: {
      confirmed: operatorConfirmation?.confirmed === true,
      confirmedBy: operatorConfirmation?.confirmedBy || null,
    },
    applyBatch: {
      requestedCount: removalEntries.length,
      appliedCount: applyAttempt.results.filter(result => result.applied === true).length,
      entries: removalEntries,
      results: applyAttempt.results,
    },
    riskCount: risks.length,
    risks,
    sideEffects,
    executionPolicy: {
      requireReadyRemovalReview: true,
      requireReviewArtifactIntegrity: true,
      requireRevalidatedExecutionGate: true,
      requireExplicitExecuteApply: true,
      requireOperatorConfirmation: true,
      requireApplyAdapter: true,
      requireResultParity: true,
      allowGitCommandsInsideService: false,
      allowStorageMutation: false,
    },
    nextStep: {
      stepId: 'post_removal_runtime_verification',
      label: 'Post-Removal Runtime Verification',
      reason:
        'After a reviewed compatibility path removal batch is applied, runtime, import, and test validation must prove no active path was broken.',
    },
  };

  return {
    ...applyResult,
    validation: validatePolicyControlledCompatibilityPathRemovalApply(applyResult),
  };
}

function validatePolicyControlledCompatibilityPathRemovalApply(applyResult = {}) {
  const issues = [];

  if (!Object.values(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS)
    .includes(applyResult.statusId)) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.UNKNOWN_STATUS,
      'Controlled compatibility path removal apply status must be known.'
    ));
  }

  if (applyResult.riskCount !== asArray(applyResult.risks).length) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.RISK_COUNT_MISMATCH,
      'Controlled compatibility path removal apply risk count must match risk list length.'
    ));
  }

  issues.push(...evaluateSideEffects(applyResult.sideEffects || {}));

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_VERSION,
  applyPolicyControlledCompatibilityPathRemoval,
  validatePolicyControlledCompatibilityPathRemovalApply,
};
