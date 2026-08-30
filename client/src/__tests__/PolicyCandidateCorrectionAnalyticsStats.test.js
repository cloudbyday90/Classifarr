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
    expect(wrapper.text()).toContain('95% Wilson interval: 29.9%–70.1%')
    expect(wrapper.text()).toContain('do not establish correctness or change policy, AI, RAG, learning, or routing')
    expect(wrapper.findAll('table')).toHaveLength(2)
    expect(wrapper.findAll('caption')).toHaveLength(2)
    expect(wrapper.findAll('th[scope="col"]')).toHaveLength(15)
    expect(wrapper.findAll('th[scope="row"]')).toHaveLength(5)
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
