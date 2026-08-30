/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'

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
  candidateSetPolicyReview: {
    statusId: 'candidate_set_review_recommended',
    applicableDecisionCount: 20,
    minimumApplicableDecisionCount: 20,
    outsideCandidateOutcomeCount: 3,
    minimumOutsideCandidateOutcomeCount: 3,
    outsideCandidateRatePercent: 15,
    minimumOutsideCandidateRatePercent: 15,
  },
  policyConfirmationEvidence: {
    statusId: 'evidence_mix_inconclusive',
    confirmationObservationCount: 20,
    minimumObservationCount: 20,
    declaredScope: {
      specializedEvidenceCount: 11,
      specializedEvidenceRatePercent: 55,
      compatibilityOnlyEvidenceCount: 5,
      compatibilityOnlyEvidenceRatePercent: 25,
      noDeclaredEvidenceCount: 4,
      noDeclaredEvidenceRatePercent: 20,
      minimumSpecializedEvidenceRatePercent: 60,
      specializedEvidenceConfidenceInterval: {
        methodId: 'wilson_score',
        confidenceLevelPercent: 95,
        lowerRatePercent: 34.2,
        upperRatePercent: 74.2,
      },
    },
    calibration: {
      appliedCount: 9,
      appliedRatePercent: 45,
    },
    supportingEvidenceSources: [
      { id: 'observed_profile', count: 8, ratePercent: 40 },
      { id: 'confirmed_pattern', count: 3, ratePercent: 15 },
      { id: 'similar_items', count: 7, ratePercent: 35 },
      { id: 'prior_outcomes', count: 2, ratePercent: 10 },
    ],
  },
  readiness: {
    statusId: 'observing',
    message: 'Private prompt text must not render.',
  },
}

describe('CurrentLibraryCandidateRetrievalStats.vue', () => {
  it('renders aggregate telemetry and agreement limits without control affordances', async () => {
    api.getCurrentLibraryCandidateRetrievalMetrics.mockResolvedValue(report)

    const wrapper = mount(CurrentLibraryCandidateRetrievalStats, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    await flushPromises()

    expect(api.getCurrentLibraryCandidateRetrievalMetrics).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Candidate Retrieval Monitoring')
    expect(wrapper.text()).toContain('Aggregate latency, catalog-match, candidate-set, policy-confirmation evidence, and AI/operator-agreement telemetry')
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
    expect(wrapper.text()).toContain('Candidate-set policy review')
    expect(wrapper.text()).toContain('Review deterministic candidate-set evidence')
    expect(wrapper.text()).toContain('20 / 20')
    expect(wrapper.text()).toContain('3 (15%)')
    expect(wrapper.text()).toContain('This does not prove an AI or retrieval error')
    expect(wrapper.text()).toContain('Policy confirmation evidence')
    expect(wrapper.text()).toContain('Policy confirmation evidence is not yet conclusive')
    expect(wrapper.text()).toContain('95% Wilson interval: 34.2%–74.2%')
    expect(wrapper.text()).toContain('cannot by itself prompt a policy-scope review')
    expect(wrapper.findComponent(RouterLinkStub).exists()).toBe(false)
    expect(wrapper.text()).toContain('11 (55%)')
    expect(wrapper.text()).toContain('Compatibility-only declared evidence')
    expect(wrapper.text()).toContain('5 (25%)')
    expect(wrapper.text()).toContain('No declared policy evidence')
    expect(wrapper.text()).toContain('4 (20%)')
    expect(wrapper.text()).toContain('Observed library profile')
    expect(wrapper.text()).toContain('8 (40%)')
    expect(wrapper.text()).toContain('does not prove an error or authorize more AI use')
    expect(wrapper.find('[role="status"]').attributes('aria-atomic')).toBe('true')
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Private prompt text')
  })

  it('exposes the existing maintenance handoff only after a confidently weak cohort', async () => {
    api.getCurrentLibraryCandidateRetrievalMetrics.mockResolvedValue({
      ...report,
      policyConfirmationEvidence: {
        ...report.policyConfirmationEvidence,
        statusId: 'declared_scope_review_recommended',
        declaredScope: {
          ...report.policyConfirmationEvidence.declaredScope,
          specializedEvidenceCount: 2,
          specializedEvidenceRatePercent: 10,
          specializedEvidenceConfidenceInterval: {
            methodId: 'wilson_score',
            confidenceLevelPercent: 95,
            lowerRatePercent: 2.8,
            upperRatePercent: 30.1,
          },
        },
      },
    })

    const wrapper = mount(CurrentLibraryCandidateRetrievalStats, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Review declared policy scope')
    const reviewLink = wrapper.findComponent(RouterLinkStub)
    expect(reviewLink.text()).toBe('Review existing policy purpose coverage')
    expect(reviewLink.props('to')).toEqual({
      name: 'PolicyNativeIntentReconciliation',
      query: { focus: 'purpose-coverage' },
    })
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

  it('fails closed to fixed copy for an unknown policy-review status', async () => {
    api.getCurrentLibraryCandidateRetrievalMetrics.mockResolvedValue({
      ...report,
      candidateSetPolicyReview: {
        ...report.candidateSetPolicyReview,
        statusId: 'provider_supplied_status',
        message: 'Private provider response must not render.',
      },
    })

    const wrapper = mount(CurrentLibraryCandidateRetrievalStats)
    await flushPromises()

    expect(wrapper.text()).toContain('Candidate-set review is unavailable')
    expect(wrapper.text()).not.toContain('Private provider response')
  })

  it('filters unknown policy-confirmation evidence sources and statuses', async () => {
    api.getCurrentLibraryCandidateRetrievalMetrics.mockResolvedValue({
      ...report,
      policyConfirmationEvidence: {
        ...report.policyConfirmationEvidence,
        statusId: 'provider_supplied_status',
        supportingEvidenceSources: [
          ...report.policyConfirmationEvidence.supportingEvidenceSources,
          { id: 'provider_supplied_source', count: 99, ratePercent: 99 },
        ],
      },
    })

    const wrapper = mount(CurrentLibraryCandidateRetrievalStats)
    await flushPromises()

    expect(wrapper.text()).toContain('Policy confirmation evidence is unavailable')
    expect(wrapper.text()).not.toContain('provider_supplied_source')
    expect(wrapper.text()).not.toContain('99 (99%)')
    expect(wrapper.findComponent(RouterLinkStub).exists()).toBe(false)
  })
})
