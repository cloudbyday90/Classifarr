/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  normalizePolicyCandidateCorrectionCalibrationReadiness,
} from './policyCandidateCorrectionCalibrationReadinessPresentation'
import {
  normalizePolicyCandidateCorrectionTemporalStability,
} from './policyCandidateCorrectionTemporalStabilityPresentation'
import {
  normalizePolicyCandidateCorrectionCohortComposition,
} from './policyCandidateCorrectionCohortCompositionPresentation'

const METRICS_VERSION = 'policy.candidate_correction_analytics_metrics.v4'

const MARGIN_BAND_PRESENTATIONS = Object.freeze({
  '0_to_4': Object.freeze({ label: '0–4 points', description: 'Very close' }),
  '5_to_14': Object.freeze({ label: '5–14 points', description: 'Close' }),
  '15_to_29': Object.freeze({ label: '15–29 points', description: 'Clear' }),
  '30_or_more': Object.freeze({ label: '30+ points', description: 'Decisive' }),
})

const EVIDENCE_SOURCE_PRESENTATIONS = Object.freeze({
  item_identity: 'Item identity and metadata',
  declared_policy: 'Declared policy',
  observed_library_profile: 'Observed library contents',
  similar_item_retrieval: 'Similar-item retrieval / RAG',
  confirmed_outcomes: 'Confirmed outcomes',
})

const EVIDENCE_STATE_PRESENTATIONS = Object.freeze({
  anchored: 'Anchored',
  supporting: 'Supporting',
  contextual: 'Contextual',
  conflicting: 'Conflicting',
  unavailable: 'Unavailable',
})

const MARGIN_BAND_IDS = Object.keys(MARGIN_BAND_PRESENTATIONS)
const EVIDENCE_SOURCE_IDS = Object.keys(EVIDENCE_SOURCE_PRESENTATIONS)
const EVIDENCE_STATE_IDS = Object.keys(EVIDENCE_STATE_PRESENTATIONS)

function nonnegativeCount(value) {
  const numericValue = Number(value)
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : 0
}

function dateOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function normalizedWindow(value) {
  const days = nonnegativeCount(value?.days)
  const startDate = dateOnly(value?.startDate)
  const endDate = dateOnly(value?.endDate)
  if (!days || !startDate || !endDate || startDate >= endDate) return null

  return Object.freeze({ days, startDate, endDate })
}

function normalizeOutcomeCounts(value) {
  const outcomeCount = nonnegativeCount(value?.outcomeCount)
  const confirmedLeaderOutcomeCount = Math.min(
    outcomeCount,
    nonnegativeCount(value?.confirmedLeaderOutcomeCount),
  )
  const changedToCandidateOutcomeCount = Math.min(
    outcomeCount - confirmedLeaderOutcomeCount,
    nonnegativeCount(value?.changedToCandidateOutcomeCount),
  )
  const changedOutsideCandidatesOutcomeCount = Math.min(
    outcomeCount - confirmedLeaderOutcomeCount - changedToCandidateOutcomeCount,
    nonnegativeCount(value?.changedOutsideCandidatesOutcomeCount),
  )
  const routedNotApplicableOutcomeCount = Math.min(
    outcomeCount - confirmedLeaderOutcomeCount - changedToCandidateOutcomeCount -
      changedOutsideCandidatesOutcomeCount,
    nonnegativeCount(value?.routedNotApplicableOutcomeCount),
  )
  const applicableDecisionCount = confirmedLeaderOutcomeCount +
    changedToCandidateOutcomeCount + changedOutsideCandidatesOutcomeCount
  const changedSelectionOutcomeCount = changedToCandidateOutcomeCount +
    changedOutsideCandidatesOutcomeCount

  return {
    outcomeCount,
    confirmedLeaderOutcomeCount,
    changedToCandidateOutcomeCount,
    changedOutsideCandidatesOutcomeCount,
    routedNotApplicableOutcomeCount,
    applicableDecisionCount,
    changedSelectionOutcomeCount,
    changedSelectionRatePercent: applicableDecisionCount
      ? Math.round((changedSelectionOutcomeCount / applicableDecisionCount) * 1000) / 10
      : 0,
  }
}

function marginBucket(value) {
  const marginBandId = typeof value?.marginBandId === 'string' ? value.marginBandId : null
  const presentation = MARGIN_BAND_PRESENTATIONS[marginBandId]
  if (!presentation) return null

  const outcomeCounts = normalizeOutcomeCounts(value)
  const calibrationReadiness = normalizePolicyCandidateCorrectionCalibrationReadiness(
    value?.calibrationReadiness,
    outcomeCounts,
  )
  if (!calibrationReadiness) return null

  return Object.freeze({
    marginBandId,
    label: presentation.label,
    description: presentation.description,
    ...outcomeCounts,
    calibrationReadiness,
  })
}

function evidenceSourceStateBucket(value) {
  const evidenceSourceId = typeof value?.evidenceSourceId === 'string'
    ? value.evidenceSourceId
    : null
  const evidenceStateId = typeof value?.evidenceStateId === 'string'
    ? value.evidenceStateId
    : null
  if (!EVIDENCE_SOURCE_PRESENTATIONS[evidenceSourceId] ||
      !EVIDENCE_STATE_PRESENTATIONS[evidenceStateId]) {
    return null
  }

  const outcomeCounts = normalizeOutcomeCounts(value)
  const calibrationReadiness = normalizePolicyCandidateCorrectionCalibrationReadiness(
    value?.calibrationReadiness,
    outcomeCounts,
  )
  if (!calibrationReadiness) return null

  return Object.freeze({
    evidenceSourceId,
    evidenceStateId,
    sourceLabel: EVIDENCE_SOURCE_PRESENTATIONS[evidenceSourceId],
    stateLabel: EVIDENCE_STATE_PRESENTATIONS[evidenceStateId],
    ...outcomeCounts,
    calibrationReadiness,
  })
}

function normalizedMarginBuckets(value) {
  const bucketsById = new Map()
  for (const entry of Array.isArray(value) ? value : []) {
    const bucket = marginBucket(entry)
    if (!bucket || bucketsById.has(bucket.marginBandId)) return null
    bucketsById.set(bucket.marginBandId, bucket)
  }

  if (bucketsById.size !== MARGIN_BAND_IDS.length) return null
  return Object.freeze(MARGIN_BAND_IDS.map((marginBandId) => bucketsById.get(marginBandId)))
}

function normalizedEvidenceSourceStateBuckets(value) {
  const bucketsByKey = new Map()
  for (const entry of Array.isArray(value) ? value : []) {
    const bucket = evidenceSourceStateBucket(entry)
    const key = bucket && `${bucket.evidenceSourceId}:${bucket.evidenceStateId}`
    if (!bucket || bucketsByKey.has(key) || bucket.outcomeCount === 0) continue
    bucketsByKey.set(key, bucket)
  }

  return Object.freeze(Array.from(bucketsByKey.values()).sort((left, right) => (
    EVIDENCE_SOURCE_IDS.indexOf(left.evidenceSourceId) -
      EVIDENCE_SOURCE_IDS.indexOf(right.evidenceSourceId) ||
    EVIDENCE_STATE_IDS.indexOf(left.evidenceStateId) -
      EVIDENCE_STATE_IDS.indexOf(right.evidenceStateId)
  )));
}

function normalizedPeriod({
  window,
  marginBuckets: rawMarginBuckets,
  evidenceSourceStateBuckets: rawEvidenceSourceStateBuckets,
  summary: rawSummary,
  calibrationReadiness: rawCalibrationReadiness,
} = {}) {
  const normalizedPeriodWindow = normalizedWindow(window)
  const marginBuckets = normalizedMarginBuckets(rawMarginBuckets)
  const evidenceSourceStateBuckets = normalizedEvidenceSourceStateBuckets(rawEvidenceSourceStateBuckets)
  const summary = normalizeOutcomeCounts(rawSummary)
  const calibrationReadiness = normalizePolicyCandidateCorrectionCalibrationReadiness(
    rawCalibrationReadiness,
    summary,
  )
  if (!normalizedPeriodWindow || !marginBuckets || !calibrationReadiness) return null
  const recomputedSummary = marginBuckets.reduce((total, bucket) => ({
    outcomeCount: total.outcomeCount + bucket.outcomeCount,
    confirmedLeaderOutcomeCount: total.confirmedLeaderOutcomeCount + bucket.confirmedLeaderOutcomeCount,
    changedToCandidateOutcomeCount: total.changedToCandidateOutcomeCount + bucket.changedToCandidateOutcomeCount,
    changedOutsideCandidatesOutcomeCount: total.changedOutsideCandidatesOutcomeCount + bucket.changedOutsideCandidatesOutcomeCount,
    routedNotApplicableOutcomeCount: total.routedNotApplicableOutcomeCount + bucket.routedNotApplicableOutcomeCount,
  }), normalizeOutcomeCounts())
  const normalizedSummary = normalizeOutcomeCounts(recomputedSummary)

  if (summary.outcomeCount !== normalizedSummary.outcomeCount ||
      summary.confirmedLeaderOutcomeCount !== normalizedSummary.confirmedLeaderOutcomeCount ||
      summary.changedToCandidateOutcomeCount !== normalizedSummary.changedToCandidateOutcomeCount ||
      summary.changedOutsideCandidatesOutcomeCount !== normalizedSummary.changedOutsideCandidatesOutcomeCount ||
      summary.routedNotApplicableOutcomeCount !== normalizedSummary.routedNotApplicableOutcomeCount) {
    return null
  }

  return Object.freeze({
    window: normalizedPeriodWindow,
    marginBuckets,
    evidenceSourceStateBuckets,
    summary: Object.freeze(normalizedSummary),
    calibrationReadiness,
    readiness: normalizedSummary.outcomeCount > 0
      ? Object.freeze({
        statusId: 'observing',
        label: 'Correction analytics observations are available',
        message: 'These fixed aggregates describe the original evidence state and later validated operator action. They do not establish correctness or change policy, AI, RAG, learning, or routing.',
      })
      : Object.freeze({
        statusId: 'insufficient_data',
        label: 'Correction analytics needs observations',
        message: 'No eligible operator confirmation or destination-change observations have been recorded in this completed UTC-day window yet.',
      }),
  })
}

/**
 * Accepts only the fixed, aggregate report. Labels and explanatory language
 * are client-owned; row-level identities and unknown server fields are never
 * retained for rendering.
 */
export function normalizePolicyCandidateCorrectionAnalyticsMetricsReport(value) {
  if (value?.version !== METRICS_VERSION) return null

  const current = normalizedPeriod(value)
  const previous = normalizedPeriod({
    window: value?.previousWindow,
    marginBuckets: value?.previousMarginBuckets,
    evidenceSourceStateBuckets: value?.previousEvidenceSourceStateBuckets,
    summary: value?.previousSummary,
    calibrationReadiness: value?.previousCalibrationReadiness,
  })
  if (!current || !previous) return null
  const temporalStability = normalizePolicyCandidateCorrectionTemporalStability(
    value.temporalStability,
    {
      currentSummary: current,
      previousSummary: previous,
      currentMarginBuckets: current.marginBuckets,
      previousMarginBuckets: previous.marginBuckets,
      currentEvidenceSourceStateBuckets: current.evidenceSourceStateBuckets,
      previousEvidenceSourceStateBuckets: previous.evidenceSourceStateBuckets,
    },
  )
  const cohortComposition = normalizePolicyCandidateCorrectionCohortComposition(
    value.cohortComposition,
    {
      currentMarginBuckets: current.marginBuckets,
      previousMarginBuckets: previous.marginBuckets,
      currentEvidenceSourceStateBuckets: current.evidenceSourceStateBuckets,
      previousEvidenceSourceStateBuckets: previous.evidenceSourceStateBuckets,
    },
  )
  if (!temporalStability || !cohortComposition) return null

  return Object.freeze({
    version: METRICS_VERSION,
    ...current,
    previousWindow: previous.window,
    previousMarginBuckets: previous.marginBuckets,
    previousEvidenceSourceStateBuckets: previous.evidenceSourceStateBuckets,
    previousSummary: previous.summary,
    previousCalibrationReadiness: previous.calibrationReadiness,
    temporalStability,
    cohortComposition,
  })
}
