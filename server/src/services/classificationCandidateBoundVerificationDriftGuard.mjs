/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  CANDIDATE_BOUND_VERIFICATION_METRIC_STATUS_IDS,
  normalizeCandidateBoundVerificationMetricRows,
} from './classificationCandidateBoundVerificationMetrics.mjs';

export const CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_DRIFT_GUARD_VERSION =
  'classification.candidate_bound_verification_drift_guard.v1';

export const CANDIDATE_BOUND_VERIFICATION_DRIFT_STATUS_IDS = Object.freeze({
  STABLE: 'stable',
  ELEVATED: 'elevated',
  INSUFFICIENT_DATA: 'insufficient_data',
});

const STATUS_LABELS = Object.freeze({
  admitted: 'Admitted',
  confirmed: 'Confirmed',
  abstained: 'Abstained',
  contract_violation: 'Response rejected',
  candidate_unavailable: 'Candidate unavailable',
  candidate_mismatch: 'Candidate mismatch',
  provider_capability_unavailable: 'Provider capability unavailable',
});

const MONITORED_STATUS_IDS = Object.freeze([
  'abstained',
  'contract_violation',
  'candidate_unavailable',
  'candidate_mismatch',
  'provider_capability_unavailable',
]);

const MIN_COMPARABLE_OUTCOMES = 20;
const MIN_ELEVATED_OUTCOMES = 3;
const MIN_ELEVATED_RATE = 0.15;
const MIN_RATE_INCREASE = 0.10;

function toUtcDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

function inWindow(observedOn, start, end) {
  return observedOn >= start && observedOn < end;
}

function roundPercent(value) {
  return Math.round(value * 10) / 10;
}

function buildWindowSummary(rows, start, end) {
  const statusCounts = Object.fromEntries(
    CANDIDATE_BOUND_VERIFICATION_METRIC_STATUS_IDS.map(statusId => [statusId, 0]),
  );

  for (const row of rows) {
    if (inWindow(row.observedOn, start, end)) {
      statusCounts[row.statusId] += row.outcomeCount;
    }
  }

  const totalOutcomes = Object.values(statusCounts)
    .reduce((total, count) => total + count, 0);

  return Object.freeze({
    startDate: start,
    endDate: end,
    totalOutcomes,
    statusCounts: Object.freeze(CANDIDATE_BOUND_VERIFICATION_METRIC_STATUS_IDS.map((statusId) => {
      const count = statusCounts[statusId];
      return Object.freeze({
        statusId,
        label: STATUS_LABELS[statusId],
        count,
        ratePercent: totalOutcomes > 0 ? roundPercent(count / totalOutcomes * 100) : 0,
      });
    })),
  });
}

function statusCount(summary, statusId) {
  return summary.statusCounts.find(entry => entry.statusId === statusId)?.count || 0;
}

function statusRate(summary, statusId) {
  if (summary.totalOutcomes === 0) return 0;
  return statusCount(summary, statusId) / summary.totalOutcomes;
}

function buildDriftSignal({ current, previous, statusId, comparable }) {
  const currentCount = statusCount(current, statusId);
  const previousCount = statusCount(previous, statusId);
  const currentRate = statusRate(current, statusId);
  const previousRate = statusRate(previous, statusId);
  const rateIncrease = currentRate - previousRate;
  const elevated = comparable &&
    currentCount >= MIN_ELEVATED_OUTCOMES &&
    currentRate >= MIN_ELEVATED_RATE &&
    rateIncrease >= MIN_RATE_INCREASE;

  return Object.freeze({
    statusId,
    label: STATUS_LABELS[statusId],
    status: elevated
      ? CANDIDATE_BOUND_VERIFICATION_DRIFT_STATUS_IDS.ELEVATED
      : (comparable
        ? CANDIDATE_BOUND_VERIFICATION_DRIFT_STATUS_IDS.STABLE
        : CANDIDATE_BOUND_VERIFICATION_DRIFT_STATUS_IDS.INSUFFICIENT_DATA),
    currentCount,
    previousCount,
    currentRatePercent: roundPercent(currentRate * 100),
    previousRatePercent: roundPercent(previousRate * 100),
    rateChangePercentagePoints: roundPercent(rateIncrease * 100),
  });
}

function driftMessage(statusId) {
  if (statusId === CANDIDATE_BOUND_VERIFICATION_DRIFT_STATUS_IDS.ELEVATED) {
    return 'One or more verification safety outcomes increased materially. Review provider capability and deterministic policy evidence; this report does not change routing.';
  }
  if (statusId === CANDIDATE_BOUND_VERIFICATION_DRIFT_STATUS_IDS.INSUFFICIENT_DATA) {
    return 'More verification outcomes are required before this comparison can identify a material change.';
  }
  return 'No monitored verification safety outcome increased beyond the fixed comparison guard.';
}

/**
 * Produces a fixed, advisory-only comparison. It never accepts or emits item,
 * candidate, library, provider, model, prompt, or model-response content.
 */
export function buildCandidateBoundVerificationDriftReport({
  rows = [],
  previousStart,
  currentStart,
  currentEnd,
  windowDays,
} = {}) {
  const previousStartDate = toUtcDate(previousStart);
  const currentStartDate = toUtcDate(currentStart);
  const currentEndDate = toUtcDate(currentEnd);
  if (!previousStartDate || !currentStartDate || !currentEndDate ||
      !(previousStartDate < currentStartDate && currentStartDate < currentEndDate)) {
    throw new TypeError('Adjacent aggregate comparison windows are required.');
  }

  const normalizedRows = normalizeCandidateBoundVerificationMetricRows(rows);
  const current = buildWindowSummary(normalizedRows, currentStartDate, currentEndDate);
  const previous = buildWindowSummary(normalizedRows, previousStartDate, currentStartDate);
  const comparable = current.totalOutcomes >= MIN_COMPARABLE_OUTCOMES &&
    previous.totalOutcomes >= MIN_COMPARABLE_OUTCOMES;
  const signals = Object.freeze(MONITORED_STATUS_IDS.map(statusId => buildDriftSignal({
    current,
    previous,
    statusId,
    comparable,
  })));
  const statusId = !comparable
    ? CANDIDATE_BOUND_VERIFICATION_DRIFT_STATUS_IDS.INSUFFICIENT_DATA
    : (signals.some(signal => signal.status === CANDIDATE_BOUND_VERIFICATION_DRIFT_STATUS_IDS.ELEVATED)
      ? CANDIDATE_BOUND_VERIFICATION_DRIFT_STATUS_IDS.ELEVATED
      : CANDIDATE_BOUND_VERIFICATION_DRIFT_STATUS_IDS.STABLE);

  return Object.freeze({
    version: CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_DRIFT_GUARD_VERSION,
    window: Object.freeze({
      days: Number(windowDays),
      current: Object.freeze({ startDate: currentStartDate, endDate: currentEndDate }),
      previous: Object.freeze({ startDate: previousStartDate, endDate: currentStartDate }),
    }),
    current,
    previous,
    driftGuard: Object.freeze({
      statusId,
      message: driftMessage(statusId),
      comparable,
      minimumComparableOutcomes: MIN_COMPARABLE_OUTCOMES,
      signals,
    }),
  });
}
