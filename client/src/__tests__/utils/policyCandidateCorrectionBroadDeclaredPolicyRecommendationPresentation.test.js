/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  getPolicyCandidateCorrectionBroadDeclaredPolicyRecommendation,
} from '@/utils/policyCandidateCorrectionBroadDeclaredPolicyRecommendationPresentation'

function contextualPeriod(startDate, endDate, statusId = 'review_recommended') {
  return {
    window: { startDate, endDate },
    contextualDeclaredPolicyEvidence: {
      applicableDecisionCount: 20,
      changedSelectionOutcomeCount: 10,
      changedSelectionRatePercent: 50,
      calibrationReadiness: {
        statusId,
        changedSelectionConfidenceInterval: {
          methodId: 'wilson_score',
          confidenceLevelPercent: 95,
          lowerRatePercent: 29.9,
          upperRatePercent: 70.1,
        },
      },
      rawPolicyTerm: 'Do not render',
    },
  }
}

function longHorizonTrend(overrides = {}) {
  return {
    cohortComposition: { statusId: 'composition_comparable' },
    current: contextualPeriod('2026-08-02', '2026-08-30'),
    previous: contextualPeriod('2026-07-05', '2026-08-02'),
    ...overrides,
  }
}

describe('policyCandidateCorrectionBroadDeclaredPolicyRecommendationPresentation', () => {
  it('recommends a human policy-scope review only for two comparable review-ready periods', () => {
    const recommendation = getPolicyCandidateCorrectionBroadDeclaredPolicyRecommendation(
      longHorizonTrend(),
    )

    expect(recommendation).toMatchObject({
      heading: 'Recommended next policy review',
      label: 'Review a policy that may be too broad',
      current: { changedSelectionRatePercent: 50 },
      previous: { changedSelectionRatePercent: 50 },
    })
    expect(JSON.stringify(recommendation)).not.toContain('Do not render')
  })

  it('fails closed when the cohort guard or either contextual period is not review-ready', () => {
    expect(getPolicyCandidateCorrectionBroadDeclaredPolicyRecommendation(longHorizonTrend({
      cohortComposition: { statusId: 'material_shift_detected' },
    }))).toBeNull()
    expect(getPolicyCandidateCorrectionBroadDeclaredPolicyRecommendation(longHorizonTrend({
      previous: contextualPeriod('2026-07-05', '2026-08-02', 'inconclusive'),
    }))).toBeNull()
    expect(getPolicyCandidateCorrectionBroadDeclaredPolicyRecommendation(longHorizonTrend({
      current: { window: { startDate: '2026-08-02', endDate: '2026-08-30' } },
    }))).toBeNull()
  })
})
