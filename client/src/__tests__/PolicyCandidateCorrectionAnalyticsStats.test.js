/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import PolicyCandidateCorrectionAnalyticsStats from '@/views/statistics/PolicyCandidateCorrectionAnalyticsStats.vue'
import api from '@/api'

vi.mock('@/api', () => ({
  default: {
    getPolicyCandidateCorrectionAnalyticsMetrics: vi.fn(),
  },
}))

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

const report = {
  version: 'policy.candidate_correction_analytics_metrics.v4',
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
      privateDestination: 'Do not display',
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
      rawRagText: 'Do not display',
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
  previousWindow: { days: 7, startDate: '2026-08-16', endDate: '2026-08-23' },
  previousMarginBuckets: [
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
  previousEvidenceSourceStateBuckets: [
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
  previousSummary: {
    outcomeCount: 20,
    confirmedLeaderOutcomeCount: 10,
    changedToCandidateOutcomeCount: 6,
    changedOutsideCandidatesOutcomeCount: 4,
    routedNotApplicableOutcomeCount: 0,
  },
  previousCalibrationReadiness: reviewReadiness,
  temporalStability: {
    version: 'policy.candidate_correction_temporal_stability.v1',
    summary: {
      version: 'policy.candidate_correction_temporal_stability.v1',
      statusId: 'persistent_review_signal',
      currentStatusId: 'review_recommended',
      previousStatusId: 'review_recommended',
      currentApplicableDecisionCount: 20,
      previousApplicableDecisionCount: 20,
    },
    marginBuckets: [
      {
        marginBandId: '5_to_14',
        stability: {
          version: 'policy.candidate_correction_temporal_stability.v1',
          statusId: 'persistent_review_signal',
          currentStatusId: 'review_recommended',
          previousStatusId: 'review_recommended',
          currentApplicableDecisionCount: 20,
          previousApplicableDecisionCount: 20,
        },
      },
      ...['0_to_4', '15_to_29', '30_or_more'].map((marginBandId) => ({
        marginBandId,
        stability: {
          version: 'policy.candidate_correction_temporal_stability.v1',
          statusId: 'insufficient_comparison_data',
          currentStatusId: 'insufficient_data',
          previousStatusId: 'insufficient_data',
          currentApplicableDecisionCount: 0,
          previousApplicableDecisionCount: 0,
        },
      })),
    ],
    evidenceSourceStateBuckets: [
      {
        evidenceSourceId: 'declared_policy',
        evidenceStateId: 'supporting',
        stability: {
          version: 'policy.candidate_correction_temporal_stability.v1',
          statusId: 'persistent_review_signal',
          currentStatusId: 'review_recommended',
          previousStatusId: 'review_recommended',
          currentApplicableDecisionCount: 20,
          previousApplicableDecisionCount: 20,
        },
      },
    ],
  },
  cohortComposition: {
    version: 'policy.candidate_correction_cohort_composition.v1',
    statusId: 'composition_comparable',
    materialShiftDimensionCount: 0,
    comparableDimensionCount: 2,
    insufficientDataDimensionCount: 0,
    marginBands: {
      version: 'policy.candidate_correction_cohort_composition.v1',
      statusId: 'composition_comparable',
      currentObservationCount: 20,
      previousObservationCount: 20,
      minimumObservationCount: 20,
      materialShiftThresholdPercent: 20,
      totalVariationDistancePercent: 0,
      buckets: [
        ['0_to_4', 0],
        ['5_to_14', 20],
        ['15_to_29', 0],
        ['30_or_more', 0],
      ].map(([bucketId, observationCount]) => ({
        bucketId,
        currentObservationCount: observationCount,
        previousObservationCount: observationCount,
        currentSharePercent: observationCount ? 100 : 0,
        previousSharePercent: observationCount ? 100 : 0,
        sharePointChangePercent: 0,
      })),
    },
    evidenceSources: [
      {
        evidenceSourceId: 'declared_policy',
        comparison: {
          version: 'policy.candidate_correction_cohort_composition.v1',
          statusId: 'composition_comparable',
          currentObservationCount: 20,
          previousObservationCount: 20,
          minimumObservationCount: 20,
          materialShiftThresholdPercent: 20,
          totalVariationDistancePercent: 0,
          buckets: [
            ['anchored', 0],
            ['supporting', 20],
            ['contextual', 0],
            ['conflicting', 0],
            ['unavailable', 0],
          ].map(([stateId, observationCount]) => ({
            bucketId: `declared_policy:${stateId}`,
            currentObservationCount: observationCount,
            previousObservationCount: observationCount,
            currentSharePercent: observationCount ? 100 : 0,
            previousSharePercent: observationCount ? 100 : 0,
            sharePointChangePercent: 0,
          })),
        },
      },
    ],
  },
}

describe('PolicyCandidateCorrectionAnalyticsStats.vue', () => {
  it('renders fixed aggregate-only content with semantic tables and no controls', async () => {
    api.getPolicyCandidateCorrectionAnalyticsMetrics.mockResolvedValue(report)

    const wrapper = mount(PolicyCandidateCorrectionAnalyticsStats)
    await flushPromises()

    expect(api.getPolicyCandidateCorrectionAnalyticsMetrics).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Policy Correction Analytics')
    expect(wrapper.text()).toContain('5–14 points')
    expect(wrapper.text()).toContain('Declared policy')
    expect(wrapper.text()).toContain('10 (50%)')
    expect(wrapper.text()).toContain('Review outcome pattern')
    expect(wrapper.text()).toContain('Persistent review signal')
    expect(wrapper.text()).toContain('Cohort-composition context')
    expect(wrapper.text()).toContain('Cohort mix is comparable')
    expect(wrapper.text()).toContain('95% Wilson interval: 29.9%–70.1%')
    expect(wrapper.text()).toContain('do not establish correctness or change policy, AI, RAG, learning, or routing')
    expect(wrapper.findAll('table')).toHaveLength(6)
    expect(wrapper.findAll('caption')).toHaveLength(6)
    expect(wrapper.findAll('th[scope="col"]')).toHaveLength(33)
    expect(wrapper.findAll('th[scope="row"]')).toHaveLength(15)
    expect(wrapper.find('[role="status"]').attributes('aria-atomic')).toBe('true')
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Do not display')
  })

  it('renders fixed error copy instead of request error content', async () => {
    api.getPolicyCandidateCorrectionAnalyticsMetrics.mockRejectedValue(
      new Error('Private provider and RAG text must not render'),
    )

    const wrapper = mount(PolicyCandidateCorrectionAnalyticsStats)
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('Policy correction analytics are currently unavailable.')
    expect(wrapper.text()).not.toContain('Private provider')
  })
})
