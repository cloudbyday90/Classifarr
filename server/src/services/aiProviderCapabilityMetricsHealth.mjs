/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const AI_PROVIDER_CAPABILITY_METRICS_HEALTH_VERSION =
  'ai.provider_capability_metrics_health.v1';
export const AI_PROVIDER_CAPABILITY_METRICS_HEALTH_WINDOW_HOURS = 24;

const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+$/;

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

function hasObservations(value) {
  return normalizeNonNegativeDecimal(value) !== '0';
}

function buildHealthStatus({ activeMetricStreamCount, persistenceFailureCount }) {
  if (hasObservations(persistenceFailureCount)) {
    return Object.freeze({
      id: 'persistence_failures_detected',
      label: 'Capability telemetry needs attention',
      message: 'Recent capability-metric persistence warnings were recorded. AI results, policies, and routing remain unchanged.',
      guidance: Object.freeze([
        'Review Error Logs if warnings continue after a successful AI request.',
        'This signal is observational only and cannot affect classification or routing.',
      ]),
    });
  }

  if (hasObservations(activeMetricStreamCount)) {
    return Object.freeze({
      id: 'operational',
      label: 'Capability telemetry is recording',
      message: 'Recent aggregate capability observations were persisted without a recorded persistence warning.',
      guidance: Object.freeze([
        'This signal describes telemetry persistence, not provider or strict-verification admission.',
      ]),
    });
  }

  return Object.freeze({
    id: 'no_recent_activity',
    label: 'No recent capability telemetry activity',
    message: 'No capability-metric stream or persistence warning was observed in the last 24 hours. This is not an AI availability verdict.',
    guidance: Object.freeze([
      'The next eligible AI result will refresh this aggregate automatically.',
    ]),
  });
}

/**
 * Builds a rolling, server-owned health window. Health needs timely feedback,
 * so it intentionally observes the current rolling period instead of waiting
 * for a completed UTC day. Callers cannot select a range or dimension.
 */
export function buildAiProviderCapabilityMetricsHealthWindow({ now = new Date() } = {}) {
  const end = now instanceof Date ? new Date(now) : new Date(now);
  if (Number.isNaN(end.getTime())) {
    throw new TypeError('A valid capability-metrics health observation time is required.');
  }

  const start = new Date(end.getTime() - (AI_PROVIDER_CAPABILITY_METRICS_HEALTH_WINDOW_HOURS * 60 * 60 * 1000));

  return Object.freeze({
    hours: AI_PROVIDER_CAPABILITY_METRICS_HEALTH_WINDOW_HOURS,
    start,
    end,
  });
}

/**
 * Drops every database-sourced string other than fixed counts and timestamps.
 * The returned status vocabulary is server-owned and has no operational
 * authority over provider admission, classification, policy, RAG, or routing.
 */
export function buildAiProviderCapabilityMetricsHealthReport({ row = null, window = null } = {}) {
  const activeMetricStreamCount = normalizeNonNegativeDecimal(
    row?.active_metric_stream_count ?? row?.activeMetricStreamCount,
  );
  const persistenceFailureCount = normalizeNonNegativeDecimal(
    row?.persistence_failure_count ?? row?.persistenceFailureCount,
  );

  return Object.freeze({
    version: AI_PROVIDER_CAPABILITY_METRICS_HEALTH_VERSION,
    window: Object.freeze({
      hours: window?.hours === AI_PROVIDER_CAPABILITY_METRICS_HEALTH_WINDOW_HOURS
        ? window.hours
        : AI_PROVIDER_CAPABILITY_METRICS_HEALTH_WINDOW_HOURS,
      startAt: normalizeTimestamp(window?.start),
      endAt: normalizeTimestamp(window?.end),
    }),
    activeMetricStreamCount,
    persistenceFailureCount,
    lastPersistedAt: normalizeTimestamp(row?.last_persisted_at ?? row?.lastPersistedAt),
    lastFailureAt: normalizeTimestamp(row?.last_failure_at ?? row?.lastFailureAt),
    status: buildHealthStatus({ activeMetricStreamCount, persistenceFailureCount }),
  });
}
