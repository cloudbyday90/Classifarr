/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from './policyControlledCompatibilityPathRemovalApply.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS,
} from './policyControlledCompatibilityPathRemoval.mjs';
import {
  isCanonicalRepositoryPath,
  normalizeRepositoryPath,
} from './policyControlledCompatibilityPathRemovalSelection.mjs';

const POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_VERSION =
  'policy.post_removal_apply_eligibility.v1';

const POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_MODE_IDS = Object.freeze({
  COMPLETE_APPLY: 'complete_apply',
  PARTIAL_APPLY: 'partial_apply',
  INELIGIBLE: 'ineligible',
});

const POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS = Object.freeze({
  APPLY_NOT_COMPLETE: 'apply_not_complete',
  APPLY_VALIDATION_FAILED: 'apply_validation_failed',
  APPLY_RESULT_COUNT_MISMATCH: 'apply_result_count_mismatch',
  PARTIAL_APPLY_HALT_REASON_INVALID: 'partial_apply_halt_reason_invalid',
  PARTIAL_APPLY_STATUS_MISMATCH: 'partial_apply_status_mismatch',
  PARTIAL_APPLY_PREFIX_MISSING: 'partial_apply_prefix_missing',
  PARTIAL_APPLY_BATCH_INVALID: 'partial_apply_batch_invalid',
  PARTIAL_APPLY_ENTRY_INVALID: 'partial_apply_entry_invalid',
  PARTIAL_APPLY_RESULT_INVALID: 'partial_apply_result_invalid',
  PARTIAL_APPLY_REVIEW_CONTEXT_INVALID:
    'partial_apply_review_context_invalid',
});

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

const APPLY_STATUS_BY_HALT_REASON_ID = Object.freeze({
  [POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS
    .PRE_APPLY_RECHECK_FAILED]:
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
      .BLOCKED_BY_PRE_APPLY_RECHECK,
  [POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS
    .ADAPTER_FAILURE]:
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
      .BLOCKED_BY_ADAPTER,
  [POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS
    .ADAPTER_RESULT_REJECTED]:
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
      .BLOCKED_BY_APPLY_RESULT,
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePath(value = '') {
  return normalizeRepositoryPath(value);
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function hasValidFingerprint(value) {
  return SHA256_FINGERPRINT_PATTERN.test(
    typeof value === 'string' ? value.trim().toLowerCase() : ''
  );
}

function entriesMatch(left = {}, right = {}) {
  return normalizePath(left.path) === normalizePath(right.path) &&
    left.actionId === right.actionId;
}

function hasCanonicalEntry(entry = {}) {
  return isCanonicalRepositoryPath(entry.path) && Boolean(entry.actionId);
}

function listAppliedPaths(results = [], appliedCount = results.length) {
  return asArray(results)
    .slice(0, appliedCount)
    .map(result => normalizePath(result?.path))
    .filter(Boolean);
}

function evaluateCompletedApply(evidence = {}) {
  const risks = [];
  const results = asArray(evidence.applyBatch?.results);
  const requestedCount = Number(evidence.applyBatch?.requestedCount ?? results.length);

  if (
    evidence.statusId !==
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED ||
    evidence.applied !== true
  ) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS.APPLY_NOT_COMPLETE,
      'Post-removal runtime verification requires completed controlled-removal apply evidence.',
      { statusId: evidence.statusId || null }
    ));
  }

  if (evidence.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS.APPLY_VALIDATION_FAILED,
      'Post-removal runtime verification requires valid controlled-removal apply evidence.',
      { issueCount: evidence.validation?.issueCount ?? null }
    ));
  }

  if (requestedCount !== results.length) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS.APPLY_RESULT_COUNT_MISMATCH,
      'Post-removal runtime verification requires apply result count to match requested count.',
      { requestedCount, resultCount: results.length }
    ));
  }

  return {
    modeId: risks.length === 0
      ? POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_MODE_IDS.COMPLETE_APPLY
      : POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_MODE_IDS.INELIGIBLE,
    appliedPaths: listAppliedPaths(results),
    authorizationEligible: risks.length === 0,
    risks,
  };
}

function evaluatePartialReviewContext({ removalReview = {}, requestedCount = 0 } = {}) {
  const review = asObject(removalReview);
  const requiredFingerprints = [
    review.reviewArtifactFingerprint,
    review.executionPlanArtifactFingerprint,
    review.executionGateArtifactFingerprint,
  ];

  if (
    review.statusId !==
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
        .READY_FOR_REMOVAL_REVIEW ||
    review.validationOk !== true ||
    review.readyForRemovalReview !== true ||
    review.selectedCount !== requestedCount ||
    requiredFingerprints.some(fingerprint => !hasValidFingerprint(fingerprint))
  ) {
    return [buildRisk(
      POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS
        .PARTIAL_APPLY_REVIEW_CONTEXT_INVALID,
      'Partial post-removal verification requires intact ready review, execution-plan, and execution-gate evidence.',
      {
        reviewStatusId: review.statusId || null,
        selectedCount: review.selectedCount ?? null,
        requestedCount,
      }
    )];
  }

  return [];
}

function evaluatePartialApply(evidence = {}) {
  const applyBatch = asObject(evidence.applyBatch);
  const entries = asArray(applyBatch.entries);
  const results = asArray(applyBatch.results);
  const requestedCount = Number(applyBatch.requestedCount);
  const appliedCount = Number(applyBatch.appliedCount);
  const checkedCount = Number(applyBatch.checkedCount);
  const haltReasonId = applyBatch.haltReasonId || null;
  const risks = [];
  const expectedStatusId = APPLY_STATUS_BY_HALT_REASON_ID[haltReasonId];

  if (!expectedStatusId) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS
        .PARTIAL_APPLY_HALT_REASON_INVALID,
      'Partial post-removal verification requires a known controlled apply halt reason.',
      { haltReasonId }
    ));
  }

  if (
    evidence.applied !== false ||
    !expectedStatusId ||
    evidence.statusId !== expectedStatusId
  ) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS
        .PARTIAL_APPLY_STATUS_MISMATCH,
      'Partial post-removal verification requires an unapplied batch status that matches its halt reason.',
      {
        statusId: evidence.statusId || null,
        expectedStatusId: expectedStatusId || null,
      }
    ));
  }

  if (evidence.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS.APPLY_VALIDATION_FAILED,
      'Partial post-removal verification requires valid controlled-removal apply evidence.',
      { issueCount: evidence.validation?.issueCount ?? null }
    ));
  }

  if (
    !isNonNegativeInteger(requestedCount) ||
    !isNonNegativeInteger(appliedCount) ||
    !isNonNegativeInteger(checkedCount) ||
    requestedCount <= 1 ||
    appliedCount <= 0 ||
    appliedCount >= requestedCount ||
    entries.length !== requestedCount ||
    checkedCount !== appliedCount + 1
  ) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS.PARTIAL_APPLY_BATCH_INVALID,
      'Partial post-removal verification requires a bounded non-empty applied prefix and exactly one stopped entry.',
      {
        requestedCount: Number.isFinite(requestedCount) ? requestedCount : null,
        appliedCount: Number.isFinite(appliedCount) ? appliedCount : null,
        checkedCount: Number.isFinite(checkedCount) ? checkedCount : null,
        entryCount: entries.length,
      }
    ));
  }

  entries.forEach((entry, index) => {
    if (!hasCanonicalEntry(entry)) {
      risks.push(buildRisk(
        POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS.PARTIAL_APPLY_ENTRY_INVALID,
        'Partial post-removal verification requires canonical reviewed entries with action IDs.',
        { entryIndex: index, path: entry?.path || null }
      ));
    }
  });

  const blockedEntry = asObject(applyBatch.blockedEntry);
  const expectedBlockedEntry = entries[appliedCount];
  if (!expectedBlockedEntry || !hasCanonicalEntry(blockedEntry) ||
    !entriesMatch(blockedEntry, expectedBlockedEntry)) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS.PARTIAL_APPLY_PREFIX_MISSING,
      'Partial post-removal verification requires the stopped entry immediately after the applied prefix.',
      {
        appliedCount: Number.isFinite(appliedCount) ? appliedCount : null,
        blockedPath: blockedEntry.path || null,
      }
    ));
  }

  const expectedResultCount = haltReasonId ===
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS
      .ADAPTER_RESULT_REJECTED
    ? appliedCount + 1
    : appliedCount;

  if (results.length !== expectedResultCount) {
    risks.push(buildRisk(
      POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS.PARTIAL_APPLY_RESULT_INVALID,
      'Partial post-removal verification result count must cover only the applied prefix and a rejected stopped result when present.',
      { expectedResultCount, resultCount: results.length }
    ));
  }

  results.slice(0, appliedCount).forEach((result, index) => {
    if (
      result?.applied !== true ||
      !hasCanonicalEntry(result) ||
      !entriesMatch(result, entries[index])
    ) {
      risks.push(buildRisk(
        POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS.PARTIAL_APPLY_RESULT_INVALID,
        'Partial post-removal verification requires every result in the applied prefix to match a reviewed entry and report applied=true.',
        { resultIndex: index, path: result?.path || null }
      ));
    }
  });

  if (haltReasonId ===
    POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS
      .ADAPTER_RESULT_REJECTED) {
    const rejectedResult = results[appliedCount];
    if (
      rejectedResult?.applied !== false ||
      !hasCanonicalEntry(rejectedResult) ||
      !entriesMatch(rejectedResult, expectedBlockedEntry)
    ) {
      risks.push(buildRisk(
        POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS.PARTIAL_APPLY_RESULT_INVALID,
        'A rejected adapter result must be the bounded stopped entry and report applied=false.',
        { path: rejectedResult?.path || null }
      ));
    }
  }

  risks.push(...evaluatePartialReviewContext({
    removalReview: evidence.removalReview,
    requestedCount,
  }));

  if (risks.length > 0) {
    risks.unshift(buildRisk(
      POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS.APPLY_NOT_COMPLETE,
      'Post-removal runtime verification could not establish a bounded valid partial controlled-removal apply prefix.',
      { statusId: evidence.statusId || null }
    ));
  }

  return {
    modeId: risks.length === 0
      ? POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_MODE_IDS.PARTIAL_APPLY
      : POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_MODE_IDS.INELIGIBLE,
    appliedPaths: listAppliedPaths(results, appliedCount),
    authorizationEligible: false,
    risks,
  };
}

function evaluatePolicyPostRemovalApplyEligibility(applyEvidence = null) {
  const evidence = asObject(applyEvidence);
  const isPartialCandidate = evidence.applied === false &&
    Object.values(APPLY_STATUS_BY_HALT_REASON_ID).includes(evidence.statusId);
  const evaluation = isPartialCandidate
    ? evaluatePartialApply(evidence)
    : evaluateCompletedApply(evidence);

  return {
    version: POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_VERSION,
    evidence,
    modeId: evaluation.modeId,
    partialApply:
      evaluation.modeId === POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_MODE_IDS
        .PARTIAL_APPLY,
    authorizationEligible: evaluation.authorizationEligible,
    appliedPathCount: evaluation.appliedPaths.length,
    appliedPaths: evaluation.appliedPaths,
    riskCount: evaluation.risks.length,
    risks: evaluation.risks,
  };
}

export {
  POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_MODE_IDS,
  POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS,
  POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_VERSION,
  evaluatePolicyPostRemovalApplyEligibility,
};
