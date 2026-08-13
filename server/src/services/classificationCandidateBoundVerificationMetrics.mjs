/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  CANDIDATE_BOUND_VERIFICATION_STATUS_IDS,
  CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_VERSION,
} from './classificationCandidateBoundVerificationContract.mjs';

export const CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_METRICS_VERSION =
  'classification.candidate_bound_verification_metrics.v1';

export const CANDIDATE_BOUND_VERIFICATION_METRICS_DEFAULT_WINDOW_DAYS = 7;
export const CANDIDATE_BOUND_VERIFICATION_METRICS_MAX_WINDOW_DAYS = 30;

export const CANDIDATE_BOUND_VERIFICATION_METRIC_STATUS_IDS = Object.freeze(
  Object.values(CANDIDATE_BOUND_VERIFICATION_STATUS_IDS),
);

const VALID_STATUS_IDS = new Set(CANDIDATE_BOUND_VERIFICATION_METRIC_STATUS_IDS);
const UTC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function startOfUtcDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ));
}

function dateOnly(value) {
  if (typeof value === 'string' && UTC_DATE_PATTERN.test(value)) return value;

  const date = startOfUtcDay(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/**
 * Bounds operator-selected windows before they reach the aggregate query.
 */
export function normalizeCandidateBoundVerificationMetricsWindowDays(value) {
  const parsed = positiveInteger(value);
  if (!parsed) return CANDIDATE_BOUND_VERIFICATION_METRICS_DEFAULT_WINDOW_DAYS;

  return Math.min(parsed, CANDIDATE_BOUND_VERIFICATION_METRICS_MAX_WINDOW_DAYS);
}

/**
 * Builds two adjacent, completed UTC-day windows. The query receives only their timestamps;
 * no classification, destination, provider, prompt, or response data crosses
 * this boundary.
 */
export function buildCandidateBoundVerificationMetricsWindow({
  windowDays,
  now = new Date(),
} = {}) {
  const days = normalizeCandidateBoundVerificationMetricsWindowDays(windowDays);
  const currentEnd = startOfUtcDay(now);

  if (!currentEnd) {
    throw new TypeError('A valid observation time is required.');
  }

  const currentStart = new Date(currentEnd);
  currentStart.setUTCDate(currentStart.getUTCDate() - days);
  const previousStart = new Date(currentStart);
  previousStart.setUTCDate(previousStart.getUTCDate() - days);

  return Object.freeze({
    days,
    previousStart,
    currentStart,
    currentEnd,
  });
}

/**
 * Reduces database aggregate rows to the exact status/date/count schema the
 * drift guard accepts. Invalid rows are ignored rather than displayed.
 */
export function normalizeCandidateBoundVerificationMetricRows(rows = []) {
  if (!Array.isArray(rows)) return Object.freeze([]);

  return Object.freeze(rows.reduce((normalized, row) => {
    const observedOn = dateOnly(row?.observed_on ?? row?.observedOn);
    const statusId = row?.status_id ?? row?.statusId;
    const outcomeCount = positiveInteger(row?.outcome_count ?? row?.outcomeCount);

    if (observedOn && VALID_STATUS_IDS.has(statusId) && outcomeCount) {
      normalized.push(Object.freeze({ observedOn, statusId, outcomeCount }));
    }

    return normalized;
  }, []));
}

export {
  CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_VERSION,
};
