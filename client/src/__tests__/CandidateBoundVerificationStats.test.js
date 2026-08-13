/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import CandidateBoundVerificationStats from '@/views/statistics/CandidateBoundVerificationStats.vue'
import api from '@/api'

vi.mock('@/api', () => ({
  default: {
    getCandidateBoundVerificationMetrics: vi.fn(),
  },
}))

const report = {
  version: 'classification.candidate_bound_verification_metrics.v1',
  window: { days: 7 },
  current: {
    endDate: '2026-08-13',
    totalOutcomes: 20,
    statusCounts: [
      { statusId: 'confirmed', label: 'Confirmed', count: 17, ratePercent: 85 },
      { statusId: 'abstained', label: 'Abstained', count: 3, ratePercent: 15 },
    ],
  },
  previous: {
    totalOutcomes: 20,
    statusCounts: [
      { statusId: 'confirmed', label: 'Confirmed', count: 20, ratePercent: 100 },
    ],
  },
  driftGuard: {
    statusId: 'elevated',
    message: 'One or more verification safety outcomes increased materially.',
    signals: [
      {
        statusId: 'abstained',
        label: 'Abstained',
        status: 'elevated',
        currentCount: 3,
        previousCount: 0,
        rateChangePercentagePoints: 15,
      },
    ],
  },
}

describe('CandidateBoundVerificationStats.vue', () => {
  it('renders aggregate status counts and advisory drift without content fields', async () => {
    api.getCandidateBoundVerificationMetrics.mockResolvedValue(report)

    const wrapper = mount(CandidateBoundVerificationStats)
    await flushPromises()

    expect(api.getCandidateBoundVerificationMetrics).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Candidate Verification Monitoring')
    expect(wrapper.text()).toContain('Verification safety trend needs review')
    expect(wrapper.text()).toContain('Confirmed')
    expect(wrapper.text()).toContain('17 (85%)')
    expect(wrapper.text()).toContain('Elevated: 3 now, 0 prior (+15.0 pts)')
    expect(wrapper.text()).toContain('never changes routing or policy decisions')
  })

  it('renders a bounded unavailable state when the metrics request fails', async () => {
    api.getCandidateBoundVerificationMetrics.mockRejectedValue(new Error('provider content must not render'))

    const wrapper = mount(CandidateBoundVerificationStats)
    await flushPromises()

    expect(wrapper.text()).toContain('Candidate verification metrics are currently unavailable.')
    expect(wrapper.text()).not.toContain('provider content')
  })
})
