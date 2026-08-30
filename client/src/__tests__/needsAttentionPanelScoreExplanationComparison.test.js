/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import NeedsAttentionPanel from '@/components/command-center/NeedsAttentionPanel.vue'

function item(id, score, sourceId) {
  return {
    id,
    title: `Item ${id}`,
    media_type: 'movie',
    policy_question: { text: 'Confirm the destination?' },
    policy_question_answer: {
      version: 'policy.runtime_question_answer.v1',
      fingerprint: `item-${id}`,
      candidate_destinations: [{ library_id: 4, library_name: 'Movies' }],
      allowed_actions: [],
      decision_summary: {
        version: 'policy.runtime_question_decision_presentation.v1',
        deterministic: {
          status_id: 'confirmation_required',
          destination: { library_id: 4, library_name: 'Movies' },
          score,
          review_threshold: 60,
          automatic_threshold: 85,
          message: 'Operator confirmation is required.',
          evidence: [],
          score_explanation: {
            version: 'policy.runtime_question_score_explanation.v1',
            score,
            base_score: score - 5,
            agreement_multiplier_percent: 100,
            components: [{
              source_id: sourceId,
              evidence_score: score,
              normalized_weight_percent: 100,
              weighted_contribution: score - 5,
            }],
            calibration: {
              status_id: 'not_adjusted',
              pre_safety_score: null,
            },
          },
          safety_gate: null,
          additional_safety_gates: [],
        },
        ai_advisory: null,
      },
    },
  }
}

function mountPanel(items) {
  return mount(NeedsAttentionPanel, {
    attachTo: document.body,
    props: {
      changeMode: {},
      formatMediaType: value => value,
      isActionBusy: () => false,
      items,
      librariesForMediaType: () => [],
      manualLibraryByItemId: {},
      safePercent: value => value,
    },
    global: {
      stubs: {
        Button: { template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>', props: ['disabled'] },
        PendingQuestionRecommendationActions: { template: '<div />' },
      },
    },
  })
}

describe('NeedsAttentionPanel score explanation comparison', () => {
  it('keeps selection local, caps it, and focuses a requested comparison', async () => {
    const wrapper = mountPanel([
      item(1, 71, 'declared_policy_intent'),
      item(2, 68, 'similar_items'),
      item(3, 65, 'prior_outcomes'),
      item(4, 62, 'confirmed_pattern'),
    ])
    const checkboxes = wrapper.findAll('input[type="checkbox"]')

    expect(checkboxes).toHaveLength(4)
    await checkboxes[0].setValue(true)
    expect(wrapper.text()).toContain('Select 1 more to compare.')
    await checkboxes[1].setValue(true)

    const compareButton = wrapper.findAll('button').find(button => (
      button.text() === 'Compare selected score explanations'
    ))
    expect(compareButton?.attributes('disabled')).toBeUndefined()
    await compareButton.trigger('click')

    const comparison = wrapper.find('.score-explanation-comparison')
    expect(comparison.exists()).toBe(true)
    expect(document.activeElement).toBe(comparison.element)

    await checkboxes[2].setValue(true)
    expect(wrapper.text()).toContain('3 score explanations selected. Maximum reached.')
    expect(checkboxes[3].attributes('disabled')).toBeDefined()
    expect(wrapper.find('.score-explanation-comparison').exists()).toBe(false)
    wrapper.unmount()
  })
})
