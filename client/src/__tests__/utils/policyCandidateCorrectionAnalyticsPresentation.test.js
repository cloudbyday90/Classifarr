/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  normalizePolicyCandidateCorrectionAnalyticsMetricsReport,
} from '@/utils/policyCandidateCorrectionAnalyticsPresentation'

function report(overrides = {}) {
  const emptyReadiness = {
    version: 'policy.candidate_correction_calibration_readiness.v1',
    statusId: 'insufficient_data',
    applicableDecisionCount: 0,
    changedSelectionOutcomeCount: 0,
    changedSelectionRatePercent: 0,
    minimumApplicableDecisionCount: 20,
    reviewThresholdPercent: 20,
    changedSelectionConfidenceInterval: null,
  }
  const reviewReadiness = {
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
  }

  return {
    version: 'policy.candidate_correction_analytics_metrics.v2',
    window: { days: 7, startDate: '2026-08-23', endDate: '2026-08-30' },
    marginBuckets: [
      {
        marginBandId: '5_to_14',
        outcomeCount: 20,
        confirmedLeaderOutcomeCount: 10,
        changedToCandidateOutcomeCount: 6,
        changedOutsideCandidatesOutcomeCount: 4,
        routedNotApplicableOutcomeCount: 0,
        calibrationReadiness: reviewReadiness,
      },
      ...['0_to_4', '15_to_29', '30_or_more'].map((marginBandId) => ({
        marginBandId,
        outcomeCount: 0,
        confirmedLeaderOutcomeCount: 0,
        changedToCandidateOutcomeCount: 0,
        changedOutsideCandidatesOutcomeCount: 0,
        routedNotApplicableOutcomeCount: 0,
        calibrationReadiness: emptyReadiness,
      })),
    ],
    evidenceSourceStateBuckets: [
      {
        evidenceSourceId: 'declared_policy',
        evidenceStateId: 'supporting',
        outcomeCount: 20,
        confirmedLeaderOutcomeCount: 10,
        changedToCandidateOutcomeCount: 6,
        changedOutsideCandidatesOutcomeCount: 4,
        routedNotApplicableOutcomeCount: 0,
        calibrationReadiness: reviewReadiness,
      },
    ],
    summary: {
      outcomeCount: 20,
      confirmedLeaderOutcomeCount: 10,
      changedToCandidateOutcomeCount: 6,
      changedOutsideCandidatesOutcomeCount: 4,
      routedNotApplicableOutcomeCount: 0,
    },
    calibrationReadiness: reviewReadiness,
    ...overrides,
  }
}

describe('policyCandidateCorrectionAnalyticsPresentation', () => {
  it('keeps only fixed aggregate dimensions and local labels', () => {
    const normalized = normalizePolicyCandidateCorrectionAnalyticsMetricsReport(report({
      rawCatalogTitle: 'Do not display',
      evidenceSourceStateBuckets: [
        ...report().evidenceSourceStateBuckets,
        {
          evidenceSourceId: 'provider_evidence',
          evidenceStateId: 'verdict',
          outcomeCount: 999,
        },
      ],
    }))

    expect(normalized).toMatchObject({
      summary: { outcomeCount: 20, changedSelectionRatePercent: 50 },
      readiness: { statusId: 'observing' },
      calibrationReadiness: { statusId: 'review_recommended' },
    })
    expect(normalized.marginBuckets).toHaveLength(4)
    expect(normalized.evidenceSourceStateBuckets).toEqual([
      expect.objectContaining({
        sourceLabel: 'Declared policy',
        stateLabel: 'Supporting',
      }),
    ])
    expect(JSON.stringify(normalized)).not.toContain('Do not display')
    expect(JSON.stringify(normalized)).not.toContain('provider_evidence')
  })

  it('fails closed when the server summary does not match the bounded margin buckets', () => {
    const invalid = report()
    invalid.summary.outcomeCount = 2

    expect(normalizePolicyCandidateCorrectionAnalyticsMetricsReport(invalid)).toBeNull()
  })
})
