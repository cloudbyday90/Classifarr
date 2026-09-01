/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const AI_PROVIDER_CAPABILITY_METRICS_FAILURE_RECENCY_VERSION =
  'ai.provider_capability_metrics_failure_recency.v1'

const PERIOD_IDS = Object.freeze(['baseline', 'previous', 'current'])
const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+$/
const NOT_VISIBLE = Object.freeze({
  isVisible: false,
  statusId: 'not_visible',
  heading: '',
  message: '',
})

const RECENCY_DETAILS = Object.freeze({
  warning_in_latest_completed_day: Object.freeze({
    completedDaysSinceLastWarning: 0,
    heading: 'Warning recorded in the latest completed day',
    message: 'A persistence warning was retained in the latest completed UTC day. The rolling capability-telemetry summary remains the current operational signal.',
  }),
  cleared_for_one_completed_day: Object.freeze({
    completedDaysSinceLastWarning: 1,
    heading: 'Warning cleared in the latest completed day',
    message: 'The latest completed UTC day had no retained warning; the preceding completed day did. This is aggregate history, not a current health decision.',
  }),
  older_completed_warning_only: Object.freeze({
    completedDaysSinceLastWarning: 2,
    heading: 'Only an older completed-day warning remains',
    message: 'The two latest completed UTC days had no retained warning. The oldest fixed aggregate remains visible only as recent context.',
  }),
})

function parseNonNegativeDecimal(value) {
  const normalized = String(value ?? '').trim()
  if (!NON_NEGATIVE_DECIMAL_PATTERN.test(normalized)) return null

  return normalized.replace(/^0+(?=\d)/, '')
}

function buildPeriods(rows) {
  const rowsById = new Map(Array.isArray(rows) ? rows.map(row => [row?.id, row]) : [])
  if (!Array.isArray(rows) || rows.length !== PERIOD_IDS.length || rowsById.size !== PERIOD_IDS.length
    || !PERIOD_IDS.every(id => rowsById.has(id))) {
    return null
  }

  const periods = PERIOD_IDS.map((id) => {
    const persistenceFailureCount = parseNonNegativeDecimal(rowsById.get(id)?.persistenceFailureCount)
    return persistenceFailureCount === null
      ? null
      : Object.freeze({ id, persistenceFailureCount })
  })

  return periods.some(period => period === null) ? null : Object.freeze(periods)
}

function deriveRecency(periods) {
  for (let index = periods.length - 1; index >= 0; index -= 1) {
    if (periods[index].persistenceFailureCount === '0') continue

    const completedDaysSinceLastWarning = periods.length - 1 - index
    const id = Object.entries(RECENCY_DETAILS).find(([, detail]) => (
      detail.completedDaysSinceLastWarning === completedDaysSinceLastWarning
    ))?.[0]
    return id ? Object.freeze({ id, completedDaysSinceLastWarning }) : null
  }

  return null
}

/**
 * Validates the fixed count-only recency contract locally. Server prose and
 * all unknown fields are ignored, while malformed counts, periods, or age-band
 * claims fail closed rather than becoming a potentially misleading status.
 */
export function buildAiProviderCapabilityMetricsFailureRecencyPresentation(report = null) {
  if (report?.version !== AI_PROVIDER_CAPABILITY_METRICS_FAILURE_RECENCY_VERSION
    || report?.window?.days !== 1
    || report?.window?.periodCount !== PERIOD_IDS.length) {
    return NOT_VISIBLE
  }

  const periods = buildPeriods(report?.periods)
  if (!periods) {
    return Object.freeze({
      isVisible: true,
      statusId: 'unavailable',
      heading: 'Completed-window warning recency unavailable',
      message: 'Classifarr could not validate this fixed aggregate. AI, policies, RAG, and routing are unchanged.',
    })
  }

  const expectedRecency = deriveRecency(periods)
  if (!expectedRecency) return NOT_VISIBLE

  const isCoherent = report?.recency?.id === expectedRecency.id
    && report?.recency?.completedDaysSinceLastWarning === expectedRecency.completedDaysSinceLastWarning
    && report?.status?.id === expectedRecency.id
  if (!isCoherent) {
    return Object.freeze({
      isVisible: true,
      statusId: 'unavailable',
      heading: 'Completed-window warning recency unavailable',
      message: 'Classifarr could not validate this fixed aggregate. AI, policies, RAG, and routing are unchanged.',
    })
  }

  return Object.freeze({
    isVisible: true,
    statusId: expectedRecency.id,
    ...RECENCY_DETAILS[expectedRecency.id],
  })
}
