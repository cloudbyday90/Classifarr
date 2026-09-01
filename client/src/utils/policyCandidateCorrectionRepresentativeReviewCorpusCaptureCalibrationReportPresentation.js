/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  formatPolicyCandidateCorrectionConfidenceInterval,
  getPolicyCandidateCorrectionCalibrationReadinessPresentation,
  normalizePolicyCandidateCorrectionCalibrationReadiness,
} from './policyCandidateCorrectionCalibrationReadinessPresentation'

const VERSION = 'policy.candidate_correction_representative_review_corpus_capture_calibration_report.v1'
const PURPOSE_ID = 'representative_historical_correction_review'
const STATUS_IDS = Object.freeze({
  COLLECTING: 'collecting',
  REPORT_AVAILABLE: 'report_available',
})
const MARGIN_BAND_IDS = Object.freeze(['0_to_4', '5_to_14', '15_to_29', '30_or_more'])
const LOW_MARGIN_BAND_IDS = new Set(['0_to_4', '5_to_14'])
const HIGH_MARGIN_BAND_IDS = new Set(['15_to_29', '30_or_more'])
const RECOMMENDATION_IDS = Object.freeze({
  CONTINUE_OBSERVING: 'continue_observing',
  REVIEW_CLOSE_CANDIDATE_BOUNDARIES: 'review_close_candidate_boundaries',
  REVIEW_HIGH_MARGIN_CANDIDATE_EVIDENCE: 'review_high_margin_candidate_evidence',
  REVIEW_MIXED_SCORE_BAND_EVIDENCE: 'review_mixed_score_band_evidence',
})
const EXPECTED_AUTOMATIC_ACTION_IDS = Object.freeze([
  'aiInvocation', 'learning', 'policyChange', 'ragTuning', 'retry', 'routing',
])
const MARGIN_BAND_LABELS = Object.freeze({
  '0_to_4': '0–4 points',
  '5_to_14': '5–14 points',
  '15_to_29': '15–29 points',
  '30_or_more': '30+ points',
})

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function normalizeCount(value) {
  const numeric = Number(value)
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null
}

function ratePercent(numerator, denominator) {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null
}

function hasExpectedAuthority(value) {
  const source = asPlainObject(value)
  const automaticActions = asPlainObject(source?.automaticActions)
  return source?.scope === 'offline_calibration_review_only' &&
    source.historicalRecordAccess === false && source.retainedItemAccess === false &&
    automaticActions && Object.keys(automaticActions).length === EXPECTED_AUTOMATIC_ACTION_IDS.length &&
    EXPECTED_AUTOMATIC_ACTION_IDS.every(key => automaticActions[key] === false)
}

function normalizeBand(value, expectedScoreMarginBandId) {
  const source = asPlainObject(value)
  const capturedOutcomeCount = normalizeCount(source?.capturedOutcomeCount)
  const confirmedCandidateCount = normalizeCount(source?.confirmedCandidateCount)
  const changedSelectionCount = normalizeCount(source?.changedSelectionCount)
  if (!source || source.scoreMarginBandId !== expectedScoreMarginBandId ||
      capturedOutcomeCount === null || confirmedCandidateCount === null ||
      changedSelectionCount === null || confirmedCandidateCount > capturedOutcomeCount ||
      changedSelectionCount > capturedOutcomeCount ||
      source.confirmationRatePercent !== ratePercent(confirmedCandidateCount, capturedOutcomeCount)) {
    return null
  }

  const calibrationReadiness = normalizePolicyCandidateCorrectionCalibrationReadiness(
    source.calibrationReadiness,
    { applicableDecisionCount: capturedOutcomeCount, changedSelectionOutcomeCount: changedSelectionCount },
  )
  if (!calibrationReadiness) return null

  return Object.freeze({
    scoreMarginBandId: expectedScoreMarginBandId,
    capturedOutcomeCount,
    confirmedCandidateCount,
    changedSelectionCount,
    confirmationRatePercent: ratePercent(confirmedCandidateCount, capturedOutcomeCount),
    calibrationReadiness,
  })
}

function expectedRecommendation(scoreMarginBands) {
  const reviewBandIds = scoreMarginBands
    .filter(band => band.calibrationReadiness.statusId === 'review_recommended')
    .map(band => band.scoreMarginBandId)
  const hasLowMarginReview = reviewBandIds.some(bandId => LOW_MARGIN_BAND_IDS.has(bandId))
  const hasHighMarginReview = reviewBandIds.some(bandId => HIGH_MARGIN_BAND_IDS.has(bandId))
  const recommendationId = hasLowMarginReview && hasHighMarginReview
    ? RECOMMENDATION_IDS.REVIEW_MIXED_SCORE_BAND_EVIDENCE
    : hasLowMarginReview
      ? RECOMMENDATION_IDS.REVIEW_CLOSE_CANDIDATE_BOUNDARIES
      : hasHighMarginReview
        ? RECOMMENDATION_IDS.REVIEW_HIGH_MARGIN_CANDIDATE_EVIDENCE
        : RECOMMENDATION_IDS.CONTINUE_OBSERVING
  return Object.freeze({ recommendationId, reviewBandIds: Object.freeze(reviewBandIds) })
}

function sameStringArray(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((value, index) => value === right[index])
}

function normalizeReport(value) {
  const source = asPlainObject(value)
  const capturedOutcomeCount = normalizeCount(source?.capturedOutcomeCount)
  const minimumCapturedOutcomeCount = normalizeCount(source?.minimumCapturedOutcomeCount)
  if (!source || capturedOutcomeCount === null || minimumCapturedOutcomeCount !== 24 ||
      !Array.isArray(source.scoreMarginBands) || source.scoreMarginBands.length !== MARGIN_BAND_IDS.length) {
    return null
  }

  const scoreMarginBands = source.scoreMarginBands.map((band, index) => (
    normalizeBand(band, MARGIN_BAND_IDS[index])
  ))
  if (scoreMarginBands.some(band => band === null) ||
      scoreMarginBands.reduce((total, band) => total + band.capturedOutcomeCount, 0) !== capturedOutcomeCount) {
    return null
  }

  const expected = expectedRecommendation(scoreMarginBands)
  const recommendation = asPlainObject(source.recommendation)
  if (!recommendation || recommendation.recommendationId !== expected.recommendationId ||
      !sameStringArray(recommendation.reviewBandIds, expected.reviewBandIds)) {
    return null
  }

  return Object.freeze({
    capturedOutcomeCount,
    minimumCapturedOutcomeCount,
    scoreMarginBands: Object.freeze(scoreMarginBands),
    recommendation: expected,
  })
}

/** Drops unknown fields and rejects any authority outside fixed review-only scope. */
export function normalizePolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReport(value) {
  const source = asPlainObject(value)
  if (!source || source.version !== VERSION || source.purposeId !== PURPOSE_ID ||
      !hasExpectedAuthority(source.authority) || !Object.values(STATUS_IDS).includes(source.statusId)) {
    return null
  }
  if (source.statusId === STATUS_IDS.COLLECTING) {
    return source.report === null ? Object.freeze({ statusId: STATUS_IDS.COLLECTING, report: null }) : null
  }

  const report = normalizeReport(source.report)
  return report ? Object.freeze({ statusId: STATUS_IDS.REPORT_AVAILABLE, report }) : null
}

export function getPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportPresentation(report) {
  if (report?.statusId === STATUS_IDS.COLLECTING) return null
  if (report?.statusId !== STATUS_IDS.REPORT_AVAILABLE || !report.report) return null

  const { recommendation, scoreMarginBands } = report.report
  if (recommendation.recommendationId === RECOMMENDATION_IDS.REVIEW_CLOSE_CANDIDATE_BOUNDARIES) {
    return Object.freeze({
      heading: 'Review close-candidate boundaries',
      message: 'A score band with close candidates has a sustained operator-change pattern. Review destination competition and semantic retrieval evidence; no threshold or route has changed.',
      statusClass: 'text-amber-200',
    })
  }
  if (recommendation.recommendationId === RECOMMENDATION_IDS.REVIEW_HIGH_MARGIN_CANDIDATE_EVIDENCE) {
    return Object.freeze({
      heading: 'Review higher-margin candidate evidence',
      message: 'A higher-separation score band has a sustained operator-change pattern. Review declared-policy specificity and semantic retrieval evidence; no AI, RAG, or route has changed.',
      statusClass: 'text-amber-200',
    })
  }
  if (recommendation.recommendationId === RECOMMENDATION_IDS.REVIEW_MIXED_SCORE_BAND_EVIDENCE) {
    return Object.freeze({
      heading: 'Review score-band evidence',
      message: 'Both close and higher-separation bands have sustained operator-change patterns. Review the policy and retrieval evidence together; no automatic action has been taken.',
      statusClass: 'text-amber-200',
    })
  }

  const allBandsHaveNoMaterialSignal = scoreMarginBands.every(
    band => band.calibrationReadiness.statusId === 'no_material_signal',
  )
  return Object.freeze({
    heading: allBandsHaveNoMaterialSignal
      ? 'No material score-band pattern'
      : 'Continue automatic collection',
    message: allBandsHaveNoMaterialSignal
      ? 'Each score band is below the fixed operator-change review floor. This is not a correctness guarantee and does not change routing.'
      : 'The baseline is ready, but each score band needs 20 outcomes before Classifarr can surface a precise review prompt. Collection and refresh continue automatically.',
    statusClass: 'text-blue-200',
  })
}

export function presentPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationBand(band) {
  const readinessPresentation = getPolicyCandidateCorrectionCalibrationReadinessPresentation(
    band?.calibrationReadiness?.statusId,
  )
  if (!band || !MARGIN_BAND_LABELS[band.scoreMarginBandId] || !readinessPresentation) return null

  return Object.freeze({
    scoreMarginBandId: band.scoreMarginBandId,
    scoreMarginBandLabel: MARGIN_BAND_LABELS[band.scoreMarginBandId],
    capturedOutcomeCount: band.capturedOutcomeCount,
    confirmedCandidateCount: band.confirmedCandidateCount,
    confirmationRateLabel: band.confirmationRatePercent === null
      ? 'No outcomes yet'
      : `${band.confirmationRatePercent}%`,
    changedSelectionCount: band.changedSelectionCount,
    calibrationLabel: readinessPresentation.label,
    calibrationClass: readinessPresentation.className,
    intervalLabel: formatPolicyCandidateCorrectionConfidenceInterval(
      band.calibrationReadiness.changedSelectionConfidenceInterval,
    ),
  })
}
