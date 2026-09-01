/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_PERIOD_IDS,
  AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_WINDOW_DAYS,
} from './aiProviderCapabilityMetricsHealthTrend.mjs';

export const AI_PROVIDER_CAPABILITY_METRICS_FAILURE_RECENCY_VERSION =
  'ai.provider_capability_metrics_failure_recency.v1';

const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+$/;
const PERIOD_ID_SET = new Set(AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_PERIOD_IDS);
const RECENCY_DETAILS = Object.freeze([
  Object.freeze({
    id: 'warning_in_latest_completed_day',
    completedDaysSinceLastWarning: 0,
    label: 'Warning recorded in the latest completed day',
    message: 'A persistence warning was retained in the latest completed UTC day.',
  }),
  Object.freeze({
    id: 'cleared_for_one_completed_day',
    completedDaysSinceLastWarning: 1,
    label: 'Warning-free for one completed day',
    message: 'The latest completed UTC day recorded no persistence warning; the preceding completed day did.',
  }),
  Object.freeze({
    id: 'older_completed_warning_only',
    completedDaysSinceLastWarning: 2,
    label: 'Only an older completed-day warning remains',
    message: 'The two latest completed UTC days recorded no persistence warning; only the oldest fixed aggregate did.',
  }),
]);

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

function normalizePeriodRow(row, window) {
  const id = row?.period_id ?? row?.periodId;
  if (!PERIOD_ID_SET.has(id)) return null;

  return Object.freeze({
    id,
    startAt: normalizeTimestamp(window?.start),
    endAt: normalizeTimestamp(window?.end),
    persistenceFailureCount: normalizeNonNegativeDecimal(
      row?.persistence_failure_count ?? row?.persistenceFailureCount,
    ),
  });
}

function buildMissingPeriod(period) {
  return Object.freeze({
    id: period.id,
    startAt: normalizeTimestamp(period.start),
    endAt: normalizeTimestamp(period.end),
    persistenceFailureCount: '0',
  });
}

function hasWarning(period) {
  return period.persistenceFailureCount !== '0';
}

function buildRecency(periods) {
  for (let index = periods.length - 1; index >= 0; index -= 1) {
    if (!hasWarning(periods[index])) continue;

    const completedDaysSinceLastWarning = periods.length - 1 - index;
    const detail = RECENCY_DETAILS[completedDaysSinceLastWarning];
    return Object.freeze({
      id: detail.id,
      completedDaysSinceLastWarning: detail.completedDaysSinceLastWarning,
    });
  }

  return Object.freeze({
    id: 'no_completed_persistence_warnings',
    completedDaysSinceLastWarning: null,
  });
}

function buildStatus(recency) {
  const detail = RECENCY_DETAILS.find(({ id }) => id === recency.id);
  if (detail) {
    return Object.freeze({
      id: detail.id,
      label: detail.label,
      message: detail.message,
    });
  }

  return Object.freeze({
    id: 'no_completed_persistence_warnings',
    label: 'No completed persistence warnings',
    message: 'No capability-metric persistence warning was recorded in the last three completed UTC days.',
  });
}

/**
 * Converts three fixed count-only aggregates into a retained-warning recency
 * signal. The returned age band is based solely on the latest warning-bearing
 * completed UTC day; it is not an incident age, a diagnosis, or a runtime
 * decision input.
 */
export function buildAiProviderCapabilityMetricsFailureRecencyReport({
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
  const recency = buildRecency(periods);

  return Object.freeze({
    version: AI_PROVIDER_CAPABILITY_METRICS_FAILURE_RECENCY_VERSION,
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
    recency,
    status: buildStatus(recency),
  });
}
