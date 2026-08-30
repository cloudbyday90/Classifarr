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
  const compositionComparison = (bucketIds, currentCounts, previousCounts) => {
    const currentObservationCount = bucketIds.reduce((total, bucketId) => (
      total + (currentCounts[bucketId] || 0)
    ), 0)
    const previousObservationCount = bucketIds.reduce((total, bucketId) => (
      total + (previousCounts[bucketId] || 0)
    ), 0)
    const hasSufficientData = currentObservationCount >= 20 && previousObservationCount >= 20
    const buckets = bucketIds.map((bucketId) => {
      const currentSharePercent = currentObservationCount
        ? Math.round(currentCounts[bucketId] / currentObservationCount * 1000) / 10
        : 0
      const previousSharePercent = previousObservationCount
        ? Math.round(previousCounts[bucketId] / previousObservationCount * 1000) / 10
        : 0

      return {
        bucketId,
        currentObservationCount: currentCounts[bucketId] || 0,
        previousObservationCount: previousCounts[bucketId] || 0,
        currentSharePercent,
        previousSharePercent,
        sharePointChangePercent: Math.round((currentSharePercent - previousSharePercent) * 10) / 10,
      }
    })
    const totalVariationDistancePercent = hasSufficientData
      ? Math.round(buckets.reduce((total, bucket) => (
        total + Math.abs(bucket.currentSharePercent - bucket.previousSharePercent)
      ), 0) / 2 * 10) / 10
      : null

    return {
      version: 'policy.candidate_correction_cohort_composition.v1',
      statusId: !hasSufficientData
        ? 'insufficient_data'
        : (totalVariationDistancePercent >= 20 ? 'material_shift_detected' : 'composition_comparable'),
      currentObservationCount,
      previousObservationCount,
      minimumObservationCount: 20,
      materialShiftThresholdPercent: 20,
      totalVariationDistancePercent,
      buckets,
    }
  }
  const base = {
    version: 'policy.candidate_correction_analytics_metrics.v4',
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
    cohortComposition: overrides.cohortComposition || (() => {
      const marginBands = compositionComparison(
        ['0_to_4', '5_to_14', '15_to_29', '30_or_more'],
        { '0_to_4': 0, '5_to_14': 20, '15_to_29': 0, '30_or_more': 0 },
        { '0_to_4': 0, '5_to_14': 20, '15_to_29': 0, '30_or_more': 0 },
      )
      const declaredPolicy = compositionComparison(
        [
          'declared_policy:anchored',
          'declared_policy:supporting',
          'declared_policy:contextual',
          'declared_policy:conflicting',
          'declared_policy:unavailable',
        ],
        {
          'declared_policy:anchored': 0,
          'declared_policy:supporting': 20,
          'declared_policy:contextual': 0,
          'declared_policy:conflicting': 0,
          'declared_policy:unavailable': 0,
        },
        {
          'declared_policy:anchored': 0,
          'declared_policy:supporting': 20,
          'declared_policy:contextual': 0,
          'declared_policy:conflicting': 0,
          'declared_policy:unavailable': 0,
        },
      )

      return {
        version: 'policy.candidate_correction_cohort_composition.v1',
        statusId: 'composition_comparable',
        materialShiftDimensionCount: 0,
        comparableDimensionCount: 2,
        insufficientDataDimensionCount: 0,
        marginBands,
        evidenceSources: [{ evidenceSourceId: 'declared_policy', comparison: declaredPolicy }],
      }
    })(),
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

  it('fails closed when the server cohort-composition comparison does not match the fixed aggregates', () => {
    const invalid = report()
    invalid.cohortComposition.marginBands.totalVariationDistancePercent = 21

    expect(normalizePolicyCandidateCorrectionAnalyticsMetricsReport(invalid)).toBeNull()
  })
})
