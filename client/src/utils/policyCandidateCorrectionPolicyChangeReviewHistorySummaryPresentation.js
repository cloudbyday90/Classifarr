/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { POLICY_CHANGE_DECISION_OPTIONS } from './policyCandidateCorrectionPolicyChangeDecisionRecordPresentation'

const VERSION = 'policy.candidate_correction_policy_change_review_history_summary.v1'
const STATUS_IDS = Object.freeze({
  COLLECTING: 'collecting',
  AVAILABLE: 'available',
})
const PERIOD_IDS = Object.freeze([
  'most_recent_completed',
  'previous_completed',
  'earlier_completed',
])
const PERIOD_LABELS = Object.freeze({
  most_recent_completed: 'Most recent completed 30-day period',
  previous_completed: 'Previous completed 30-day period',
  earlier_completed: 'Earlier completed 30-day period',
})
const DECISION_IDS = POLICY_CHANGE_DECISION_OPTIONS.map(option => option.id)
const DECISION_LABELS = new Map(POLICY_CHANGE_DECISION_OPTIONS.map(option => [option.id, option.label]))

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function normalizeNonNegativeInteger(value) {
  const numeric = Number(value)
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null
}

function normalizeConclusionSummary(value) {
  const source = asPlainObject(value)
  const decisionId = source?.decisionId
  const recordedCount = normalizeNonNegativeInteger(source?.recordedCount)
  const revisedCount = normalizeNonNegativeInteger(source?.revisedCount)
  const totalCount = normalizeNonNegativeInteger(source?.totalCount)
  if (!source || !DECISION_IDS.includes(decisionId) || recordedCount === null || revisedCount === null ||
      totalCount !== recordedCount + revisedCount) return null
  return Object.freeze({ decisionId, recordedCount, revisedCount, totalCount })
}

function normalizePeriod(value, expectedPeriodId) {
  const source = asPlainObject(value)
  if (!source || source.periodId !== expectedPeriodId || !Array.isArray(source.conclusionSummaries) ||
      source.conclusionSummaries.length !== DECISION_IDS.length) return null
  const summaries = source.conclusionSummaries.map(normalizeConclusionSummary)
  if (summaries.some(summary => !summary) || summaries.some((summary, index) => summary.decisionId !== DECISION_IDS[index])) {
    return null
  }
  return Object.freeze({ periodId: expectedPeriodId, conclusionSummaries: Object.freeze(summaries) })
}

/** Drops period dates, unknown properties, and malformed dimensions before rendering. */
export function normalizePolicyCandidateCorrectionPolicyChangeReviewHistorySummary(value) {
  const source = asPlainObject(value)
  if (!source || source.version !== VERSION || !Object.values(STATUS_IDS).includes(source.statusId) ||
      typeof source.historyAvailable !== 'boolean' || source.automaticPolicyChange !== false ||
      source.automaticAiRagTuning !== false || source.routingChanged !== false || !Array.isArray(source.periods)) {
    return null
  }

  if (source.statusId === STATUS_IDS.COLLECTING) {
    return source.historyAvailable === false && source.periods.length === 0
      ? Object.freeze({ statusId: source.statusId, historyAvailable: false, periods: Object.freeze([]) })
      : null
  }

  if (source.statusId !== STATUS_IDS.AVAILABLE || source.historyAvailable !== true ||
      source.periods.length === 0 || source.periods.length > PERIOD_IDS.length) return null
  const periods = source.periods.map((period, index) => normalizePeriod(period, PERIOD_IDS[index]))
  return periods.some(period => !period)
    ? null
    : Object.freeze({ statusId: source.statusId, historyAvailable: true, periods: Object.freeze(periods) })
}

export function getPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryPresentation(statusId) {
  if (statusId === STATUS_IDS.COLLECTING) return Object.freeze({
    heading: 'Review history is collecting its first complete period',
    message: 'Only completed 30-day aggregate periods appear here. No individual policy, media, actor, or outcome history is retained.',
    statusClass: 'text-gray-300',
  })
  if (statusId === STATUS_IDS.AVAILABLE) return Object.freeze({
    heading: 'Completed review activity is available',
    message: 'These are coarse workflow counts, not proof that a policy caused a result. They cannot change policy, AI, RAG, or routing.',
    statusClass: 'text-blue-300',
  })
  return null
}

export function presentPolicyCandidateCorrectionPolicyChangeReviewHistoryPeriod(value) {
  const source = asPlainObject(value)
  const label = PERIOD_LABELS[source?.periodId]
  if (!source || !label || !Array.isArray(source.conclusionSummaries)) return null
  const conclusionSummaries = source.conclusionSummaries.map(summary => {
    const normalized = normalizeConclusionSummary(summary)
    const decisionLabel = DECISION_LABELS.get(normalized?.decisionId)
    return normalized && decisionLabel ? Object.freeze({ ...normalized, decisionLabel }) : null
  })
  return conclusionSummaries.some(summary => !summary)
    ? null
    : Object.freeze({ label, conclusionSummaries: Object.freeze(conclusionSummaries) })
}

export { STATUS_IDS as POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_STATUS_IDS }
