/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  getPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportPresentation,
  normalizePolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReport,
  presentPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationBand,
} from '@/utils/policyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportPresentation'

const MARGIN_BAND_IDS = ['0_to_4', '5_to_14', '15_to_29', '30_or_more']

function readiness({ capturedOutcomeCount = 20, changedSelectionCount = 0, statusId = 'no_material_signal' } = {}) {
  return {
    version: 'policy.candidate_correction_calibration_readiness.v1',
    statusId,
    applicableDecisionCount: capturedOutcomeCount,
    changedSelectionOutcomeCount: changedSelectionCount,
    changedSelectionRatePercent: Math.round((changedSelectionCount / capturedOutcomeCount) * 1000) / 10,
    minimumApplicableDecisionCount: 20,
    reviewThresholdPercent: 20,
    changedSelectionConfidenceInterval: {
      methodId: 'wilson_score',
      confidenceLevelPercent: 95,
      lowerRatePercent: statusId === 'review_recommended' ? 29.9 : 0,
      upperRatePercent: statusId === 'review_recommended' ? 70.1 : 16.1,
    },
  }
}

function band(scoreMarginBandId, overrides = {}) {
  const capturedOutcomeCount = overrides.capturedOutcomeCount ?? 20
  const confirmedCandidateCount = overrides.confirmedCandidateCount ?? capturedOutcomeCount
  const changedSelectionCount = overrides.changedSelectionCount ?? 0
  return {
    scoreMarginBandId,
    capturedOutcomeCount,
    confirmedCandidateCount,
    changedSelectionCount,
    confirmationRatePercent: Math.round((confirmedCandidateCount / capturedOutcomeCount) * 1000) / 10,
    calibrationReadiness: readiness({
      capturedOutcomeCount,
      changedSelectionCount,
      statusId: overrides.calibrationStatusId,
    }),
  }
}

function response(overrides = {}) {
  const scoreMarginBands = MARGIN_BAND_IDS.map(scoreMarginBandId => band(scoreMarginBandId))
  return {
    version: 'policy.candidate_correction_representative_review_corpus_capture_calibration_report.v1',
    statusId: 'report_available',
    purposeId: 'representative_historical_correction_review',
    authority: {
      scope: 'offline_calibration_review_only',
      historicalRecordAccess: false,
      retainedItemAccess: false,
      automaticActions: {
        aiInvocation: false,
        learning: false,
        policyChange: false,
        ragTuning: false,
        retry: false,
        routing: false,
      },
    },
    report: {
      capturedOutcomeCount: 80,
      minimumCapturedOutcomeCount: 24,
      scoreMarginBands,
      recommendation: {
        recommendationId: 'continue_observing',
        reviewBandIds: [],
      },
    },
    ...overrides,
  }
}

describe('representative review-corpus future-capture calibration presentation', () => {
  it('retains only fixed aggregate calibration fields before rendering', () => {
    const normalized = normalizePolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReport(response({
      mediaTitle: 'must not render',
      report: { ...response().report, prompt: 'must not render' },
    }))

    expect(normalized).toMatchObject({
      statusId: 'report_available',
      report: { capturedOutcomeCount: 80 },
    })
    expect(JSON.stringify(normalized)).not.toContain('must not render')
    expect(getPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportPresentation(normalized))
      .toMatchObject({ heading: 'No material score-band pattern' })
    expect(presentPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationBand(
      normalized.report.scoreMarginBands[0],
    )).toMatchObject({
      scoreMarginBandLabel: '0–4 points',
      calibrationLabel: 'No material selection-change signal',
    })
  })

  it('rebuilds a close-candidate review recommendation and rejects forbidden authority', () => {
    const scoreMarginBands = MARGIN_BAND_IDS.map(scoreMarginBandId => band(scoreMarginBandId))
    scoreMarginBands[0] = band('0_to_4', {
      confirmedCandidateCount: 10,
      changedSelectionCount: 10,
      calibrationStatusId: 'review_recommended',
    })
    const value = response({
      report: {
        capturedOutcomeCount: 80,
        minimumCapturedOutcomeCount: 24,
        scoreMarginBands,
        recommendation: {
          recommendationId: 'review_close_candidate_boundaries',
          reviewBandIds: ['0_to_4'],
        },
      },
    })

    const normalized = normalizePolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReport(value)
    expect(getPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportPresentation(normalized))
      .toMatchObject({ heading: 'Review close-candidate boundaries' })

    value.authority.automaticActions.ragTuning = true
    expect(normalizePolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReport(value)).toBeNull()
  })
})
