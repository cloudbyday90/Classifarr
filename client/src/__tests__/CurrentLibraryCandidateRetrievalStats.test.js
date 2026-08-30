/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import CurrentLibraryCandidateRetrievalStats from '@/views/statistics/CurrentLibraryCandidateRetrievalStats.vue'
import api from '@/api'

vi.mock('@/api', () => ({
  default: {
    getCurrentLibraryCandidateRetrievalMetrics: vi.fn(),
  },
}))

const report = {
  version: 'current_library.candidate_retrieval_metrics.v1',
  window: { days: 7, endDate: '2026-08-30' },
  retrieval: {
    observationCount: 10,
    availableCount: 9,
    unavailableCount: 1,
    availabilityRatePercent: 90,
    matchingObservationCount: 6,
    directMatchObservationCount: 4,
    latencyBands: [
      { id: 'under_25ms', label: 'Under 25 ms', count: 5, ratePercent: 50 },
    ],
  },
  operatorAgreement: {
    proposalCount: 5,
    resolvedProposalCount: 4,
    agreedProposalCount: 3,
    alternativeProposalCount: 1,
    pendingProposalCount: 1,
    agreementRatePercent: 75,
  },
  operatorCandidateSetAttribution: {
    attributedOperatorOutcomeCount: 4,
    confirmedCandidateOutcomeCount: 2,
    changedToCandidateOutcomeCount: 1,
    changedOutsideCandidateOutcomeCount: 1,
    routedNotApplicableOutcomeCount: 0,
    unattributedResolvedOutcomeCount: 2,
    candidateSetSelectionRatePercent: 75,
  },
  readiness: {
    statusId: 'observing',
    message: 'Private prompt text must not render.',
  },
}

describe('CurrentLibraryCandidateRetrievalStats.vue', () => {
  it('renders aggregate telemetry and agreement limits without control affordances', async () => {
    api.getCurrentLibraryCandidateRetrievalMetrics.mockResolvedValue(report)

    const wrapper = mount(CurrentLibraryCandidateRetrievalStats)
    await flushPromises()

    expect(api.getCurrentLibraryCandidateRetrievalMetrics).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Candidate Retrieval Monitoring')
    expect(wrapper.text()).toContain('Aggregate latency, catalog-match, candidate-set, and AI/operator-agreement telemetry')
    expect(wrapper.text()).toContain('Same destination')
    expect(wrapper.text()).toContain('3 (75%)')
    expect(wrapper.text()).toContain('Under 25 ms')
    expect(wrapper.text()).toContain('5 (50%)')
    expect(wrapper.text()).toContain('not a correctness rate')
    expect(wrapper.text()).toContain('Operator candidate-set coverage')
    expect(wrapper.text()).toContain('Broader chooser, outside candidates')
    expect(wrapper.text()).toContain('Routed not applicable')
    expect(wrapper.text()).toContain('3 (75%)')
    expect(wrapper.text()).toContain('does not prove a retrieval or AI error')
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Private prompt text')
  })

  it('renders a bounded error instead of request error content', async () => {
    api.getCurrentLibraryCandidateRetrievalMetrics.mockRejectedValue(
      new Error('Private provider and prompt text must not render'),
    )

    const wrapper = mount(CurrentLibraryCandidateRetrievalStats)
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('Candidate retrieval metrics are currently unavailable.')
    expect(wrapper.text()).not.toContain('Private provider')
  })
})
