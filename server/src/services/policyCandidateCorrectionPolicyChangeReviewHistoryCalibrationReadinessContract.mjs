/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_IDS,
} from './policyCandidateCorrectionPolicyChangeDecisionRecordContract.mjs';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_MINIMUM_COMPLETED_PERIODS = 6;
export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_MINIMUM_PERIOD_ACTIVITY = 10;

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_STATUS_IDS = Object.freeze({
  COLLECTING_PERIODS: 'collecting_periods',
  INSUFFICIENT_ACTIVITY: 'insufficient_activity',
  READY_FOR_HUMAN_REVIEW: 'ready_for_human_review',
});

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function normalizeNonNegativeInteger(value) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

function normalizeConclusionSummary(value, expectedDecisionId) {
  const source = asPlainObject(value);
  const recordedCount = normalizeNonNegativeInteger(source?.recordedCount);
  const revisedCount = normalizeNonNegativeInteger(source?.revisedCount);
  const totalCount = normalizeNonNegativeInteger(source?.totalCount);
  if (!source || source.decisionId !== expectedDecisionId || recordedCount === null ||
      revisedCount === null || totalCount !== recordedCount + revisedCount) {
    return null;
  }
  return totalCount;
}

function getAggregatePeriodActivity(value) {
  const source = asPlainObject(value);
  if (!source || !Array.isArray(source.conclusionSummaries) ||
      source.conclusionSummaries.length !== POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_IDS.length) {
    return null;
  }
  const totals = source.conclusionSummaries.map((summary, index) =>
    normalizeConclusionSummary(summary, POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_IDS[index]));
  return totals.some(total => total === null)
    ? null
    : totals.reduce((aggregateActivity, total) => aggregateActivity + total, 0);
}

function createReadModel({ statusId, reviewEligible } = {}) {
  return Object.freeze({
    statusId,
    reviewEligible,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    routingChanged: false,
  });
}

/**
 * Reports only whether a human may begin the separate calibration protocol.
 * It does not calculate, propose, persist, or apply a threshold change.
 */
export function buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadinessReadModel({
  periods = [],
} = {}) {
  if (!Array.isArray(periods) ||
      periods.length !== POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_MINIMUM_COMPLETED_PERIODS) {
    return createReadModel({
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_STATUS_IDS.COLLECTING_PERIODS,
      reviewEligible: false,
    });
  }

  const aggregateActivity = periods.map(getAggregatePeriodActivity);
  if (aggregateActivity.some(activity => activity === null)) {
    return createReadModel({
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_STATUS_IDS.COLLECTING_PERIODS,
      reviewEligible: false,
    });
  }

  const reviewEligible = aggregateActivity.every(activity =>
    activity >= POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_MINIMUM_PERIOD_ACTIVITY);
  return createReadModel({
    statusId: reviewEligible
      ? POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_STATUS_IDS.READY_FOR_HUMAN_REVIEW
      : POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_STATUS_IDS.INSUFFICIENT_ACTIVITY,
    reviewEligible,
  });
}
