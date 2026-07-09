import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from './policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS,
  buildPolicyControlledCompatibilityPathRemoval,
} from './policyControlledCompatibilityPathRemoval.mjs';

const PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_VERSION =
  'phase8r.controlled_compatibility_path_removal_apply.v1';

const PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS = Object.freeze({
  APPLIED: 'applied',
  BLOCKED_BY_REMOVAL_BATCH: 'blocked_by_removal_batch',
  BLOCKED_BY_CONFIRMATION: 'blocked_by_confirmation',
  BLOCKED_BY_ADAPTER: 'blocked_by_adapter',
  BLOCKED_BY_APPLY_RESULT: 'blocked_by_apply_result',
});

const PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS = Object.freeze({
  REMOVAL_BATCH_NOT_READY: 'removal_batch_not_ready',
  REMOVAL_BATCH_VALIDATION_FAILED: 'removal_batch_validation_failed',
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

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').trim();
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
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
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.REMOVAL_BATCH_NOT_READY,
      'Controlled compatibility path removal apply requires a ready Phase 8R.17 batch.',
      { statusId: review.statusId || null }
    ));
  }

  if (review.validation?.ok !== true) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .REMOVAL_BATCH_VALIDATION_FAILED,
      'Controlled compatibility path removal apply requires a valid Phase 8R.17 batch.',
      { issueCount: review.validation?.issueCount ?? null }
    ));
  }

  return {
    review,
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
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_NOT_ENABLED,
      'Controlled compatibility path removal apply requires executeApply=true.'
    ));
  }

  if (operatorConfirmation?.confirmed !== true) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
        .OPERATOR_CONFIRMATION_MISSING,
      'Controlled compatibility path removal apply requires explicit operator confirmation.'
    ));
  }

  if (!String(operatorConfirmation?.confirmedBy || '').trim()) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
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
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_ADAPTER_MISSING,
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
        PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_ADAPTER_FAILED,
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
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
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
        PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_RESULT_NOT_APPLIED,
        'Controlled compatibility path removal result must report applied=true.',
        { path: entry.path }
      ));
    }

    if (normalizePath(result.path) !== normalizePath(entry.path)) {
      risks.push(buildRisk(
        PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
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
        PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
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
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.UNEXPECTED_SIDE_EFFECT,
      'Controlled compatibility path removal apply must remove replaced paths, not archive them.',
      { sideEffect: 'filesArchived' }
    ));
  }

  if (sideEffects.storageChanged === true) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.UNEXPECTED_SIDE_EFFECT,
      'Controlled compatibility path removal apply must not mutate storage.',
      { sideEffect: 'storageChanged' }
    ));
  }

  if (sideEffects.gitCommandsRun === true) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.UNEXPECTED_SIDE_EFFECT,
      'Controlled compatibility path removal apply must not run Git commands inside the service.',
      { sideEffect: 'gitCommandsRun' }
    ));
  }

  return risks;
}

function determineStatusId(risks = []) {
  if (risks.some(risk => [
    PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.REMOVAL_BATCH_NOT_READY,
    PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
      .REMOVAL_BATCH_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
      .BLOCKED_BY_REMOVAL_BATCH;
  }

  if (risks.some(risk => [
    PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_NOT_ENABLED,
    PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
      .OPERATOR_CONFIRMATION_MISSING,
    PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
      .OPERATOR_CONFIRMATION_ACTOR_MISSING,
  ].includes(risk.riskId))) {
    return PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
      .BLOCKED_BY_CONFIRMATION;
  }

  if (risks.some(risk => [
    PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_ADAPTER_MISSING,
    PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_ADAPTER_FAILED,
  ].includes(risk.riskId))) {
    return PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
      .BLOCKED_BY_ADAPTER;
  }

  if (risks.length > 0) {
    return PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
      .BLOCKED_BY_APPLY_RESULT;
  }

  return PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED;
}

async function applyPolicyBuilderPhase8ControlledCompatibilityPathRemoval({
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
    version: PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_VERSION,
    statusId: determineStatusId(risks),
    applied: risks.length === 0,
    removalReview: {
      statusId: reviewEvaluation.review.statusId || null,
      validationOk: reviewEvaluation.review.validation?.ok === true,
      readyForRemovalReview: reviewEvaluation.review.readyForRemovalReview === true,
      selectedCount: removalEntries.length,
      reviewedBy: reviewEvaluation.review.removalBatch?.reviewedBy || null,
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
      requireExplicitExecuteApply: true,
      requireOperatorConfirmation: true,
      requireApplyAdapter: true,
      requireResultParity: true,
      allowGitCommandsInsideService: false,
      allowStorageMutation: false,
    },
    nextPhase: {
      phaseId: '8r_19',
      label: 'Post-Removal Runtime Verification',
      reason:
        'After a reviewed compatibility path removal batch is applied, runtime, import, and test validation must prove no active path was broken.',
    },
  };

  return {
    ...applyResult,
    validation: validatePolicyBuilderPhase8ControlledCompatibilityPathRemovalApply(applyResult),
  };
}

function validatePolicyBuilderPhase8ControlledCompatibilityPathRemovalApply(applyResult = {}) {
  const issues = [];

  if (!Object.values(PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS)
    .includes(applyResult.statusId)) {
    issues.push(buildRisk(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.UNKNOWN_STATUS,
      'Controlled compatibility path removal apply status must be known.'
    ));
  }

  if (applyResult.riskCount !== asArray(applyResult.risks).length) {
    issues.push(buildRisk(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.RISK_COUNT_MISMATCH,
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
  PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS,
  PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
  PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_VERSION,
  applyPolicyBuilderPhase8ControlledCompatibilityPathRemoval,
  validatePolicyBuilderPhase8ControlledCompatibilityPathRemovalApply,
};
