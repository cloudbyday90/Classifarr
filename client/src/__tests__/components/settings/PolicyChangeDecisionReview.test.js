/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const getPolicyCandidateCorrectionPolicyChangeDecisionRecord = vi.fn()
const createPolicyCandidateCorrectionPolicyChangeDecisionRecord = vi.fn()
const revisePolicyCandidateCorrectionPolicyChangeDecisionRecord = vi.fn()

vi.mock('@/api', () => ({
  default: {
    getPolicyCandidateCorrectionPolicyChangeDecisionRecord,
    createPolicyCandidateCorrectionPolicyChangeDecisionRecord,
    revisePolicyCandidateCorrectionPolicyChangeDecisionRecord,
  },
}))

const { default: PolicyChangeDecisionReview } = await import('@/components/settings/PolicyChangeDecisionReview.vue')

const HYPOTHESIS_ID = `pco_${'a'.repeat(32)}`

function outcomeObservation() {
  return {
    statusId: 'outcome_available',
    observation: { hypothesisId: HYPOTHESIS_ID },
    outcome: {},
  }
}

function reviewReady() {
  return {
    version: 'policy.candidate_correction_policy_change_decision_record.v1',
    statusId: 'review_ready',
    reviewAvailable: true,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    routingChanged: false,
    observation: {
      hypothesisId: HYPOTHESIS_ID,
      outcomeAvailableAt: '2026-08-30T00:00:00.000Z',
      expiresAt: '2026-09-29T00:00:00.000Z',
    },
    decision: null,
  }
}

function recordedDecision() {
  return {
    ...reviewReady(),
    statusId: 'decision_recorded',
    decision: {
      decisionId: 'retain_current_policy',
      rationaleId: 'outcome_improved',
      revision: 1,
      createdAt: '2026-08-31T12:00:00.000Z',
      updatedAt: '2026-08-31T12:00:00.000Z',
      expiresAt: '2026-09-29T00:00:00.000Z',
    },
  }
}

describe('PolicyChangeDecisionReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads review status automatically for a completed outcome and saves only after explicit confirmation', async () => {
    getPolicyCandidateCorrectionPolicyChangeDecisionRecord.mockResolvedValue(reviewReady())
    createPolicyCandidateCorrectionPolicyChangeDecisionRecord.mockResolvedValue({ data: recordedDecision() })

    const wrapper = mount(PolicyChangeDecisionReview, {
      props: { outcomeObservation: outcomeObservation() },
    })
    await flushPromises()

    expect(getPolicyCandidateCorrectionPolicyChangeDecisionRecord).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Aggregate outcome is ready for a reviewed decision')
    const submitButton = wrapper.get('button[type="submit"]')
    expect(submitButton.attributes('disabled')).toBeDefined()

    await wrapper.get('input[value="retain_current_policy"]').setValue()
    await wrapper.get('input[value="outcome_improved"]').setValue()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    expect(submitButton.attributes('disabled')).toBeUndefined()

    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(createPolicyCandidateCorrectionPolicyChangeDecisionRecord).toHaveBeenCalledWith({
      decisionId: 'retain_current_policy',
      rationaleId: 'outcome_improved',
    })
    expect(wrapper.text()).toContain('Reviewed decision saved.')
    expect(wrapper.text()).toContain('It did not change policy, AI, RAG, learning, retry, or routing.')
  })

  it('does not make a decision-record request until its parent outcome is complete', async () => {
    const wrapper = mount(PolicyChangeDecisionReview, {
      props: {
        outcomeObservation: { statusId: 'observing', observation: { hypothesisId: HYPOTHESIS_ID } },
      },
    })
    await flushPromises()

    expect(getPolicyCandidateCorrectionPolicyChangeDecisionRecord).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('will load automatically when the aggregate follow-up is ready')
  })
})
