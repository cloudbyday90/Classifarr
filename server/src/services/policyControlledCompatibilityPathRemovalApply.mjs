/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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
  POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_STATUS_IDS,
  verifyPolicyCompatibilityDeletionPreApplyChange,
} from './policyCompatibilityDeletionPreApplyChangeDetector.mjs';
import {
  validatePolicyControlledCompatibilityPathRemovalReviewArtifact,
} from './policyControlledCompatibilityPathRemovalReviewArtifact.mjs';

const POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_VERSION =
  'policy.controlled_compatibility_path_removal_apply.v4';

const POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS = Object.freeze({
  APPLIED: 'applied',
  BLOCKED_BY_REMOVAL_BATCH: 'blocked_by_removal_batch',
  BLOCKED_BY_REVIEW_INTEGRITY: 'blocked_by_review_integrity',
  BLOCKED_BY_CONFIRMATION: 'blocked_by_confirmation',
  BLOCKED_BY_ADAPTER: 'blocked_by_adapter',
  BLOCKED_BY_PRE_APPLY_RECHECK: 'blocked_by_pre_apply_recheck',
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
  PRE_APPLY_CHANGE_DETECTED: 'pre_apply_change_detected',
  PRE_APPLY_RECHECK_FAILED: 'pre_apply_recheck_failed',
  APPLY_RESULT_COUNT_MISMATCH: 'apply_result_count_mismatch',
  APPLY_RESULT_NOT_APPLIED: 'apply_result_not_applied',
  APPLY_RESULT_PATH_MISMATCH: 'apply_result_path_mismatch',
  APPLY_RESULT_ACTION_MISMATCH: 'apply_result_action_mismatch',
  EXECUTION_POLICY_MISMATCH: 'execution_policy_mismatch',
  UNEXPECTED_SIDE_EFFECT: 'unexpected_side_effect',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  HALT_REASON_INVALID: 'halt_reason_invalid',
  UNKNOWN_STATUS: 'unknown_status',
});

const POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS = Object.freeze({
  PRE_APPLY_RECHECK_FAILED: 'pre_apply_recheck_failed',
  ADAPTER_FAILURE: 'adapter_failure',
  ADAPTER_RESULT_REJECTED: 'adapter_result_rejected',
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
      preflightEvidenceArtifact: {},
      risks,
    };
  }

  const revalidatedGate = buildPolicyCompatibilityDeletionExecutionGate({
    executionPlanArtifact,
    operatorEvidence: executionGate.operatorEvidence,
    preflightEvidenceArtifact: executionGate.preflightEvidenceArtifact,
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
      'Controlled compatibility path removal apply requires collector and operator evidence that still rebuild a ready execution gate.',
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
    preflightEvidenceArtifact: revalidatedGate.preflightEvidenceArtifact,
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
      {
        statusId: review.statusId || null,
        reviewRiskIds: asArray(review.risks)
          .map(risk => risk?.riskId)
          .filter(Boolean),
      }
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
      preflightEvidenceArtifact: {},
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

function summarizePreApplyVerification(entry = {}, verification = {}) {
  return {
    path: normalizePath(entry.path),
    statusId: verification.statusId || null,
    verified: verification.verified === true,
    riskIds: asArray(verification.risks)
      .map(risk => risk?.riskId)
      .filter(Boolean),
  };
}

function hasRejectedApplyResult({ entry = {}, result = {} } = {}) {
  return evaluateApplyResults({
    entries: [entry],
    results: [result],
  }).length > 0 || evaluateSideEffects(result.sideEffects).length > 0;
}

async function applyEntries({
  entries = [],
  applyAdapter,
  preflightEvidenceArtifact,
  preApplyChangeDetector = verifyPolicyCompatibilityDeletionPreApplyChange,
  repoRoot,
}) {
  const results = [];
  const risks = [];
  const preApplyVerifications = [];
  const entriesSubmittedToAdapter = [];
  let blockedEntry = null;
  let haltReasonId = null;

  for (const entry of entries) {
    let verification;

    try {
      verification = await preApplyChangeDetector({
        entry,
        preflightEvidenceArtifact,
        repoRoot,
      });
    } catch (_error) {
      verification = null;
    }

    const verificationSummary = summarizePreApplyVerification(entry, verification);
    preApplyVerifications.push(verificationSummary);

    if (
      verification?.statusId !==
        POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_STATUS_IDS.VERIFIED ||
      verification?.verified !== true ||
      verification?.validation?.ok !== true
    ) {
      blockedEntry = { path: normalizePath(entry.path), actionId: entry.actionId || null };
      haltReasonId =
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS
          .PRE_APPLY_RECHECK_FAILED;
      risks.push(buildRisk(
        verification
          ? POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
            .PRE_APPLY_CHANGE_DETECTED
          : POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS
            .PRE_APPLY_RECHECK_FAILED,
        verification
          ? 'Controlled compatibility path removal stopped because the approved checkout state changed before the adapter received an entry.'
          : 'Controlled compatibility path removal stopped because the final pre-apply checkout recheck did not return valid evidence.',
        {
          path: blockedEntry.path,
          actionId: blockedEntry.actionId,
          recheckStatusId: verification?.statusId || null,
          recheckRiskIds: verificationSummary.riskIds,
        }
      ));

      break;
    }

    entriesSubmittedToAdapter.push(entry);

    try {
      const result = await applyAdapter.applyEntry(entry);
      const normalizedResult = buildApplyResult({ entry, result });
      results.push(normalizedResult);

      if (hasRejectedApplyResult({ entry, result: normalizedResult })) {
        blockedEntry = { path: normalizePath(entry.path), actionId: entry.actionId || null };
        haltReasonId =
          POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS
            .ADAPTER_RESULT_REJECTED;
        break;
      }
    } catch (error) {
      blockedEntry = { path: normalizePath(entry.path), actionId: entry.actionId || null };
      haltReasonId =
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS.ADAPTER_FAILURE;
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.APPLY_ADAPTER_FAILED,
        'Controlled compatibility path removal adapter failed for an entry.',
        {
          path: entry.path,
          actionId: entry.actionId,
          message: error?.message || 'unknown apply adapter failure',
        }
      ));
      break;
    }
  }

  return {
    blockedEntry,
    entriesSubmittedToAdapter,
    haltReasonId,
    preApplyVerifications,
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
      'Controlled compatibility path removal apply must not run Git mutation commands inside the service.',
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
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.PRE_APPLY_CHANGE_DETECTED,
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.PRE_APPLY_RECHECK_FAILED,
  ].includes(risk.riskId))) {
    return POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
      .BLOCKED_BY_PRE_APPLY_RECHECK;
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

function buildNextStep({ appliedCount = 0 } = {}) {
  if (appliedCount > 0) {
    return {
      stepId: 'post_removal_runtime_verification',
      label: 'Post-Removal Runtime Verification',
      reason:
        'Every applied compatibility path must receive runtime, import, and test verification before another removal batch is considered.',
    };
  }

  return {
    stepId: 'resolve_removal_apply_blocker',
    label: 'Resolve Removal Apply Blocker',
    reason:
      'No reviewed compatibility path applied. Resolve the bounded blocker and create a fresh reviewed removal batch before trying again.',
  };
}

function evaluateApplyBatchHalt(applyResult = {}) {
  const risks = [];
  const applyBatch = asObject(applyResult.applyBatch);
  const haltReasonId = applyBatch.haltReasonId ?? null;
  const hasBlockedEntry = Object.keys(asObject(applyBatch.blockedEntry)).length > 0;

  if (
    haltReasonId !== null &&
    !Object.values(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS)
      .includes(haltReasonId)
  ) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.HALT_REASON_INVALID,
      'Controlled compatibility path removal apply halt reason must be known.',
      { haltReasonId }
    ));
  }

  if (haltReasonId !== null && !hasBlockedEntry) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.HALT_REASON_INVALID,
      'Controlled compatibility path removal apply halt reason requires the bounded entry that stopped the batch.',
      { haltReasonId }
    ));
  }

  if (
    applyResult.statusId ===
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED &&
    haltReasonId !== null
  ) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.HALT_REASON_INVALID,
      'An applied controlled compatibility path removal batch cannot report a halt reason.',
      { haltReasonId }
    ));
  }

  return risks;
}

async function applyPolicyControlledCompatibilityPathRemoval({
  removalReview = null,
  executeApply = false,
  operatorConfirmation = {},
  applyAdapter = null,
  preApplyChangeDetector = verifyPolicyCompatibilityDeletionPreApplyChange,
  repoRoot = undefined,
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
      preflightEvidenceArtifact:
        reviewEvaluation.executionContext.preflightEvidenceArtifact,
      preApplyChangeDetector,
      repoRoot,
    })
    : {
      blockedEntry: null,
      entriesSubmittedToAdapter: [],
      haltReasonId: null,
      preApplyVerifications: [],
      results: [],
      risks: [],
    };
  const sideEffects = summarizeSideEffects(applyAttempt.results);
  const risks = [
    ...preApplyRisks,
    ...applyAttempt.risks,
    ...evaluateApplyResults({
      entries: preApplyRisks.length === 0 ? applyAttempt.entriesSubmittedToAdapter : [],
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
      checkedCount: applyAttempt.preApplyVerifications.length,
      blockedEntry: applyAttempt.blockedEntry,
      haltReasonId: applyAttempt.haltReasonId,
      appliedCount: applyAttempt.results.filter(result => result.applied === true).length,
      entries: removalEntries,
      preApplyVerifications: applyAttempt.preApplyVerifications,
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
      requirePreApplyChangeDetection: true,
      stopAfterAdapterFailure: true,
      stopAfterRejectedAdapterResult: true,
      allowReadOnlyGitVerification: true,
      allowGitMutationCommandsInsideService: false,
      allowStorageMutation: false,
    },
    nextStep: buildNextStep({
      appliedCount: applyAttempt.results.filter(result => result.applied === true).length,
    }),
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

  const executionPolicy = asObject(applyResult.executionPolicy);

  if (
    executionPolicy.requireReadyRemovalReview !== true ||
    executionPolicy.requireReviewArtifactIntegrity !== true ||
    executionPolicy.requireRevalidatedExecutionGate !== true ||
    executionPolicy.requireExplicitExecuteApply !== true ||
    executionPolicy.requireOperatorConfirmation !== true ||
    executionPolicy.requireApplyAdapter !== true ||
    executionPolicy.requireResultParity !== true ||
    executionPolicy.requirePreApplyChangeDetection !== true ||
    executionPolicy.stopAfterAdapterFailure !== true ||
    executionPolicy.stopAfterRejectedAdapterResult !== true ||
    executionPolicy.allowReadOnlyGitVerification !== true ||
    executionPolicy.allowGitMutationCommandsInsideService !== false ||
    executionPolicy.allowStorageMutation !== false
  ) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS.EXECUTION_POLICY_MISMATCH,
      'Controlled compatibility path removal apply must retain its final read-only pre-apply verification policy.'
    ));
  }

  issues.push(...evaluateApplyBatchHalt(applyResult));
  issues.push(...evaluateSideEffects(applyResult.sideEffects || {}));

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_VERSION,
  applyPolicyControlledCompatibilityPathRemoval,
  validatePolicyControlledCompatibilityPathRemovalApply,
};
