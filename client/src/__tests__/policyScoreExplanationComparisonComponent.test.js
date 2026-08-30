/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import PolicyScoreExplanationComparison from '@/components/command-center/PolicyScoreExplanationComparison.vue'
import { buildPolicyScoreExplanationComparison } from '@/utils/policyScoreExplanationComparison'

function decisionPresentation(score, sourceId) {
  return {
    deterministic: {
      destination: { library_id: score, library_name: 'Do not render this destination' },
      review_threshold: 60,
      automatic_threshold: 85,
      score_explanation: {
        score,
        base_score: score - 5.5,
        agreement_multiplier_percent: 100,
        components: [{
          source_id: sourceId,
          evidence_score: score,
          normalized_weight_percent: 100,
          weighted_contribution: score - 5.5,
        }],
        calibration: {
          status_id: 'not_adjusted',
          pre_safety_score: null,
          provider_output: 'Do not render this provider output',
        },
      },
    },
  }
}

describe('PolicyScoreExplanationComparison', () => {
  it('renders bounded mechanics without decision identity or provider output', () => {
    const comparison = buildPolicyScoreExplanationComparison([
      decisionPresentation(71, 'declared_policy_intent'),
      decisionPresentation(68, 'similar_items'),
    ])
    const wrapper = mount(PolicyScoreExplanationComparison, {
      props: { comparison },
    })

    expect(wrapper.find('section[tabindex="-1"]').exists()).toBe(true)
    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.text()).toContain('Score range: 68/100 to 71/100.')
    expect(wrapper.text()).toContain('Declared policy intent')
    expect(wrapper.text()).toContain('Similar items (RAG)')
    expect(wrapper.text()).toContain('Not active')
    expect(wrapper.text()).not.toContain('Do not render this destination')
    expect(wrapper.text()).not.toContain('Do not render this provider output')
  })

  it('exposes programmatic focus only after the host renders the comparison', async () => {
    const comparison = buildPolicyScoreExplanationComparison([
      decisionPresentation(71, 'declared_policy_intent'),
      decisionPresentation(68, 'similar_items'),
    ])
    const wrapper = mount(PolicyScoreExplanationComparison, {
      attachTo: document.body,
      props: { comparison },
    })

    wrapper.vm.focus()
    await wrapper.vm.$nextTick()

    expect(document.activeElement).toBe(wrapper.find('section[tabindex="-1"]').element)
    wrapper.unmount()
  })
})
