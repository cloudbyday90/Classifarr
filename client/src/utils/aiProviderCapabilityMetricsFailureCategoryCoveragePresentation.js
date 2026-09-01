/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const AI_PROVIDER_CAPABILITY_METRICS_FAILURE_CATEGORY_COVERAGE_VERSION =
  'ai.provider_capability_metrics_failure_category_coverage.v1'

const PERIOD_DETAILS = Object.freeze([
  Object.freeze({ id: 'baseline', label: 'Oldest completed day' }),
  Object.freeze({ id: 'previous', label: 'Previous completed day' }),
  Object.freeze({ id: 'current', label: 'Latest completed day' }),
])
const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+$/

const NOT_VISIBLE = Object.freeze({
  isVisible: false,
  statusId: 'not_visible',
  heading: '',
  message: '',
  periods: Object.freeze([]),
})

function normalizeNonNegativeDecimal(value) {
  const normalized = String(value ?? '').trim()
  return NON_NEGATIVE_DECIMAL_PATTERN.test(normalized)
    ? normalized.replace(/^0+(?=\d)/, '')
    : '0'
}

function calculateCoveragePercent(safeCategoryFailureCount, totalFailureCount) {
  const safeCount = BigInt(normalizeNonNegativeDecimal(safeCategoryFailureCount))
  const totalCount = BigInt(normalizeNonNegativeDecimal(totalFailureCount))
  if (totalCount === 0n || safeCount > totalCount) return null

  return ((safeCount * 100n + (totalCount / 2n)) / totalCount).toString()
}

function buildPeriods(rows) {
  return Object.freeze(PERIOD_DETAILS.map(({ id, label }) => {
    const row = Array.isArray(rows) ? rows.find(period => period?.id === id) : null
    const totalFailureCount = normalizeNonNegativeDecimal(row?.totalFailureCount)
    const safeCategoryFailureCount = normalizeNonNegativeDecimal(row?.safeCategoryFailureCount)
    const safeCategoryCoveragePercent = calculateCoveragePercent(
      safeCategoryFailureCount,
      totalFailureCount,
    )

    return Object.freeze({
      id,
      label,
      totalFailureCount,
      safeCategoryFailureCount,
      safeCategoryCoveragePercent,
    })
  }))
}

function resolveStatusId(periods) {
  const current = periods.at(-1)
  const hasCompletedWarning = periods.some(period => period.totalFailureCount !== '0')
  if (!hasCompletedWarning) return 'no_completed_persistence_warnings'
  if (current.totalFailureCount === '0') return 'no_current_completed_persistence_warnings'
  if (current.safeCategoryFailureCount === current.totalFailureCount) return 'complete'
  if (current.safeCategoryFailureCount === '0') return 'awaiting_safe_categories'
  return 'partial'
}

function buildStatusDetails(statusId) {
  const details = {
    complete: {
      heading: 'Completed-window safe category coverage',
      message: 'Every warning in the latest completed UTC day retained fixed safe categories. This measures telemetry metadata only.',
    },
    partial: {
      heading: 'Completed-window safe category coverage is partial',
      message: 'Some warnings in the latest completed UTC day retained fixed categories. Older or uncategorized warnings remain aggregate-only.',
    },
    awaiting_safe_categories: {
      heading: 'Completed-window safe category coverage is pending',
      message: 'The latest completed-day warnings did not retain fixed categories. New warnings add them automatically; historic records remain aggregate-only.',
    },
    no_current_completed_persistence_warnings: {
      heading: 'No latest completed-window warning',
      message: 'The latest completed UTC day had no persistence warning. Earlier completed days remain shown only as category-contract adoption context.',
    },
    unavailable: {
      heading: 'Completed-window safe category coverage unavailable',
      message: 'Classifarr could not validate this fixed aggregate. AI, policies, RAG, and routing are unchanged.',
    },
  }
  return details[statusId] || details.unavailable
}

function hasCoherentPeriod(row, period) {
  const totalCount = BigInt(period.totalFailureCount)
  const safeCount = BigInt(period.safeCategoryFailureCount)
  return safeCount <= totalCount
    && row?.safeCategoryCoveragePercent === period.safeCategoryCoveragePercent
}

/**
 * Consumes only the fixed count-only coverage contract. The UI ignores
 * server-provided prose and refuses unknown periods or incoherent aggregates,
 * so raw diagnostics can never cross this presentation boundary.
 */
export function buildAiProviderCapabilityMetricsFailureCategoryCoveragePresentation(report = null) {
  if (report?.version !== AI_PROVIDER_CAPABILITY_METRICS_FAILURE_CATEGORY_COVERAGE_VERSION
    || report?.window?.days !== 1
    || report?.window?.periodCount !== PERIOD_DETAILS.length
    || !Array.isArray(report?.periods)) {
    return NOT_VISIBLE
  }

  const periods = buildPeriods(report.periods)
  const reportPeriodsById = new Map(report.periods.map(period => [period?.id, period]))
  const hasOnlyFixedPeriods = report.periods.length === PERIOD_DETAILS.length
    && reportPeriodsById.size === PERIOD_DETAILS.length
    && PERIOD_DETAILS.every(({ id }) => reportPeriodsById.has(id))
  const hasCoherentContract = hasOnlyFixedPeriods
    && periods.every(period => hasCoherentPeriod(reportPeriodsById.get(period.id), period))
  const hasCompletedWarning = periods.some(period => period.totalFailureCount !== '0')
  if (!hasCompletedWarning) return NOT_VISIBLE

  const expectedStatusId = resolveStatusId(periods)
  const statusId = hasCoherentContract && report?.status?.id === expectedStatusId
    ? expectedStatusId
    : 'unavailable'
  const status = buildStatusDetails(statusId)

  return Object.freeze({
    isVisible: true,
    statusId,
    ...status,
    periods: hasCoherentContract ? periods : Object.freeze([]),
  })
}
