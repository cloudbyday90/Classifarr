/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  formatPolicyCandidateCorrectionConfidenceInterval,
  getPolicyCandidateCorrectionCalibrationReadinessPresentation,
  normalizePolicyCandidateCorrectionCalibrationReadiness,
} from '@/utils/policyCandidateCorrectionCalibrationReadinessPresentation'

function readiness(overrides = {}) {
  return {
    version: 'policy.candidate_correction_calibration_readiness.v1',
    statusId: 'review_recommended',
    applicableDecisionCount: 20,
    changedSelectionOutcomeCount: 10,
    changedSelectionRatePercent: 50,
    minimumApplicableDecisionCount: 20,
    reviewThresholdPercent: 20,
    changedSelectionConfidenceInterval: {
      methodId: 'wilson_score',
      confidenceLevelPercent: 95,
      lowerRatePercent: 29.9,
      upperRatePercent: 70.1,
    },
    ...overrides,
  }
}

describe('policyCandidateCorrectionCalibrationReadinessPresentation', () => {
  it('retains only the fixed count-linked review readiness contract', () => {
    expect(normalizePolicyCandidateCorrectionCalibrationReadiness(readiness({
      rawModelOutput: 'Do not display',
    }), {
      applicableDecisionCount: 20,
      changedSelectionOutcomeCount: 10,
    })).toEqual({
      statusId: 'review_recommended',
      applicableDecisionCount: 20,
      changedSelectionOutcomeCount: 10,
      changedSelectionRatePercent: 50,
      minimumApplicableDecisionCount: 20,
      reviewThresholdPercent: 20,
      changedSelectionConfidenceInterval: {
        methodId: 'wilson_score',
        confidenceLevelPercent: 95,
        lowerRatePercent: 29.9,
        upperRatePercent: 70.1,
      },
    })
  })

  it('fails closed when a readiness count or fixed contract disagrees with its aggregate bucket', () => {
    expect(normalizePolicyCandidateCorrectionCalibrationReadiness(readiness({
      changedSelectionOutcomeCount: 9,
    }), {
      applicableDecisionCount: 20,
      changedSelectionOutcomeCount: 10,
    })).toBeNull()
    expect(normalizePolicyCandidateCorrectionCalibrationReadiness(readiness({
      reviewThresholdPercent: 25,
    }), {
      applicableDecisionCount: 20,
      changedSelectionOutcomeCount: 10,
    })).toBeNull()
  })

  it('formats only the fixed Wilson interval and client-owned status copy', () => {
    expect(formatPolicyCandidateCorrectionConfidenceInterval(
      readiness().changedSelectionConfidenceInterval,
    )).toBe('95% Wilson interval: 29.9%–70.1%')
    expect(formatPolicyCandidateCorrectionConfidenceInterval({
      methodId: 'provider_defined',
    })).toBe('Unavailable')
    expect(getPolicyCandidateCorrectionCalibrationReadinessPresentation(
      'review_recommended',
    )).toMatchObject({ label: 'Review outcome pattern' })
    expect(getPolicyCandidateCorrectionCalibrationReadinessPresentation(
      'provider_defined',
    )).toBeNull()
  })
})
