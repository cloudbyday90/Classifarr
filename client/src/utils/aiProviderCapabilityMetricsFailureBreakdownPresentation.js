/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const AI_PROVIDER_CAPABILITY_METRICS_FAILURE_BREAKDOWN_VERSION =
  'ai.provider_capability_metrics_failure_breakdown.v1'

const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+$/

const STAGE_DETAILS = Object.freeze([
  Object.freeze({ id: 'metric_persistence_write', label: 'Metric persistence write' }),
])

const SQLSTATE_CATEGORY_DETAILS = Object.freeze([
  Object.freeze({ id: 'connection_exception', label: 'Connection exception' }),
  Object.freeze({ id: 'transaction_rollback', label: 'Transaction rollback' }),
  Object.freeze({ id: 'insufficient_resources', label: 'Insufficient resources' }),
  Object.freeze({ id: 'operator_intervention', label: 'Operator intervention' }),
  Object.freeze({ id: 'system_error', label: 'Database system error' }),
  Object.freeze({ id: 'other_database_condition', label: 'Other database condition' }),
  Object.freeze({ id: 'not_available', label: 'No SQLSTATE available' }),
])

const NOT_VISIBLE = Object.freeze({
  isVisible: false,
  statusId: 'not_visible',
  heading: '',
  message: '',
  totalFailureCount: '0',
  safeCategoryFailureCount: '0',
  uncategorizedFailureCount: '0',
  stages: Object.freeze([]),
  sqlstateCategories: Object.freeze([]),
})

function normalizeNonNegativeDecimal(value) {
  const normalized = String(value ?? '').trim()
  return NON_NEGATIVE_DECIMAL_PATTERN.test(normalized)
    ? normalized.replace(/^0+(?=\d)/, '')
    : '0'
}

function addNonNegativeDecimals(values) {
  return values.reduce((total, value) => total + BigInt(normalizeNonNegativeDecimal(value)), 0n).toString()
}

function subtractNonNegativeDecimals(minuend, subtrahend) {
  const difference = BigInt(normalizeNonNegativeDecimal(minuend))
    - BigInt(normalizeNonNegativeDecimal(subtrahend))
  return (difference > 0n ? difference : 0n).toString()
}

function countForId(values, id) {
  const match = Array.isArray(values) ? values.find(value => value?.id === id) : null
  return normalizeNonNegativeDecimal(match?.count)
}

function buildFixedCounts(values, details) {
  return Object.freeze(details.map(({ id, label }) => Object.freeze({
    id,
    label,
    count: countForId(values, id),
  })))
}

function resolveStatusId(totalFailureCount, safeCategoryFailureCount) {
  if (totalFailureCount === '0') return 'not_applicable'
  if (safeCategoryFailureCount === totalFailureCount) return 'complete'
  if (safeCategoryFailureCount === '0') return 'awaiting_safe_categories'
  return 'partial'
}

function buildStatusDetails(statusId) {
  const details = {
    complete: {
      heading: 'Safe persistence-failure categories',
      message: 'Each recent warning has a fixed persistence stage and bounded database condition class. This is diagnostic only.',
    },
    partial: {
      heading: 'Safe persistence-failure categories are partial',
      message: 'Some recent warnings have fixed categories. Remaining warnings stay aggregate-only, so no raw diagnostic is inferred.',
    },
    awaiting_safe_categories: {
      heading: 'Safe persistence-failure categories are pending',
      message: 'Recent warnings do not yet carry the fixed category labels. New warning records add them automatically; existing records remain aggregate-only.',
    },
    unavailable: {
      heading: 'Safe persistence-failure categories unavailable',
      message: 'Classifarr could not validate the fixed category aggregate. AI, policies, and routing are unchanged.',
    },
  }
  return details[statusId] || details.unavailable
}

/**
 * Accepts only the versioned, count-only aggregate contract. The UI derives
 * all labels locally and refuses unknown arrays, status prose, or dimensions.
 */
export function buildAiProviderCapabilityMetricsFailureBreakdownPresentation(report = null) {
  if (report?.version !== AI_PROVIDER_CAPABILITY_METRICS_FAILURE_BREAKDOWN_VERSION
    || report?.window?.hours !== 24) {
    return NOT_VISIBLE
  }

  const totalFailureCount = normalizeNonNegativeDecimal(report.totalFailureCount)
  if (totalFailureCount === '0') return NOT_VISIBLE

  const stages = buildFixedCounts(report.stages, STAGE_DETAILS)
  const sqlstateCategories = buildFixedCounts(report.sqlstateCategories, SQLSTATE_CATEGORY_DETAILS)
  const safeCategoryFailureCount = addNonNegativeDecimals(
    sqlstateCategories.map(category => category.count),
  )
  const uncategorizedFailureCount = subtractNonNegativeDecimals(
    totalFailureCount,
    safeCategoryFailureCount,
  )
  const expectedStatusId = resolveStatusId(totalFailureCount, safeCategoryFailureCount)
  const stageCount = BigInt(stages[0].count)
  const totalCount = BigInt(totalFailureCount)
  const safeCategoryCount = BigInt(safeCategoryFailureCount)
  const hasCoherentContract = safeCategoryCount <= totalCount
    && stageCount <= totalCount
    && stageCount >= safeCategoryCount
    && normalizeNonNegativeDecimal(report.safeCategoryFailureCount) === safeCategoryFailureCount
    && normalizeNonNegativeDecimal(report.uncategorizedFailureCount) === uncategorizedFailureCount
    && report?.status?.id === expectedStatusId
  const statusId = hasCoherentContract ? expectedStatusId : 'unavailable'
  const status = buildStatusDetails(statusId)

  return Object.freeze({
    isVisible: true,
    statusId,
    ...status,
    totalFailureCount,
    safeCategoryFailureCount: hasCoherentContract ? safeCategoryFailureCount : '0',
    uncategorizedFailureCount: hasCoherentContract ? uncategorizedFailureCount : totalFailureCount,
    stages: hasCoherentContract ? stages : Object.freeze([]),
    sqlstateCategories: hasCoherentContract
      ? Object.freeze(sqlstateCategories.filter(category => category.count !== '0'))
      : Object.freeze([]),
  })
}
