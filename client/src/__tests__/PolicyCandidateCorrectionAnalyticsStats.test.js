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

const report = {
  version: 'policy.candidate_correction_analytics_metrics.v1',
  window: { days: 7, startDate: '2026-08-23', endDate: '2026-08-30' },
  marginBuckets: [
    {
      marginBandId: '5_to_14',
      outcomeCount: 10,
      confirmedLeaderOutcomeCount: 4,
      changedToCandidateOutcomeCount: 3,
      changedOutsideCandidatesOutcomeCount: 2,
      routedNotApplicableOutcomeCount: 1,
      privateDestination: 'Do not display',
    },
  ],
  evidenceSourceStateBuckets: [
    {
      evidenceSourceId: 'declared_policy',
      evidenceStateId: 'supporting',
      outcomeCount: 10,
      confirmedLeaderOutcomeCount: 4,
      changedToCandidateOutcomeCount: 3,
      changedOutsideCandidatesOutcomeCount: 2,
      routedNotApplicableOutcomeCount: 1,
      rawRagText: 'Do not display',
    },
  ],
  summary: {
    outcomeCount: 10,
    confirmedLeaderOutcomeCount: 4,
    changedToCandidateOutcomeCount: 3,
    changedOutsideCandidatesOutcomeCount: 2,
    routedNotApplicableOutcomeCount: 1,
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
    expect(wrapper.text()).toContain('5 (55.6%)')
    expect(wrapper.text()).toContain('do not establish correctness or change policy, AI, RAG, learning, or routing')
    expect(wrapper.findAll('table')).toHaveLength(2)
    expect(wrapper.findAll('caption')).toHaveLength(2)
    expect(wrapper.findAll('th[scope="col"]')).toHaveLength(11)
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
