/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import PolicyCandidateContrastiveOutcomeStats from '@/views/statistics/PolicyCandidateContrastiveOutcomeStats.vue'
import api from '@/api'

vi.mock('@/api', () => ({
  default: {
    getPolicyCandidateContrastiveOutcomeMetrics: vi.fn(),
  },
}))

const report = {
  version: 'policy.candidate_contrastive_outcome_metrics.v1',
  window: { days: 7, startDate: '2026-08-23', endDate: '2026-08-30' },
  buckets: [
    {
      statusId: 'alternative_identity_match',
      observationCount: 10,
      resolvedOutcomeCount: 8,
      attributedOutcomeCount: 6,
      confirmedCandidateOutcomeCount: 1,
      changedToCandidateOutcomeCount: 3,
      changedOutsideCandidateOutcomeCount: 2,
      routedNotApplicableOutcomeCount: 0,
      changedSelectionRatePercent: 83.3,
      outsideCandidateRatePercent: 33.3,
      catalogTitle: 'Private catalog title',
    },
  ],
}

describe('PolicyCandidateContrastiveOutcomeStats.vue', () => {
  it('renders fixed aggregate-only content with semantic table markup and no controls', async () => {
    api.getPolicyCandidateContrastiveOutcomeMetrics.mockResolvedValue(report)

    const wrapper = mount(PolicyCandidateContrastiveOutcomeStats)
    await flushPromises()

    expect(api.getPolicyCandidateContrastiveOutcomeMetrics).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Inventory Contrast Monitoring')
    expect(wrapper.text()).toContain('Alternative only')
    expect(wrapper.text()).toContain('10')
    expect(wrapper.text()).toContain('5 (83.3%)')
    expect(wrapper.text()).toContain('does not prove a retrieval, AI, or routing error')
    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.find('caption').text()).toContain('Aggregate contrastive identity-check')
    expect(wrapper.findAll('th[scope="col"]')).toHaveLength(7)
    expect(wrapper.findAll('th[scope="row"]')).toHaveLength(1)
    expect(wrapper.find('[role="status"]').attributes('aria-atomic')).toBe('true')
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Private catalog title')
  })

  it('renders fixed error copy instead of request error content', async () => {
    api.getPolicyCandidateContrastiveOutcomeMetrics.mockRejectedValue(
      new Error('Private provider and catalog text must not render'),
    )

    const wrapper = mount(PolicyCandidateContrastiveOutcomeStats)
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('Inventory contrast metrics are currently unavailable.')
    expect(wrapper.text()).not.toContain('Private provider')
  })
})
