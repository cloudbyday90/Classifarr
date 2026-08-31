/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_IDS,
} from './policyCandidateCorrectionPolicyChangeDecisionRecordContract.mjs';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_MINIMUM_PERIOD_ACTIVITY = 10;
export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_MAX_DISTRIBUTION_DISTANCE = 0.25;
export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_MAX_REVISION_RATE_DELTA = 0.2;

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_STATUS_IDS = Object.freeze({
  COLLECTING: 'collecting',
  INSUFFICIENT_ACTIVITY: 'insufficient_activity',
  CONSISTENT: 'consistent',
  SHIFTED: 'shifted',
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
  return Object.freeze({ recordedCount, revisedCount, totalCount });
}

function normalizePeriod(value) {
  const source = asPlainObject(value);
  if (!source || !Array.isArray(source.conclusionSummaries) ||
      source.conclusionSummaries.length !== POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_IDS.length) {
    return null;
  }
  const conclusionSummaries = source.conclusionSummaries.map((summary, index) =>
    normalizeConclusionSummary(summary, POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_IDS[index]));
  return conclusionSummaries.some(summary => !summary) ? null : Object.freeze(conclusionSummaries);
}

function createReadModel({ statusId, comparisonAvailable } = {}) {
  return Object.freeze({
    statusId,
    comparisonAvailable,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    routingChanged: false,
  });
}

function getPeriodMetrics(conclusionSummaries) {
  const totalActivity = conclusionSummaries.reduce((total, summary) => total + summary.totalCount, 0);
  const revisedActivity = conclusionSummaries.reduce((total, summary) => total + summary.revisedCount, 0);
  if (totalActivity === 0) return null;
  return Object.freeze({
    totalActivity,
    revisionRate: revisedActivity / totalActivity,
    conclusionDistribution: Object.freeze(conclusionSummaries.map(summary => summary.totalCount / totalActivity)),
  });
}

function getComparisonDistance(left, right) {
  const distributionDistance = left.conclusionDistribution.reduce((total, value, index) =>
    total + Math.abs(value - right.conclusionDistribution[index]), 0) / 2;
  return Object.freeze({
    distributionDistance,
    revisionRateDelta: Math.abs(left.revisionRate - right.revisionRate),
  });
}

function isWithinConsistencyThresholds(comparison) {
  return comparison.distributionDistance <=
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_MAX_DISTRIBUTION_DISTANCE &&
    comparison.revisionRateDelta <=
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_MAX_REVISION_RATE_DELTA;
}

/**
 * Produces a fixed, aggregate-only signal from exactly three completed review
 * periods. It emits no dates, counts, identities, policy/media data, metrics,
 * or authority; those values cannot be reverse-engineered from this status.
 */
export function buildPolicyCandidateCorrectionPolicyChangeReviewHistoryConsistencyReadModel({ periods = [] } = {}) {
  if (!Array.isArray(periods) || periods.length !== 3) {
    return createReadModel({
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_STATUS_IDS.COLLECTING,
      comparisonAvailable: false,
    });
  }

  const normalizedPeriods = periods.map(normalizePeriod);
  if (normalizedPeriods.some(period => !period)) {
    return createReadModel({
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_STATUS_IDS.COLLECTING,
      comparisonAvailable: false,
    });
  }

  const periodMetrics = normalizedPeriods.map(getPeriodMetrics);
  if (periodMetrics.some(metrics => !metrics) || periodMetrics.some(metrics =>
    metrics.totalActivity < POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_MINIMUM_PERIOD_ACTIVITY)) {
    return createReadModel({
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_STATUS_IDS.INSUFFICIENT_ACTIVITY,
      comparisonAvailable: false,
    });
  }

  const comparisons = [
    getComparisonDistance(periodMetrics[0], periodMetrics[1]),
    getComparisonDistance(periodMetrics[1], periodMetrics[2]),
  ];
  return createReadModel({
    statusId: comparisons.every(isWithinConsistencyThresholds)
      ? POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_STATUS_IDS.CONSISTENT
      : POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_STATUS_IDS.SHIFTED,
    comparisonAvailable: true,
  });
}
