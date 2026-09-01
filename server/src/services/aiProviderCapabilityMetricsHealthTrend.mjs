/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { buildCompletedUtcDayMetricsWindow } from './completedUtcDayMetricsWindow.mjs';

export const AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_VERSION =
  'ai.provider_capability_metrics_health_trend.v1';
export const AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_WINDOW_DAYS = 1;
export const AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_PERIOD_IDS = Object.freeze([
  'baseline',
  'previous',
  'current',
]);

const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+$/;
const PERIOD_ID_SET = new Set(AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_PERIOD_IDS);

function normalizeNonNegativeDecimal(value) {
  const normalized = String(value ?? '').trim();
  if (!NON_NEGATIVE_DECIMAL_PATTERN.test(normalized)) return '0';

  return normalized.replace(/^0+(?=\d)/, '');
}

function hasObservations(value) {
  return normalizeNonNegativeDecimal(value) !== '0';
}

function normalizeTimestamp(value) {
  if (!value) return null;

  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function normalizePeriodRow(row, window) {
  if (!PERIOD_ID_SET.has(row?.period_id ?? row?.periodId)) return null;

  return Object.freeze({
    id: row.period_id ?? row.periodId,
    startAt: normalizeTimestamp(window?.start),
    endAt: normalizeTimestamp(window?.end),
    activeMetricStreamCount: normalizeNonNegativeDecimal(
      row?.active_metric_stream_count ?? row?.activeMetricStreamCount,
    ),
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
    activeMetricStreamCount: '0',
    persistenceFailureCount: '0',
  });
}

function buildTrendStatus(periods) {
  const [baseline, previous, current] = periods;
  const baselineHasFailure = hasObservations(baseline.persistenceFailureCount);
  const previousHasFailure = hasObservations(previous.persistenceFailureCount);
  const currentHasFailure = hasObservations(current.persistenceFailureCount);
  const hasAnyActivity = periods.some((period) => (
    hasObservations(period.activeMetricStreamCount) || hasObservations(period.persistenceFailureCount)
  ));

  if (!hasAnyActivity) {
    return Object.freeze({
      id: 'no_data',
      label: 'No completed capability telemetry data',
      message: 'No capability-metric stream or persistence warning was recorded in any of the last three completed UTC days.',
      guidance: Object.freeze([
        'This is a telemetry-observation gap, not an AI availability or routing verdict.',
      ]),
    });
  }

  if (currentHasFailure && previousHasFailure) {
    return Object.freeze({
      id: 'persistent_persistence_failures',
      label: 'Persistence warnings are persistent',
      message: 'Capability-metric persistence warnings were recorded in each of the two most recent completed UTC days.',
      guidance: Object.freeze([
        'Review protected Error Logs if this pattern continues after successful AI requests.',
        'This trend is observational only and cannot affect classification or routing.',
      ]),
    });
  }

  if (currentHasFailure && !previousHasFailure && !baselineHasFailure) {
    return Object.freeze({
      id: 'newly_observed_persistence_failures',
      label: 'Persistence warnings are newly observed',
      message: 'Capability-metric persistence warnings appeared in the latest completed UTC day after two quiet completed days.',
      guidance: Object.freeze([
        'Observe the next completed window before treating this as a persistent operational issue.',
        'This trend is observational only and cannot affect classification or routing.',
      ]),
    });
  }

  if (!currentHasFailure && previousHasFailure) {
    return Object.freeze({
      id: 'persistence_failures_cleared',
      label: 'Persistence warnings have cleared',
      message: 'The latest completed UTC day recorded no capability-metric persistence warning after a warning in the preceding day.',
      guidance: Object.freeze([
        'Continue observing the fixed aggregate; this does not prove that the underlying condition cannot recur.',
      ]),
    });
  }

  if (currentHasFailure && !previousHasFailure && baselineHasFailure) {
    return Object.freeze({
      id: 'recurring_persistence_failures',
      label: 'Persistence warnings have recurred',
      message: 'Capability-metric persistence warnings returned after one quiet completed UTC day.',
      guidance: Object.freeze([
        'Review protected Error Logs if this intermittent pattern continues after successful AI requests.',
        'This trend is observational only and cannot affect classification or routing.',
      ]),
    });
  }

  return Object.freeze({
    id: 'no_active_persistence_failure_trend',
    label: 'No active persistence-warning trend',
    message: 'The latest completed UTC day recorded no capability-metric persistence warning.',
    guidance: Object.freeze([
      'This summary describes retained telemetry only; it is not provider-admission or strict-verification evidence.',
    ]),
  });
}

/**
 * Builds three equal, adjacent, server-owned completed UTC-day windows. Unlike
 * the timely 24-hour health status, this intentionally excludes the in-flight
 * day so adjacent observations never overlap or change during a refresh.
 */
export function buildAiProviderCapabilityMetricsHealthTrendWindow({ now = new Date() } = {}) {
  const current = buildCompletedUtcDayMetricsWindow({
    windowDays: AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_WINDOW_DAYS,
    now,
  });
  const previousEnd = new Date(current.start);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - current.days);
  const baselineEnd = new Date(previousStart);
  const baselineStart = new Date(baselineEnd);
  baselineStart.setUTCDate(baselineStart.getUTCDate() - current.days);

  return Object.freeze({
    days: current.days,
    periodCount: AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_PERIOD_IDS.length,
    start: baselineStart,
    end: current.end,
    periods: Object.freeze([
      Object.freeze({ id: 'baseline', days: current.days, start: baselineStart, end: baselineEnd }),
      Object.freeze({ id: 'previous', days: current.days, start: previousStart, end: previousEnd }),
      Object.freeze({ id: 'current', days: current.days, start: current.start, end: current.end }),
    ]),
  });
}

/**
 * Converts exactly three fixed aggregate rows into a status-only, versioned
 * trend. It discards provider/model dimensions, raw errors, and every
 * database-sourced string other than allow-listed period IDs and counts.
 */
export function buildAiProviderCapabilityMetricsHealthTrendReport({ rows = [], window = null } = {}) {
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
    const normalized = normalizePeriodRow(rowsById.get(id), period);
    return normalized || buildMissingPeriod(period || { id, start: null, end: null });
  });

  return Object.freeze({
    version: AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_VERSION,
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
    status: buildTrendStatus(periods),
  });
}
