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
  POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRIC_STATUS_IDS,
} from './policyCandidateContrastiveOutcomeMetricsRepository.mjs';

export const POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRICS_VERSION =
  'policy.candidate_contrastive_outcome_metrics.v1';
export const POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRICS_DEFAULT_WINDOW_DAYS =
  COMPLETED_UTC_DAY_METRICS_DEFAULT_WINDOW_DAYS;
export const POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRICS_MAX_WINDOW_DAYS =
  COMPLETED_UTC_DAY_METRICS_MAX_WINDOW_DAYS;

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

function aggregateRows(rows) {
  const knownStatusIds = new Set(POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRIC_STATUS_IDS);
  const rowsByStatusId = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const statusId = typeof row?.contrastiveStatusId === 'string'
      ? row.contrastiveStatusId
      : null;
    if (!knownStatusIds.has(statusId)) continue;

    const existing = rowsByStatusId.get(statusId) || {};
    rowsByStatusId.set(statusId, {
      observationCount: nonnegativeCount(existing.observationCount) + nonnegativeCount(row.observationCount),
      resolvedOutcomeCount: nonnegativeCount(existing.resolvedOutcomeCount) + nonnegativeCount(row.resolvedOutcomeCount),
      attributedOutcomeCount: nonnegativeCount(existing.attributedOutcomeCount) + nonnegativeCount(row.attributedOutcomeCount),
      confirmedCandidateOutcomeCount:
        nonnegativeCount(existing.confirmedCandidateOutcomeCount) +
        nonnegativeCount(row.confirmedCandidateOutcomeCount),
      changedToCandidateOutcomeCount:
        nonnegativeCount(existing.changedToCandidateOutcomeCount) +
        nonnegativeCount(row.changedToCandidateOutcomeCount),
      changedOutsideCandidateOutcomeCount:
        nonnegativeCount(existing.changedOutsideCandidateOutcomeCount) +
        nonnegativeCount(row.changedOutsideCandidateOutcomeCount),
      routedNotApplicableOutcomeCount:
        nonnegativeCount(existing.routedNotApplicableOutcomeCount) +
        nonnegativeCount(row.routedNotApplicableOutcomeCount),
    });
  }

  return rowsByStatusId;
}

function buildBucket(statusId, value = {}) {
  const observationCount = nonnegativeCount(value.observationCount);
  const resolvedOutcomeCount = Math.min(observationCount, nonnegativeCount(value.resolvedOutcomeCount));
  const attributedOutcomeCount = Math.min(
    resolvedOutcomeCount,
    nonnegativeCount(value.attributedOutcomeCount),
  );
  const confirmedCandidateOutcomeCount = Math.min(
    attributedOutcomeCount,
    nonnegativeCount(value.confirmedCandidateOutcomeCount),
  );
  const changedToCandidateOutcomeCount = Math.min(
    attributedOutcomeCount - confirmedCandidateOutcomeCount,
    nonnegativeCount(value.changedToCandidateOutcomeCount),
  );
  const changedOutsideCandidateOutcomeCount = Math.min(
    attributedOutcomeCount - confirmedCandidateOutcomeCount - changedToCandidateOutcomeCount,
    nonnegativeCount(value.changedOutsideCandidateOutcomeCount),
  );
  const routedNotApplicableOutcomeCount = Math.min(
    attributedOutcomeCount - confirmedCandidateOutcomeCount - changedToCandidateOutcomeCount -
      changedOutsideCandidateOutcomeCount,
    nonnegativeCount(value.routedNotApplicableOutcomeCount),
  );
  const applicableDecisionCount =
    confirmedCandidateOutcomeCount +
    changedToCandidateOutcomeCount +
    changedOutsideCandidateOutcomeCount;
  const changedSelectionOutcomeCount =
    changedToCandidateOutcomeCount + changedOutsideCandidateOutcomeCount;

  return Object.freeze({
    statusId,
    observationCount,
    resolvedOutcomeCount,
    attributedOutcomeCount,
    confirmedCandidateOutcomeCount,
    changedToCandidateOutcomeCount,
    changedOutsideCandidateOutcomeCount,
    routedNotApplicableOutcomeCount,
    unattributedResolvedOutcomeCount: Math.max(0, resolvedOutcomeCount - attributedOutcomeCount),
    applicableDecisionCount,
    candidateSetSelectionRatePercent: ratePercent(
      confirmedCandidateOutcomeCount + changedToCandidateOutcomeCount,
      applicableDecisionCount,
    ),
    changedSelectionRatePercent: ratePercent(changedSelectionOutcomeCount, applicableDecisionCount),
    outsideCandidateRatePercent: ratePercent(changedOutsideCandidateOutcomeCount, applicableDecisionCount),
  });
}

function sumBuckets(buckets, property) {
  return buckets.reduce((total, bucket) => total + nonnegativeCount(bucket[property]), 0);
}

export function normalizePolicyCandidateContrastiveOutcomeMetricsWindowDays(value) {
  return normalizeCompletedUtcDayMetricsWindowDays(value);
}

export function buildPolicyCandidateContrastiveOutcomeMetricsWindow({
  windowDays,
  now = new Date(),
} = {}) {
  return buildCompletedUtcDayMetricsWindow({ windowDays, now });
}

/**
 * Builds a fixed six-bucket aggregate report. It reports associations between
 * a prior advisory identity check and later operator actions; it does not
 * infer correctness, causation, policy intent, or routing authority.
 */
export function buildPolicyCandidateContrastiveOutcomeMetricsReport({
  rows = [],
  window = null,
} = {}) {
  const rowsByStatusId = aggregateRows(rows);
  const buckets = Object.freeze(POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRIC_STATUS_IDS
    .map((statusId) => buildBucket(statusId, rowsByStatusId.get(statusId))));
  const observationCount = sumBuckets(buckets, 'observationCount');
  const attributedOutcomeCount = sumBuckets(buckets, 'attributedOutcomeCount');
  const applicableDecisionCount = sumBuckets(buckets, 'applicableDecisionCount');
  const changedSelectionOutcomeCount = sumBuckets(buckets, 'changedToCandidateOutcomeCount') +
    sumBuckets(buckets, 'changedOutsideCandidateOutcomeCount');

  return Object.freeze({
    version: POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRICS_VERSION,
    window: Object.freeze({
      days: window?.days || 0,
      startDate: dateOnly(window?.start),
      endDate: dateOnly(window?.end),
    }),
    buckets,
    summary: Object.freeze({
      observationCount,
      attributedOutcomeCount,
      applicableDecisionCount,
      changedSelectionOutcomeCount,
      changedSelectionRatePercent: ratePercent(changedSelectionOutcomeCount, applicableDecisionCount),
    }),
    readiness: Object.freeze({
      statusId: observationCount > 0 ? 'observing' : 'insufficient_data',
      message: observationCount > 0
        ? 'Aggregate contrastive-check and operator-outcome observations are available. They are descriptive only and do not change policy, AI, or routing decisions.'
        : 'No contrastive inventory observations have been recorded in this completed UTC-day window yet.',
    }),
  });
}
