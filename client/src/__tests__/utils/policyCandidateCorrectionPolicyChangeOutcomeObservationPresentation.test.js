/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 */

import { describe, expect, it } from 'vitest'
import {
  normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservation,
  presentPolicyCandidateCorrectionPolicyChangeOutcomeSummary,
} from '@/utils/policyCandidateCorrectionPolicyChangeOutcomeObservationPresentation'

function summary({ changedToCandidateOutcomeCount = 0, changedOutsideCandidatesOutcomeCount = 0 } = {}) {
  const changedSelectionOutcomeCount = changedToCandidateOutcomeCount + changedOutsideCandidatesOutcomeCount
  const confirmedLeaderOutcomeCount = 0
  const applicableDecisionCount = changedSelectionOutcomeCount
  return {
    outcomeCount: changedSelectionOutcomeCount,
    confirmedLeaderOutcomeCount,
    changedToCandidateOutcomeCount,
    changedOutsideCandidatesOutcomeCount,
    routedNotApplicableOutcomeCount: 0,
    applicableDecisionCount,
    changedSelectionOutcomeCount,
    changedSelectionRatePercent: applicableDecisionCount ? 100 : 0,
    changedSelectionRateInterval95: applicableDecisionCount
      ? { lowerBound: 0.20654931437723745, upperBound: 1 }
      : null,
  }
}

function response(overrides = {}) {
  return {
    version: 'policy.candidate_correction_policy_change_outcome_observation.v1',
    statusId: 'observing',
    startAvailable: false,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    routingChanged: false,
    observation: {
      hypothesisId: `pco_${'a'.repeat(32)}`,
      createdAt: '2026-08-01T12:00:00.000Z',
      outcomeAvailableAt: '2026-08-30T00:00:00.000Z',
      expiresAt: '2026-09-29T00:00:00.000Z',
      baselineWindow: { startAt: '2026-07-04T00:00:00.000Z', endAt: '2026-08-01T00:00:00.000Z' },
      followupWindow: { startAt: '2026-08-02T00:00:00.000Z', endAt: '2026-08-30T00:00:00.000Z' },
      baselineSummary: summary(),
      policyId: 7,
    },
    outcome: null,
    ...overrides,
  }
}

describe('policy-change outcome observation presentation', () => {
  it('retains only the fixed content-free observation response', () => {
    const normalized = normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservation(response())

    expect(normalized).toEqual(expect.objectContaining({ statusId: 'observing' }))
    expect(JSON.stringify(normalized)).not.toContain('policyId')
    expect(presentPolicyCandidateCorrectionPolicyChangeOutcomeSummary(
      normalized.observation.baselineSummary,
    )).toEqual(expect.objectContaining({ changedSelectionRateLabel: '0.0%' }))
  })

  it('fails closed when automatic authority is claimed or a derived interval is changed', () => {
    expect(normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservation(response({
      automaticAiRagTuning: true,
    }))).toBeNull()

    const invalidInterval = response()
    invalidInterval.observation.baselineSummary.changedSelectionRateInterval95 = { lowerBound: 0, upperBound: 1 }
    expect(normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservation(invalidInterval)).toBeNull()
  })
})
