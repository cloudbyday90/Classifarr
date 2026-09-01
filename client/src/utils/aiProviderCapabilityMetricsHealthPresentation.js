/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const AI_PROVIDER_CAPABILITY_METRICS_HEALTH_VERSION =
  'ai.provider_capability_metrics_health.v1'

const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+$/

const STATUS_DETAILS = Object.freeze({
  persistence_failures_detected: Object.freeze({
    label: 'Capability telemetry needs attention',
    className: 'border-amber-800/70 bg-amber-950/10',
    badgeClassName: 'border-amber-700/70 bg-amber-950/30 text-amber-100',
    badgeLabel: 'Needs attention',
    message: 'Recent capability-metric persistence warnings were recorded. AI results, policies, and routing remain unchanged.',
    guidance: Object.freeze([
      'Review Error Logs if warnings continue after a successful AI request.',
      'This signal is observational only and cannot affect classification or routing.',
    ]),
  }),
  operational: Object.freeze({
    label: 'Capability telemetry is recording',
    className: 'border-green-800/70 bg-green-950/10',
    badgeClassName: 'border-green-700/70 bg-green-950/30 text-green-100',
    badgeLabel: 'Recording',
    message: 'Recent aggregate capability observations were persisted without a recorded persistence warning.',
    guidance: Object.freeze([
      'This signal describes telemetry persistence, not provider or strict-verification admission.',
    ]),
  }),
  no_recent_activity: Object.freeze({
    label: 'No recent capability telemetry activity',
    className: 'border-gray-700 bg-gray-800/30',
    badgeClassName: 'border-gray-600 bg-gray-800 text-gray-200',
    badgeLabel: 'No recent data',
    message: 'No capability-metric stream or persistence warning was observed in the last 24 hours. This is not an AI availability verdict.',
    guidance: Object.freeze([
      'The next eligible AI result will refresh this aggregate automatically.',
    ]),
  }),
  unavailable: Object.freeze({
    label: 'Capability telemetry status unavailable',
    className: 'border-amber-800/70 bg-amber-950/10',
    badgeClassName: 'border-amber-700/70 bg-amber-950/30 text-amber-100',
    badgeLabel: 'Unavailable',
    message: 'Classifarr could not read the aggregate capability-telemetry status. AI results, policies, and routing are unchanged.',
    guidance: Object.freeze([
      'Refresh the AI readiness view or review Error Logs if this persists.',
    ]),
  }),
})

function normalizeNonNegativeDecimal(value) {
  const normalized = String(value ?? '').trim()
  return NON_NEGATIVE_DECIMAL_PATTERN.test(normalized)
    ? normalized.replace(/^0+(?=\d)/, '')
    : '0'
}

function normalizeTimestamp(value) {
  const timestamp = value ? new Date(value) : null
  return timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null
}

function hasObservations(value) {
  return normalizeNonNegativeDecimal(value) !== '0'
}

function resolveStatusId(report, activeMetricStreamCount, persistenceFailureCount) {
  if (hasObservations(persistenceFailureCount)
    && report?.status?.id === 'persistence_failures_detected') {
    return 'persistence_failures_detected'
  }

  if (!hasObservations(persistenceFailureCount)
    && hasObservations(activeMetricStreamCount)
    && report?.status?.id === 'operational') {
    return 'operational'
  }

  if (!hasObservations(persistenceFailureCount)
    && !hasObservations(activeMetricStreamCount)
    && report?.status?.id === 'no_recent_activity') {
    return 'no_recent_activity'
  }

  return 'unavailable'
}

/**
 * Keeps database/API strings away from the AI settings surface. The UI accepts
 * only the versioned count/timestamp contract plus a coherent fixed status.
 */
export function buildAiProviderCapabilityMetricsHealthPresentation(report = null) {
  const activeMetricStreamCount = normalizeNonNegativeDecimal(report?.activeMetricStreamCount)
  const persistenceFailureCount = normalizeNonNegativeDecimal(report?.persistenceFailureCount)
  const statusId = report?.version === AI_PROVIDER_CAPABILITY_METRICS_HEALTH_VERSION
    ? resolveStatusId(report, activeMetricStreamCount, persistenceFailureCount)
    : 'unavailable'

  return Object.freeze({
    statusId,
    ...STATUS_DETAILS[statusId],
    windowHours: 24,
    activeMetricStreamCount,
    persistenceFailureCount,
    lastPersistedAt: normalizeTimestamp(report?.lastPersistedAt),
    lastFailureAt: normalizeTimestamp(report?.lastFailureAt),
  })
}
