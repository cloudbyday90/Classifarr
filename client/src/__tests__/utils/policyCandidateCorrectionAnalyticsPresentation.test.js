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

  const marginBuckets = [
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
  ]
  const evidenceSourceStateBuckets = [
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
  ]
  const stability = (currentReadiness, previousReadiness) => ({
    version: 'policy.candidate_correction_temporal_stability.v1',
    statusId: currentReadiness.statusId === 'review_recommended' &&
      previousReadiness.statusId === 'review_recommended'
      ? 'persistent_review_signal'
      : 'insufficient_comparison_data',
    currentStatusId: currentReadiness.statusId,
    previousStatusId: previousReadiness.statusId,
    currentApplicableDecisionCount: currentReadiness.applicableDecisionCount,
    previousApplicableDecisionCount: previousReadiness.applicableDecisionCount,
  })
  const base = {
    version: 'policy.candidate_correction_analytics_metrics.v3',
    window: { days: 7, startDate: '2026-08-23', endDate: '2026-08-30' },
    marginBuckets,
    evidenceSourceStateBuckets,
    summary: {
      outcomeCount: 20,
      confirmedLeaderOutcomeCount: 10,
      changedToCandidateOutcomeCount: 6,
      changedOutsideCandidatesOutcomeCount: 4,
      routedNotApplicableOutcomeCount: 0,
    },
    calibrationReadiness: reviewReadiness,
    previousWindow: { days: 7, startDate: '2026-08-16', endDate: '2026-08-23' },
    previousMarginBuckets: marginBuckets.map((bucket) => ({ ...bucket })),
    previousEvidenceSourceStateBuckets: evidenceSourceStateBuckets.map((bucket) => ({ ...bucket })),
    previousSummary: {
      outcomeCount: 20,
      confirmedLeaderOutcomeCount: 10,
      changedToCandidateOutcomeCount: 6,
      changedOutsideCandidatesOutcomeCount: 4,
      routedNotApplicableOutcomeCount: 0,
    },
    previousCalibrationReadiness: reviewReadiness,
  }
  const result = { ...base, ...overrides }
  return {
    ...result,
    temporalStability: overrides.temporalStability || {
      version: 'policy.candidate_correction_temporal_stability.v1',
      summary: stability(result.calibrationReadiness, result.previousCalibrationReadiness),
      marginBuckets: result.marginBuckets
        .filter((bucket) => ['0_to_4', '5_to_14', '15_to_29', '30_or_more'].includes(bucket.marginBandId))
        .map((bucket) => ({
          marginBandId: bucket.marginBandId,
          stability: stability(
            bucket.calibrationReadiness,
            result.previousMarginBuckets.find((previous) => previous.marginBandId === bucket.marginBandId)
              ?.calibrationReadiness || emptyReadiness,
          ),
        })),
      evidenceSourceStateBuckets: [
        {
          evidenceSourceId: 'declared_policy',
          evidenceStateId: 'supporting',
          stability: stability(
            result.evidenceSourceStateBuckets.find((bucket) => (
              bucket.evidenceSourceId === 'declared_policy' && bucket.evidenceStateId === 'supporting'
            ))?.calibrationReadiness || emptyReadiness,
            result.previousEvidenceSourceStateBuckets[0].calibrationReadiness,
          ),
        },
      ],
    },
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

  it('fails closed when the server temporal status does not match both validated periods', () => {
    const invalid = report()
    invalid.temporalStability.summary.statusId = 'emerging_review_signal'

    expect(normalizePolicyCandidateCorrectionAnalyticsMetricsReport(invalid)).toBeNull()
  })
})
