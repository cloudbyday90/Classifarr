/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  COMPLETED_UTC_DAY_METRICS_DEFAULT_WINDOW_DAYS,
  COMPLETED_UTC_DAY_METRICS_MAX_WINDOW_DAYS,
  buildCompletedUtcDayMetricsWindow,
  normalizeCompletedUtcDayMetricsWindowDays,
} from './completedUtcDayMetricsWindow.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS,
  POLICY_CANDIDATE_CORRECTION_EVIDENCE_STATE_IDS,
  POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER,
} from './policyCandidateCorrectionSignalSnapshot.mjs';

export const POLICY_CANDIDATE_CORRECTION_ANALYTICS_METRICS_VERSION =
  'policy.candidate_correction_analytics_metrics.v1';
export const POLICY_CANDIDATE_CORRECTION_ANALYTICS_METRICS_DEFAULT_WINDOW_DAYS =
  COMPLETED_UTC_DAY_METRICS_DEFAULT_WINDOW_DAYS;
export const POLICY_CANDIDATE_CORRECTION_ANALYTICS_METRICS_MAX_WINDOW_DAYS =
  COMPLETED_UTC_DAY_METRICS_MAX_WINDOW_DAYS;

const MARGIN_BAND_IDS = new Set(POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER);
const EVIDENCE_SOURCE_IDS = new Set(POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS);
const EVIDENCE_STATE_IDS = new Set(POLICY_CANDIDATE_CORRECTION_EVIDENCE_STATE_IDS);

function dateOnly(value) {
  return value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString().slice(0, 10)
    : null;
}

function nonnegativeCount(value) {
  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function ratePercent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function normalizedOutcomeCounts(value = {}) {
  const outcomeCount = nonnegativeCount(value.outcomeCount);
  const confirmedLeaderOutcomeCount = Math.min(
    outcomeCount,
    nonnegativeCount(value.confirmedLeaderOutcomeCount),
  );
  const changedToCandidateOutcomeCount = Math.min(
    outcomeCount - confirmedLeaderOutcomeCount,
    nonnegativeCount(value.changedToCandidateOutcomeCount),
  );
  const changedOutsideCandidatesOutcomeCount = Math.min(
    outcomeCount - confirmedLeaderOutcomeCount - changedToCandidateOutcomeCount,
    nonnegativeCount(value.changedOutsideCandidatesOutcomeCount),
  );
  const routedNotApplicableOutcomeCount = Math.min(
    outcomeCount - confirmedLeaderOutcomeCount - changedToCandidateOutcomeCount -
      changedOutsideCandidatesOutcomeCount,
    nonnegativeCount(value.routedNotApplicableOutcomeCount),
  );
  const applicableDecisionCount = confirmedLeaderOutcomeCount +
    changedToCandidateOutcomeCount + changedOutsideCandidatesOutcomeCount;
  const changedSelectionOutcomeCount = changedToCandidateOutcomeCount +
    changedOutsideCandidatesOutcomeCount;

  return {
    outcomeCount,
    confirmedLeaderOutcomeCount,
    changedToCandidateOutcomeCount,
    changedOutsideCandidatesOutcomeCount,
    routedNotApplicableOutcomeCount,
    applicableDecisionCount,
    changedSelectionOutcomeCount,
    changedSelectionRatePercent: ratePercent(changedSelectionOutcomeCount, applicableDecisionCount),
  };
}

function addOutcomeCounts(left = {}, right = {}) {
  return {
    outcomeCount: nonnegativeCount(left.outcomeCount) + nonnegativeCount(right.outcomeCount),
    confirmedLeaderOutcomeCount: nonnegativeCount(left.confirmedLeaderOutcomeCount) +
      nonnegativeCount(right.confirmedLeaderOutcomeCount),
    changedToCandidateOutcomeCount: nonnegativeCount(left.changedToCandidateOutcomeCount) +
      nonnegativeCount(right.changedToCandidateOutcomeCount),
    changedOutsideCandidatesOutcomeCount: nonnegativeCount(left.changedOutsideCandidatesOutcomeCount) +
      nonnegativeCount(right.changedOutsideCandidatesOutcomeCount),
    routedNotApplicableOutcomeCount: nonnegativeCount(left.routedNotApplicableOutcomeCount) +
      nonnegativeCount(right.routedNotApplicableOutcomeCount),
  };
}

function aggregateRows(rows, rowKind, keyForRow, isAllowedRow) {
  const buckets = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.rowKind !== rowKind || !isAllowedRow(row)) continue;
    const key = keyForRow(row);
    buckets.set(key, addOutcomeCounts(buckets.get(key), row));
  }
  return buckets;
}

function buildMarginBuckets(rows) {
  const valuesByMarginBand = aggregateRows(
    rows,
    'margin_band',
    (row) => row.scoreMarginBandId,
    (row) => MARGIN_BAND_IDS.has(row?.scoreMarginBandId),
  );

  return Object.freeze(POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER.map((marginBandId) => (
    Object.freeze({
      marginBandId,
      ...normalizedOutcomeCounts(valuesByMarginBand.get(marginBandId)),
    })
  )));
}

function buildEvidenceSourceStateBuckets(rows) {
  const valuesBySourceState = aggregateRows(
    rows,
    'evidence_source_state',
    (row) => `${row.evidenceSourceId}:${row.evidenceStateId}`,
    (row) => EVIDENCE_SOURCE_IDS.has(row?.evidenceSourceId) &&
      EVIDENCE_STATE_IDS.has(row?.evidenceStateId),
  );

  return Object.freeze(
    Array.from(valuesBySourceState.entries())
      .map(([key, value]) => {
        const [evidenceSourceId, evidenceStateId] = key.split(':');
        return Object.freeze({
          evidenceSourceId,
          evidenceStateId,
          ...normalizedOutcomeCounts(value),
        });
      })
      .filter((bucket) => bucket.outcomeCount > 0)
      .sort((left, right) => (
        POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS.indexOf(left.evidenceSourceId) -
          POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS.indexOf(right.evidenceSourceId) ||
        POLICY_CANDIDATE_CORRECTION_EVIDENCE_STATE_IDS.indexOf(left.evidenceStateId) -
          POLICY_CANDIDATE_CORRECTION_EVIDENCE_STATE_IDS.indexOf(right.evidenceStateId)
      )),
  );
}

export function normalizePolicyCandidateCorrectionAnalyticsMetricsWindowDays(value) {
  return normalizeCompletedUtcDayMetricsWindowDays(value);
}

export function buildPolicyCandidateCorrectionAnalyticsMetricsWindow({
  windowDays,
  now = new Date(),
} = {}) {
  return buildCompletedUtcDayMetricsWindow({ windowDays, now });
}

/**
 * Builds a fixed, aggregate-only report about the association between the
 * original leading-candidate evidence state and later validated operator
 * selection. It is descriptive, not a correctness verdict or tuning command.
 */
export function buildPolicyCandidateCorrectionAnalyticsMetricsReport({
  rows = [],
  window = null,
} = {}) {
  const marginBuckets = buildMarginBuckets(rows);
  const evidenceSourceStateBuckets = buildEvidenceSourceStateBuckets(rows);
  const summaryCounts = marginBuckets.reduce(addOutcomeCounts, {});
  const summary = normalizedOutcomeCounts(summaryCounts);

  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_ANALYTICS_METRICS_VERSION,
    window: Object.freeze({
      days: window?.days || 0,
      startDate: dateOnly(window?.start),
      endDate: dateOnly(window?.end),
    }),
    marginBuckets,
    evidenceSourceStateBuckets,
    summary: Object.freeze(summary),
    readiness: Object.freeze({
      statusId: summary.outcomeCount > 0 ? 'observing' : 'insufficient_data',
      message: summary.outcomeCount > 0
        ? 'Aggregate evidence-state and operator-outcome observations are available. They describe associations only and do not change policy, AI, RAG, learning, or routing.'
        : 'No eligible operator confirmation or destination-change observations have been recorded in this completed UTC-day window yet.',
    }),
  });
}
