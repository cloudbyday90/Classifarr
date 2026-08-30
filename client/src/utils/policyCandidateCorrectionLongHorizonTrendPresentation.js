/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  normalizePolicyCandidateCorrectionCalibrationReadiness,
} from './policyCandidateCorrectionCalibrationReadinessPresentation'

const LONG_HORIZON_TREND_VERSION = 'policy.candidate_correction_long_horizon_trend.v1'
const COHORT_COMPOSITION_VERSION = 'policy.candidate_correction_cohort_composition.v1'
const LONG_HORIZON_WINDOW_DAYS = 28
const MILLISECONDS_PER_UTC_DAY = 24 * 60 * 60 * 1000

const TREND_PRESENTATIONS = Object.freeze({
  needs_representative_periods: Object.freeze({
    label: 'Needs two representative 28-day periods',
    message: 'At least one fixed 28-day period has not reached the existing decision floor. Continue observing before interpreting a long-horizon pattern.',
    className: 'text-gray-300',
  }),
  cohort_comparison_needs_observations: Object.freeze({
    label: 'Long-horizon cohort comparison needs observations',
    message: 'The fixed 28-day periods do not yet have enough aggregate observations for a cohort-composition comparison.',
    className: 'text-gray-300',
  }),
  cohort_mix_shift_detected: Object.freeze({
    label: 'Long-horizon signal guarded by cohort mix',
    message: 'The fixed aggregate mix changed materially between 28-day periods. Do not attribute the observed signal to policy behavior without reviewing representative decisions.',
    className: 'text-amber-200',
  }),
  sustained_review_signal: Object.freeze({
    label: 'Sustained 28-day review signal',
    message: 'Both comparable 28-day periods met the existing advisory review criterion. Review a representative cohort; this does not authorize a policy or routing change.',
    className: 'text-amber-200',
  }),
  sustained_low_signal: Object.freeze({
    label: 'Sustained low signal across 28-day periods',
    message: 'Both comparable 28-day periods remained below the existing review criterion. This is not a correctness or causality conclusion.',
    className: 'text-blue-200',
  }),
  mixed_signal: Object.freeze({
    label: 'Mixed 28-day aggregate signal',
    message: 'The comparable 28-day results do not establish a sustained review or low-signal pattern. Continue observing the fixed aggregate.',
    className: 'text-blue-200',
  }),
})

const COHORT_STATUS_IDS = new Set([
  'insufficient_data',
  'composition_comparable',
  'material_shift_detected',
])
const CALIBRATION_STATUS_IDS = new Set([
  'insufficient_data',
  'review_recommended',
  'inconclusive',
  'no_material_signal',
])

function strictNonnegativeCount(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && !value.trim())) {
    return null
  }
  const numericValue = Number(value)
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : null
}

function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}

function completedUtcDaySpan(startDate, endDate) {
  return (Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) /
    MILLISECONDS_PER_UTC_DAY
}

function normalizedWindow(value) {
  const days = strictNonnegativeCount(value?.days)
  const startDate = dateOnly(value?.startDate)
  const endDate = dateOnly(value?.endDate)
  if (days !== LONG_HORIZON_WINDOW_DAYS || !startDate || !endDate ||
      startDate >= endDate || completedUtcDaySpan(startDate, endDate) !== days) {
    return null
  }

  return Object.freeze({ days, startDate, endDate })
}

function normalizedSummary(value) {
  const outcomeCount = strictNonnegativeCount(value?.outcomeCount)
  const confirmedLeaderOutcomeCount = strictNonnegativeCount(value?.confirmedLeaderOutcomeCount)
  const changedToCandidateOutcomeCount = strictNonnegativeCount(value?.changedToCandidateOutcomeCount)
  const changedOutsideCandidatesOutcomeCount = strictNonnegativeCount(value?.changedOutsideCandidatesOutcomeCount)
  const routedNotApplicableOutcomeCount = strictNonnegativeCount(value?.routedNotApplicableOutcomeCount)
  if ([
    outcomeCount,
    confirmedLeaderOutcomeCount,
    changedToCandidateOutcomeCount,
    changedOutsideCandidatesOutcomeCount,
    routedNotApplicableOutcomeCount,
  ].includes(null) ||
      confirmedLeaderOutcomeCount + changedToCandidateOutcomeCount +
      changedOutsideCandidatesOutcomeCount + routedNotApplicableOutcomeCount !== outcomeCount) {
    return null
  }

  const applicableDecisionCount = confirmedLeaderOutcomeCount +
    changedToCandidateOutcomeCount + changedOutsideCandidatesOutcomeCount
  const changedSelectionOutcomeCount = changedToCandidateOutcomeCount +
    changedOutsideCandidatesOutcomeCount
  return Object.freeze({
    outcomeCount,
    confirmedLeaderOutcomeCount,
    changedToCandidateOutcomeCount,
    changedOutsideCandidatesOutcomeCount,
    routedNotApplicableOutcomeCount,
    applicableDecisionCount,
    changedSelectionOutcomeCount,
    changedSelectionRatePercent: applicableDecisionCount
      ? Math.round(changedSelectionOutcomeCount / applicableDecisionCount * 1000) / 10
      : 0,
  })
}

function normalizedPeriod(value) {
  const window = normalizedWindow(value?.window)
  const summary = normalizedSummary(value?.summary)
  if (!window || !summary) return null

  const calibrationReadiness = normalizePolicyCandidateCorrectionCalibrationReadiness(
    value?.calibrationReadiness,
    summary,
  )
  if (!calibrationReadiness) return null

  return Object.freeze({ window, summary, calibrationReadiness })
}

function expectedCohortStatusId(counts) {
  if (counts.materialShiftDimensionCount > 0) return 'material_shift_detected'
  if (counts.insufficientDataDimensionCount > 0) return 'insufficient_data'
  return 'composition_comparable'
}

function normalizedCohortComposition(value) {
  const materialShiftDimensionCount = strictNonnegativeCount(value?.materialShiftDimensionCount)
  const comparableDimensionCount = strictNonnegativeCount(value?.comparableDimensionCount)
  const insufficientDataDimensionCount = strictNonnegativeCount(value?.insufficientDataDimensionCount)
  const counts = {
    materialShiftDimensionCount,
    comparableDimensionCount,
    insufficientDataDimensionCount,
  }
  if (value?.version !== COHORT_COMPOSITION_VERSION ||
      Object.values(counts).includes(null) ||
      Object.values(counts).reduce((total, count) => total + count, 0) < 1 ||
      !COHORT_STATUS_IDS.has(value?.statusId) ||
      value.statusId !== expectedCohortStatusId(counts)) {
    return null
  }

  return Object.freeze({ statusId: value.statusId, ...counts })
}

function expectedTrendStatusId(current, previous, cohortComposition) {
  if (current.calibrationReadiness.statusId === 'insufficient_data' ||
      previous.calibrationReadiness.statusId === 'insufficient_data') {
    return 'needs_representative_periods'
  }
  if (cohortComposition.statusId === 'material_shift_detected') return 'cohort_mix_shift_detected'
  if (cohortComposition.statusId === 'insufficient_data') return 'cohort_comparison_needs_observations'
  if (current.calibrationReadiness.statusId === 'review_recommended' &&
      previous.calibrationReadiness.statusId === 'review_recommended') {
    return 'sustained_review_signal'
  }
  if (current.calibrationReadiness.statusId === 'no_material_signal' &&
      previous.calibrationReadiness.statusId === 'no_material_signal') {
    return 'sustained_low_signal'
  }
  return 'mixed_signal'
}

function normalizedTrend(value, current, previous, cohortComposition) {
  const currentStatusId = current.calibrationReadiness.statusId
  const previousStatusId = previous.calibrationReadiness.statusId
  const statusId = expectedTrendStatusId(current, previous, cohortComposition)
  if (value?.version !== LONG_HORIZON_TREND_VERSION ||
      !TREND_PRESENTATIONS[value?.statusId] ||
      !CALIBRATION_STATUS_IDS.has(value?.currentStatusId) ||
      !CALIBRATION_STATUS_IDS.has(value?.previousStatusId) ||
      value.currentStatusId !== currentStatusId ||
      value.previousStatusId !== previousStatusId ||
      value.currentApplicableDecisionCount !== current.calibrationReadiness.applicableDecisionCount ||
      value.previousApplicableDecisionCount !== previous.calibrationReadiness.applicableDecisionCount ||
      value.cohortCompositionStatusId !== cohortComposition.statusId ||
      value.statusId !== statusId) {
    return null
  }

  return Object.freeze({
    statusId,
    currentStatusId,
    previousStatusId,
    currentApplicableDecisionCount: current.calibrationReadiness.applicableDecisionCount,
    previousApplicableDecisionCount: previous.calibrationReadiness.applicableDecisionCount,
    cohortCompositionStatusId: cohortComposition.statusId,
  })
}

/**
 * Keeps only a fixed, aggregate-only longer-horizon report. The browser
 * re-derives the trend from both period readiness states and the allow-listed
 * cohort guard before presentation.
 */
export function normalizePolicyCandidateCorrectionLongHorizonTrend(value) {
  if (value?.version !== LONG_HORIZON_TREND_VERSION) return null

  const current = normalizedPeriod(value.current)
  const previous = normalizedPeriod(value.previous)
  const cohortComposition = normalizedCohortComposition(value.cohortComposition)
  if (!current || !previous || !cohortComposition ||
      previous.window.endDate !== current.window.startDate) {
    return null
  }

  const trend = normalizedTrend(value.trend, current, previous, cohortComposition)
  if (!trend) return null

  return Object.freeze({ current, previous, cohortComposition, trend })
}

export function getPolicyCandidateCorrectionLongHorizonTrendPresentation(statusId) {
  return TREND_PRESENTATIONS[statusId] || null
}
