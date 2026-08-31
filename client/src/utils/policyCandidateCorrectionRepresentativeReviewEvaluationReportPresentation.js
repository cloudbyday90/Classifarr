/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const VERSION = 'policy.candidate_correction_representative_review_evaluation_report.v1'
const PURPOSE_ID = 'representative_historical_correction_review'
const CONFIDENCE_LEVEL = 0.95
const WILSON_Z = 1.959963984540054
const STATUS_IDS = Object.freeze({
  CONFIGURATION_REQUIRED: 'configuration_required',
  PROJECTION_NOT_CREATED: 'projection_not_created',
  REPORT_AVAILABLE: 'report_available',
})
const PERIOD_IDS = Object.freeze(['previous', 'current'])
const MARGIN_BAND_IDS = Object.freeze(['0_to_4', '5_to_14', '15_to_29', '30_or_more'])
const SELECTION_STATUS_IDS = Object.freeze([
  'confirmed_candidate',
  'changed_to_candidate',
  'changed_outside_candidates',
  'routed_not_applicable',
])
const EVIDENCE_SOURCE_IDS = Object.freeze([
  'item_identity',
  'declared_policy',
  'observed_library_profile',
  'similar_item_retrieval',
  'confirmed_outcomes',
])
const EVIDENCE_STATE_IDS = Object.freeze([
  'anchored',
  'supporting',
  'contextual',
  'conflicting',
  'unavailable',
])

const PERIOD_LABELS = Object.freeze({ previous: 'Previous 28 days', current: 'Current 28 days' })
const MARGIN_LABELS = Object.freeze({
  '0_to_4': '0–4 points',
  '5_to_14': '5–14 points',
  '15_to_29': '15–29 points',
  '30_or_more': '30+ points',
})
const EVIDENCE_LABELS = Object.freeze({
  item_identity: 'Item identity',
  declared_policy: 'Declared policy',
  observed_library_profile: 'Observed library profile',
  similar_item_retrieval: 'Similar-item retrieval',
  confirmed_outcomes: 'Confirmed outcomes',
  anchored: 'Anchored',
  supporting: 'Supporting',
  contextual: 'Contextual',
  conflicting: 'Conflicting',
  unavailable: 'Unavailable',
})

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function normalizeTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null
}

function normalizeCount(value, maximum = 160) {
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric >= 0 && numeric <= maximum ? numeric : null
}

function buildWilsonInterval(successfulCount, totalCount) {
  if (!Number.isInteger(successfulCount) || !Number.isInteger(totalCount) ||
      successfulCount < 0 || totalCount <= 0 || successfulCount > totalCount) return null

  const proportion = successfulCount / totalCount
  const zSquared = WILSON_Z ** 2
  const denominator = 1 + (zSquared / totalCount)
  const center = (proportion + (zSquared / (2 * totalCount))) / denominator
  const margin = (WILSON_Z / denominator) * Math.sqrt(
    (proportion * (1 - proportion) / totalCount) + (zSquared / (4 * totalCount ** 2)),
  )
  return Object.freeze({
    lowerBound: Math.max(0, center - margin),
    upperBound: Math.min(1, center + margin),
  })
}

function normalizeOutcomeCounts(value, itemCount) {
  if (!Array.isArray(value) || value.length !== SELECTION_STATUS_IDS.length) return null
  const countsByStatus = new Map()
  for (const entry of value) {
    const source = asPlainObject(entry)
    const count = normalizeCount(source?.itemCount)
    if (!source || !SELECTION_STATUS_IDS.includes(source.selectionStatusId) || count === null ||
        countsByStatus.has(source.selectionStatusId)) return null
    countsByStatus.set(source.selectionStatusId, count)
  }
  if (countsByStatus.size !== SELECTION_STATUS_IDS.length ||
      [...countsByStatus.values()].reduce((total, count) => total + count, 0) !== itemCount) return null
  return Object.freeze(SELECTION_STATUS_IDS.map(selectionStatusId => Object.freeze({
    selectionStatusId,
    itemCount: countsByStatus.get(selectionStatusId),
  })))
}

function normalizeSummary(value, expectedDimensions) {
  const source = asPlainObject(value)
  const itemCount = normalizeCount(source?.itemCount)
  const confirmedCandidateCount = normalizeCount(source?.confirmedCandidateCount)
  if (!source || itemCount === null || confirmedCandidateCount === null ||
      confirmedCandidateCount > itemCount) return null
  if (Object.entries(expectedDimensions).some(([key, expected]) => source[key] !== expected)) return null
  const selectionOutcomeCounts = normalizeOutcomeCounts(source.selectionOutcomeCounts, itemCount)
  if (!selectionOutcomeCounts) return null

  return Object.freeze({
    ...expectedDimensions,
    itemCount,
    confirmedCandidateCount,
    confirmationRate: itemCount > 0 ? confirmedCandidateCount / itemCount : null,
    confirmationRateInterval95: buildWilsonInterval(confirmedCandidateCount, itemCount),
    selectionOutcomeCounts,
  })
}

function normalizeWindows(value) {
  if (!Array.isArray(value) || value.length !== PERIOD_IDS.length) return null
  const normalized = value.map((entry, index) => {
    const source = asPlainObject(entry)
    const startAt = normalizeTimestamp(source?.startAt)
    const endAt = normalizeTimestamp(source?.endAt)
    return source && source.periodId === PERIOD_IDS[index] && startAt && endAt && startAt < endAt
      ? Object.freeze({ periodId: source.periodId, startAt, endAt })
      : null
  })
  return normalized.some(entry => entry === null) || normalized[0].endAt !== normalized[1].startAt
    ? null
    : Object.freeze(normalized)
}

function normalizeExpectedSummaries(value, expectedDimensions) {
  if (!Array.isArray(value) || value.length !== expectedDimensions.length) return null
  const normalized = value.map((entry, index) => normalizeSummary(entry, expectedDimensions[index]))
  return normalized.some(entry => entry === null) ? null : Object.freeze(normalized)
}

function normalizeReport(value) {
  const source = asPlainObject(value)
  const createdAt = normalizeTimestamp(source?.createdAt)
  const expiresAt = normalizeTimestamp(source?.expiresAt)
  const itemCount = normalizeCount(source?.itemCount)
  const windows = normalizeWindows(source?.windows)
  if (!source || !createdAt || !expiresAt || createdAt >= expiresAt || itemCount === null ||
      source.confidenceLevel !== CONFIDENCE_LEVEL || !windows) return null

  const periodSummaries = normalizeExpectedSummaries(
    source.periodSummaries,
    PERIOD_IDS.map(periodId => ({ periodId })),
  )
  const marginSummaries = normalizeExpectedSummaries(
    source.marginSummaries,
    PERIOD_IDS.flatMap(periodId => MARGIN_BAND_IDS.map(scoreMarginBandId => ({ periodId, scoreMarginBandId }))),
  )
  const evidenceStateSummaries = normalizeExpectedSummaries(
    source.evidenceStateSummaries,
    PERIOD_IDS.flatMap(periodId => EVIDENCE_SOURCE_IDS.flatMap(sourceId => (
      EVIDENCE_STATE_IDS.map(stateId => ({ periodId, sourceId, stateId }))
    ))),
  )
  if (!periodSummaries || !marginSummaries || !evidenceStateSummaries ||
      periodSummaries.reduce((total, summary) => total + summary.itemCount, 0) !== itemCount ||
      marginSummaries.reduce((total, summary) => total + summary.itemCount, 0) !== itemCount) return null

  const previous = periodSummaries[0]
  const current = periodSummaries[1]
  return Object.freeze({
    createdAt,
    expiresAt,
    itemCount,
    windows,
    confidenceLevel: CONFIDENCE_LEVEL,
    periodSummaries,
    marginSummaries,
    evidenceStateSummaries,
    comparison: Object.freeze({
      comparisonType: 'descriptive_only',
      confirmationRatePointDifference: previous.confirmationRate !== null && current.confirmationRate !== null
        ? current.confirmationRate - previous.confirmationRate
        : null,
      message: 'This comparison describes the fixed redacted sample. It cannot authorize policy, AI, RAG, learning, retry, or routing changes.',
    }),
  })
}

/**
 * Drops all unknown report fields, including accidental per-item, media,
 * library, model, prompt, response, or RAG content before Vue renders data.
 */
export function normalizePolicyCandidateCorrectionRepresentativeReviewEvaluationReport(value) {
  const source = asPlainObject(value)
  if (!source || source.version !== VERSION || source.purposeId !== PURPOSE_ID ||
      source.historicalRecordAccess !== false || source.automaticPolicyChange !== false ||
      source.automaticAiRagTuning !== false || !Object.values(STATUS_IDS).includes(source.statusId)) {
    return null
  }
  if ((source.statusId === STATUS_IDS.CONFIGURATION_REQUIRED ||
      source.statusId === STATUS_IDS.PROJECTION_NOT_CREATED) && source.report === null) {
    return Object.freeze({ statusId: source.statusId, report: null })
  }
  if (source.statusId !== STATUS_IDS.REPORT_AVAILABLE) return null
  const report = normalizeReport(source.report)
  return report ? Object.freeze({ statusId: source.statusId, report }) : null
}

export function getPolicyCandidateCorrectionRepresentativeReviewEvaluationReportPresentation(statusId) {
  if (statusId === STATUS_IDS.CONFIGURATION_REQUIRED) {
    return Object.freeze({
      heading: 'Evaluation report waits for safeguards',
      message: 'A report is unavailable until the fixed historic-review safeguards are acknowledged.',
      statusClass: 'text-amber-300',
    })
  }
  if (statusId === STATUS_IDS.PROJECTION_NOT_CREATED) {
    return Object.freeze({
      heading: 'Evaluation report waits for a snapshot',
      message: 'It will refresh automatically when a redacted snapshot is available. It cannot change policy, AI, RAG, or routing.',
      statusClass: 'text-gray-300',
    })
  }
  if (statusId === STATUS_IDS.REPORT_AVAILABLE) {
    return Object.freeze({
      heading: 'Offline evaluation report ready',
      message: 'The report aggregates only the current fixed redacted snapshot and its two completed periods. It is descriptive, not an automatic policy decision.',
      statusClass: 'text-green-400',
    })
  }
  return null
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : 'Not available'
}

export function presentPolicyCandidateCorrectionRepresentativeReviewEvaluationSummary(summary) {
  const source = asPlainObject(summary)
  if (!source || !PERIOD_LABELS[source.periodId] ||
      (source.scoreMarginBandId && !MARGIN_LABELS[source.scoreMarginBandId]) ||
      (source.sourceId && !EVIDENCE_LABELS[source.sourceId]) ||
      (source.stateId && !EVIDENCE_LABELS[source.stateId])) return null
  const interval = source.confirmationRateInterval95
  const intervalLabel = interval
    ? `${formatPercent(interval.lowerBound)} to ${formatPercent(interval.upperBound)}`
    : 'Not available for an empty group'
  return Object.freeze({
    periodLabel: PERIOD_LABELS[source.periodId],
    marginLabel: source.scoreMarginBandId ? MARGIN_LABELS[source.scoreMarginBandId] : null,
    evidenceLabel: source.sourceId ? `${EVIDENCE_LABELS[source.sourceId]}: ${EVIDENCE_LABELS[source.stateId]}` : null,
    itemCountLabel: `${source.itemCount} ${source.itemCount === 1 ? 'row' : 'rows'}`,
    confirmationRateLabel: formatPercent(source.confirmationRate),
    intervalLabel,
  })
}

export { STATUS_IDS as POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_EVALUATION_REPORT_STATUS_IDS }
