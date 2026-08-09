/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import PendingQuestionRecommendationActions from '@/components/command-center/PendingQuestionRecommendationActions.vue'

const answer = {
  version: 'policy.runtime_question_answer.v1',
  fingerprint: 'fingerprint',
  question: { type: 'runtime_question' },
  allowed_actions: [{
    id: 'confirm_destination',
    available: true,
    destination_required: true,
  }],
  candidate_destinations: [{ library_id: 5, library_name: 'Movies' }],
  recommendation: {
    version: 'policy.runtime_question_recommendation_presentation.v1',
    status_id: 'leading_candidate_available',
    leading_destination: { library_id: 5, evidence_score: 75 },
    why_not_automatic: {
      reason_id: 'confirmation_required',
      message: 'Confirmation is required.',
    },
  },
  decision_summary: {
    version: 'policy.runtime_question_decision_presentation.v1',
    deterministic: {
      status_id: 'confirmation_required',
      destination: { library_id: 5, library_name: 'Movies' },
      score: 75,
      review_threshold: 60,
      automatic_threshold: 85,
      message: 'Movies meets the confirmation threshold but not the automatic threshold.',
      evidence: [],
    },
    ai_advisory: {
      status_id: 'aligned_with_deterministic',
      message: 'AI verification aligned with Movies. It remains advisory and did not determine the policy outcome.',
      proposed_destination: null,
    },
  },
}

describe('PendingQuestionRecommendationActions', () => {
  it('states that a verification aligned without giving it policy authority', () => {
    const wrapper = mount(PendingQuestionRecommendationActions, {
      props: {
        answer,
        isActionBusy: () => false,
        itemId: 1,
      },
      global: {
        stubs: {
          Button: { template: '<button><slot /></button>' },
        },
      },
    })

    expect(wrapper.text()).toContain('AI check')
    expect(wrapper.text()).toContain('AI verification aligned with Movies.')
    expect(wrapper.text()).toContain('did not determine the policy outcome.')
  })
})
