/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_VERSION =
  'ai.provider_capability_metrics_health_trend.v1'

const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+$/
const PERIODS = Object.freeze([
  Object.freeze({ id: 'baseline', label: 'Earlier completed day' }),
  Object.freeze({ id: 'previous', label: 'Previous completed day' }),
  Object.freeze({ id: 'current', label: 'Latest completed day' }),
])

const STATUS_DETAILS = Object.freeze({
  persistent_persistence_failures: Object.freeze({
    label: 'Persistence warnings are persistent',
    className: 'border-amber-800/70 bg-amber-950/10',
    badgeClassName: 'border-amber-700/70 bg-amber-950/30 text-amber-100',
    badgeLabel: 'Persistent',
    message: 'Capability-metric persistence warnings were recorded in each of the two most recent completed UTC days.',
    guidance: Object.freeze([
      'Review Error Logs if this pattern continues after successful AI requests.',
      'This trend is observational only and cannot affect classification or routing.',
    ]),
  }),
  newly_observed_persistence_failures: Object.freeze({
    label: 'Persistence warnings are newly observed',
    className: 'border-amber-800/70 bg-amber-950/10',
    badgeClassName: 'border-amber-700/70 bg-amber-950/30 text-amber-100',
    badgeLabel: 'Newly observed',
    message: 'Capability-metric persistence warnings appeared in the latest completed UTC day after two quiet completed days.',
    guidance: Object.freeze([
      'Observe the next completed window before treating this as a persistent operational issue.',
      'This trend is observational only and cannot affect classification or routing.',
    ]),
  }),
  persistence_failures_cleared: Object.freeze({
    label: 'Persistence warnings have cleared',
    className: 'border-green-800/70 bg-green-950/10',
    badgeClassName: 'border-green-700/70 bg-green-950/30 text-green-100',
    badgeLabel: 'Cleared',
    message: 'The latest completed UTC day recorded no capability-metric persistence warning after a warning in the preceding day.',
    guidance: Object.freeze([
      'Continue observing the fixed aggregate; this does not prove that the underlying condition cannot recur.',
    ]),
  }),
  recurring_persistence_failures: Object.freeze({
    label: 'Persistence warnings have recurred',
    className: 'border-amber-800/70 bg-amber-950/10',
    badgeClassName: 'border-amber-700/70 bg-amber-950/30 text-amber-100',
    badgeLabel: 'Recurring',
    message: 'Capability-metric persistence warnings returned after one quiet completed UTC day.',
    guidance: Object.freeze([
      'Review Error Logs if this intermittent pattern continues after successful AI requests.',
      'This trend is observational only and cannot affect classification or routing.',
    ]),
  }),
  no_active_persistence_failure_trend: Object.freeze({
    label: 'No active persistence-warning trend',
    className: 'border-gray-700 bg-gray-900/20',
    badgeClassName: 'border-gray-600 bg-gray-800 text-gray-200',
    badgeLabel: 'No active warning',
    message: 'The latest completed UTC day recorded no capability-metric persistence warning.',
    guidance: Object.freeze([
      'This summary describes retained telemetry only; it is not provider-admission or strict-verification evidence.',
    ]),
  }),
  no_data: Object.freeze({
    label: 'No completed capability telemetry data',
    className: 'border-gray-700 bg-gray-900/20',
    badgeClassName: 'border-gray-600 bg-gray-800 text-gray-200',
    badgeLabel: 'No data',
    message: 'No capability-metric stream or persistence warning was recorded in any of the last three completed UTC days.',
    guidance: Object.freeze([
      'This is a telemetry-observation gap, not an AI availability or routing verdict.',
    ]),
  }),
  unavailable: Object.freeze({
    label: 'Capability telemetry trend unavailable',
    className: 'border-amber-800/70 bg-amber-950/10',
    badgeClassName: 'border-amber-700/70 bg-amber-950/30 text-amber-100',
    badgeLabel: 'Unavailable',
    message: 'Classifarr could not read a coherent completed-window capability-telemetry trend. AI results, policies, and routing are unchanged.',
    guidance: Object.freeze([
      'Automatic refresh will try again while this page is visible.',
    ]),
  }),
})

function normalizeNonNegativeDecimal(value) {
  const normalized = String(value ?? '').trim()
  return NON_NEGATIVE_DECIMAL_PATTERN.test(normalized)
    ? normalized.replace(/^0+(?=\d)/, '')
    : '0'
}

function hasObservations(value) {
  return normalizeNonNegativeDecimal(value) !== '0'
}

function normalizePeriods(periods) {
  if (!Array.isArray(periods) || periods.length !== PERIODS.length) return null

  const rowsById = new Map(periods.map(period => [period?.id, period]))
  if (rowsById.size !== PERIODS.length) return null

  const normalized = PERIODS.map((period) => {
    const source = rowsById.get(period.id)
    if (!source) return null

    return Object.freeze({
      ...period,
      activeMetricStreamCount: normalizeNonNegativeDecimal(source.activeMetricStreamCount),
      persistenceFailureCount: normalizeNonNegativeDecimal(source.persistenceFailureCount),
    })
  })

  return normalized.every(Boolean) ? Object.freeze(normalized) : null
}

function expectedStatusId(periods) {
  const [baseline, previous, current] = periods
  const baselineHasFailure = hasObservations(baseline.persistenceFailureCount)
  const previousHasFailure = hasObservations(previous.persistenceFailureCount)
  const currentHasFailure = hasObservations(current.persistenceFailureCount)
  const hasAnyActivity = periods.some(period => (
    hasObservations(period.activeMetricStreamCount) || hasObservations(period.persistenceFailureCount)
  ))

  if (!hasAnyActivity) return 'no_data'
  if (currentHasFailure && previousHasFailure) return 'persistent_persistence_failures'
  if (currentHasFailure && !previousHasFailure && !baselineHasFailure) return 'newly_observed_persistence_failures'
  if (!currentHasFailure && previousHasFailure) return 'persistence_failures_cleared'
  if (currentHasFailure && !previousHasFailure && baselineHasFailure) return 'recurring_persistence_failures'
  return 'no_active_persistence_failure_trend'
}

function emptyPeriods() {
  return Object.freeze(PERIODS.map(period => Object.freeze({
    ...period,
    activeMetricStreamCount: '0',
    persistenceFailureCount: '0',
  })))
}

/**
 * Accepts only the fixed three-period contract and reconstructs all prose in
 * the browser. Provider/model data, raw errors, and database-sourced messages
 * are never passed through to the settings UI.
 */
export function buildAiProviderCapabilityMetricsHealthTrendPresentation(report = null) {
  const periods = normalizePeriods(report?.periods)
  const expected = periods ? expectedStatusId(periods) : null
  const statusId = report?.version === AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_VERSION
    && report?.window?.days === 1
    && report?.window?.periodCount === PERIODS.length
    && expected
    && report?.status?.id === expected
    ? expected
    : 'unavailable'

  return Object.freeze({
    statusId,
    ...STATUS_DETAILS[statusId],
    periods: periods || emptyPeriods(),
  })
}
