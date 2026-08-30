/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const READINESS_VERSION = 'policy.candidate_correction_calibration_readiness.v1'
const MINIMUM_APPLICABLE_DECISION_COUNT = 20
const REVIEW_THRESHOLD_PERCENT = 20

const STATUS_PRESENTATIONS = Object.freeze({
  insufficient_data: Object.freeze({
    label: 'Needs more applicable decisions',
    message: 'This aggregate has not reached the fixed decision floor. Continue reviewing individual outcomes; do not infer an evidence or score-band issue yet.',
    className: 'text-gray-300',
  }),
  review_recommended: Object.freeze({
    label: 'Review outcome pattern',
    message: 'Its 95% interval is at or above the fixed review floor. Review representative individual decisions before considering a policy-maintenance change.',
    className: 'text-amber-200',
  }),
  inconclusive: Object.freeze({
    label: 'Outcome pattern is inconclusive',
    message: 'Its 95% interval overlaps the fixed review floor. Continue observing; this aggregate alone does not support a policy-maintenance change.',
    className: 'text-blue-200',
  }),
  no_material_signal: Object.freeze({
    label: 'No material selection-change signal',
    message: 'Its 95% interval is below the fixed review floor. This is not a correctness guarantee and does not change routing.',
    className: 'text-blue-200',
  }),
})

function nonnegativeCount(value) {
  const numericValue = Number(value)
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : null
}

function boundedRatePercent(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= 100
    ? numericValue
    : null
}

function ratePercent(numerator, denominator) {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

function normalizedConfidenceInterval(value, applicableDecisionCount) {
  if (applicableDecisionCount === 0) return value === null ? null : undefined
  if (value?.methodId !== 'wilson_score' || value?.confidenceLevelPercent !== 95) return undefined

  const lowerRatePercent = boundedRatePercent(value.lowerRatePercent)
  const upperRatePercent = boundedRatePercent(value.upperRatePercent)
  if (lowerRatePercent === null || upperRatePercent === null || lowerRatePercent > upperRatePercent) {
    return undefined
  }

  return Object.freeze({
    methodId: 'wilson_score',
    confidenceLevelPercent: 95,
    lowerRatePercent,
    upperRatePercent,
  })
}

/**
 * Accepts only the fixed count-derived review signal emitted beside an
 * aggregate correction bucket. Server-provided copy and unknown fields never
 * enter the display model.
 */
export function normalizePolicyCandidateCorrectionCalibrationReadiness(
  value,
  { applicableDecisionCount, changedSelectionOutcomeCount } = {},
) {
  const expectedApplicableDecisionCount = nonnegativeCount(applicableDecisionCount)
  const expectedChangedSelectionOutcomeCount = nonnegativeCount(changedSelectionOutcomeCount)
  if (expectedApplicableDecisionCount === null || expectedChangedSelectionOutcomeCount === null ||
      expectedChangedSelectionOutcomeCount > expectedApplicableDecisionCount ||
      value?.version !== READINESS_VERSION ||
      !STATUS_PRESENTATIONS[value?.statusId] ||
      value?.minimumApplicableDecisionCount !== MINIMUM_APPLICABLE_DECISION_COUNT ||
      value?.reviewThresholdPercent !== REVIEW_THRESHOLD_PERCENT ||
      value?.applicableDecisionCount !== expectedApplicableDecisionCount ||
      value?.changedSelectionOutcomeCount !== expectedChangedSelectionOutcomeCount ||
      value?.changedSelectionRatePercent !== ratePercent(
        expectedChangedSelectionOutcomeCount,
        expectedApplicableDecisionCount,
      )) {
    return null
  }

  const changedSelectionConfidenceInterval = normalizedConfidenceInterval(
    value.changedSelectionConfidenceInterval,
    expectedApplicableDecisionCount,
  )
  if (changedSelectionConfidenceInterval === undefined) return null

  return Object.freeze({
    statusId: value.statusId,
    applicableDecisionCount: expectedApplicableDecisionCount,
    changedSelectionOutcomeCount: expectedChangedSelectionOutcomeCount,
    changedSelectionRatePercent: ratePercent(
      expectedChangedSelectionOutcomeCount,
      expectedApplicableDecisionCount,
    ),
    minimumApplicableDecisionCount: MINIMUM_APPLICABLE_DECISION_COUNT,
    reviewThresholdPercent: REVIEW_THRESHOLD_PERCENT,
    changedSelectionConfidenceInterval,
  })
}

export function getPolicyCandidateCorrectionCalibrationReadinessPresentation(statusId) {
  return STATUS_PRESENTATIONS[statusId] || null
}

export function formatPolicyCandidateCorrectionConfidenceInterval(interval) {
  if (interval?.methodId !== 'wilson_score' || interval?.confidenceLevelPercent !== 95) {
    return 'Unavailable'
  }

  const lowerRatePercent = boundedRatePercent(interval.lowerRatePercent)
  const upperRatePercent = boundedRatePercent(interval.upperRatePercent)
  if (lowerRatePercent === null || upperRatePercent === null || lowerRatePercent > upperRatePercent) {
    return 'Unavailable'
  }

  return `95% Wilson interval: ${lowerRatePercent}%–${upperRatePercent}%`
}
