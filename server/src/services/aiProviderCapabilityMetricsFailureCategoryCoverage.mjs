/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_PERIOD_IDS,
  AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_WINDOW_DAYS,
} from './aiProviderCapabilityMetricsHealthTrend.mjs';

export const AI_PROVIDER_CAPABILITY_METRICS_FAILURE_CATEGORY_COVERAGE_VERSION =
  'ai.provider_capability_metrics_failure_category_coverage.v1';

const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+$/;
const PERIOD_ID_SET = new Set(AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_PERIOD_IDS);

function normalizeNonNegativeDecimal(value) {
  const normalized = String(value ?? '').trim();
  if (!NON_NEGATIVE_DECIMAL_PATTERN.test(normalized)) return '0';

  return normalized.replace(/^0+(?=\d)/, '');
}

function normalizeTimestamp(value) {
  if (!value) return null;

  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function calculateCoveragePercent(safeCategoryFailureCount, totalFailureCount) {
  const safeCount = BigInt(normalizeNonNegativeDecimal(safeCategoryFailureCount));
  const totalCount = BigInt(normalizeNonNegativeDecimal(totalFailureCount));
  if (totalCount === 0n || safeCount > totalCount) return null;

  // Nearest whole percent is compact, deterministic, and avoids converting a
  // database aggregate through a lossy JavaScript Number.
  return ((safeCount * 100n + (totalCount / 2n)) / totalCount).toString();
}

function normalizePeriodRow(row, window) {
  const id = row?.period_id ?? row?.periodId;
  if (!PERIOD_ID_SET.has(id)) return null;

  const totalFailureCount = normalizeNonNegativeDecimal(
    row?.total_failure_count ?? row?.totalFailureCount,
  );
  const safeCategoryFailureCount = normalizeNonNegativeDecimal(
    row?.safe_category_failure_count ?? row?.safeCategoryFailureCount,
  );

  return Object.freeze({
    id,
    startAt: normalizeTimestamp(window?.start),
    endAt: normalizeTimestamp(window?.end),
    totalFailureCount,
    safeCategoryFailureCount,
    safeCategoryCoveragePercent: calculateCoveragePercent(
      safeCategoryFailureCount,
      totalFailureCount,
    ),
  });
}

function buildMissingPeriod(period) {
  return Object.freeze({
    id: period.id,
    startAt: normalizeTimestamp(period.start),
    endAt: normalizeTimestamp(period.end),
    totalFailureCount: '0',
    safeCategoryFailureCount: '0',
    safeCategoryCoveragePercent: null,
  });
}

function hasFailures(period) {
  return period.totalFailureCount !== '0';
}

function buildStatus(periods) {
  const current = periods.at(-1);
  const hasCompletedWarning = periods.some(hasFailures);

  if (!hasCompletedWarning) {
    return Object.freeze({
      id: 'no_completed_persistence_warnings',
      label: 'No completed persistence-warning coverage',
      message: 'No capability-metric persistence warning was recorded in the last three completed UTC days.',
    });
  }

  if (!hasFailures(current)) {
    return Object.freeze({
      id: 'no_current_completed_persistence_warnings',
      label: 'No latest completed-window warning',
      message: 'The latest completed UTC day recorded no persistence warning; earlier completed windows remain available for adoption context.',
    });
  }

  if (current.safeCategoryFailureCount === current.totalFailureCount) {
    return Object.freeze({
      id: 'complete',
      label: 'Safe category coverage is complete',
      message: 'Each latest completed-window warning retained the fixed stage and bounded database-condition category.',
    });
  }

  if (current.safeCategoryFailureCount === '0') {
    return Object.freeze({
      id: 'awaiting_safe_categories',
      label: 'Safe category coverage is pending',
      message: 'The latest completed-window warnings predate the fixed category contract or did not retain safe category metadata.',
    });
  }

  return Object.freeze({
    id: 'partial',
    label: 'Safe category coverage is partial',
    message: 'Some latest completed-window warnings retained fixed categories while the remainder stay aggregate-only.',
  });
}

/**
 * Converts three fixed aggregate rows into an adoption-coverage report. It
 * deliberately returns only period IDs, timestamps, counts, and a derived
 * percentage; all provider, model, media, error, and raw metadata fields are
 * discarded before the report is constructed.
 */
export function buildAiProviderCapabilityMetricsFailureCategoryCoverageReport({
  rows = [],
  window = null,
} = {}) {
  const windowsById = new Map(
    Array.isArray(window?.periods)
      ? window.periods.map((period) => [period.id, period])
      : [],
  );
  const rowsById = new Map(
    (Array.isArray(rows) ? rows : []).map((row) => [row?.period_id ?? row?.periodId, row]),
  );
  const periods = AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_PERIOD_IDS.map((id) => {
    const period = windowsById.get(id);
    return normalizePeriodRow(rowsById.get(id), period)
      || buildMissingPeriod(period || { id, start: null, end: null });
  });

  return Object.freeze({
    version: AI_PROVIDER_CAPABILITY_METRICS_FAILURE_CATEGORY_COVERAGE_VERSION,
    window: Object.freeze({
      days: window?.days === AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_WINDOW_DAYS
        ? window.days
        : AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_WINDOW_DAYS,
      periodCount: window?.periodCount === AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_PERIOD_IDS.length
        ? window.periodCount
        : AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_PERIOD_IDS.length,
      startAt: normalizeTimestamp(window?.start),
      endAt: normalizeTimestamp(window?.end),
    }),
    periods: Object.freeze(periods),
    status: buildStatus(periods),
  });
}
