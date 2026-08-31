/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  getPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadinessPresentation,
  normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadiness,
} from '@/utils/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadinessPresentation'

function response(overrides = {}) {
  return {
    statusId: 'ready_for_human_review',
    reviewEligible: true,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    routingChanged: false,
    ...overrides,
  }
}

describe('policy-change review history calibration readiness presentation', () => {
  it('projects only the fixed descriptive readiness state', () => {
    expect(normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadiness(response({
      periodStart: '2026-07-29',
      threshold: 0.25,
      actorId: 7,
    }))).toEqual({ statusId: 'ready_for_human_review', reviewEligible: true })
  })

  it('rejects authority-bearing and incompatible readiness states', () => {
    expect(normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadiness(response({
      automaticAiRagTuning: true,
    }))).toBeNull()
    expect(normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadiness(response({
      statusId: 'ready_for_human_review',
      reviewEligible: false,
    }))).toBeNull()
    expect(normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadiness(response({
      statusId: 'apply_policy',
    }))).toBeNull()
  })

  it('explains human review readiness without presenting an automatic action', () => {
    expect(getPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadinessPresentation('ready_for_human_review'))
      .toEqual(expect.objectContaining({
        heading: 'Calibration review is ready for human evaluation',
      }))
  })
})
