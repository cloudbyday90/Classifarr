/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const getPolicyCandidateCorrectionPolicyChangeReviewHistorySummary = vi.fn()

vi.mock('@/api', () => ({
  default: { getPolicyCandidateCorrectionPolicyChangeReviewHistorySummary },
}))

const { default: PolicyChangeReviewHistorySummary } =
  await import('@/components/settings/PolicyChangeReviewHistorySummary.vue')

function response() {
  return {
    version: 'policy.candidate_correction_policy_change_review_history_summary.v3',
    statusId: 'available',
    historyAvailable: true,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    routingChanged: false,
    consistency: {
      statusId: 'consistent',
      comparisonAvailable: true,
      automaticPolicyChange: false,
      automaticAiRagTuning: false,
      routingChanged: false,
    },
    calibrationReadiness: {
      statusId: 'ready_for_human_review',
      reviewEligible: true,
      automaticPolicyChange: false,
      automaticAiRagTuning: false,
      routingChanged: false,
    },
    periods: [{
      periodId: 'most_recent_completed',
      conclusionSummaries: [
        { decisionId: 'retain_current_policy', recordedCount: 1, revisedCount: 0, totalCount: 1 },
        { decisionId: 'investigate_policy_evidence', recordedCount: 0, revisedCount: 1, totalCount: 1 },
        { decisionId: 'prepare_manual_policy_change', recordedCount: 0, revisedCount: 0, totalCount: 0 },
      ],
    }],
  }
}

describe('PolicyChangeReviewHistorySummary', () => {
  const wrappers = []

  beforeEach(() => vi.clearAllMocks())
  afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

  it('loads automatically and renders a captioned semantic aggregate table', async () => {
    getPolicyCandidateCorrectionPolicyChangeReviewHistorySummary.mockResolvedValue(response())
    const wrapper = mount(PolicyChangeReviewHistorySummary)
    wrappers.push(wrapper)
    await flushPromises()

    expect(getPolicyCandidateCorrectionPolicyChangeReviewHistorySummary).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Completed review activity is available')
    expect(wrapper.text()).toContain('Review process is consistent across completed periods')
    expect(wrapper.text()).toContain('Calibration review is ready for human evaluation')
    expect(wrapper.get('table caption').text()).toBe('Most recent completed 30-day period')
    expect(wrapper.findAll('th[scope="col"]')).toHaveLength(4)
    expect(wrapper.findAll('th[scope="row"]')).toHaveLength(3)
    expect(wrapper.text()).toContain('Retain the current policy')
    expect(wrapper.text()).toContain('These are coarse workflow counts')
  })
})
