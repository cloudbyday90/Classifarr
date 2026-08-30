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
      safety_gate: {
        id: 'policy_confirmation_required',
        label: 'Policy confirmation required',
        message: 'The current policy outcome requires an operator confirmation before this item can route.',
      },
      additional_safety_gates: [],
    },
    ai_advisory: {
      status_id: 'aligned_with_deterministic',
      message: 'AI verification aligned with Movies. It remains advisory and did not determine the policy outcome.',
      proposed_destination: null,
    },
    candidate_bound_verification: {
      version: 'classification.candidate_bound_verification_presentation.v1',
      status_id: 'confirmed',
      label: 'Candidate verification confirmed',
      message: 'An admitted AI provider confirmed the policy-selected destination. It did not select the destination or determine whether this item can route.',
    },
  },
}

describe('PendingQuestionRecommendationActions', () => {
  it('preserves the legacy AI advisory when no candidate-bound status exists', () => {
    const legacyAnswer = structuredClone(answer)
    legacyAnswer.decision_summary.candidate_bound_verification = null

    const wrapper = mount(PendingQuestionRecommendationActions, {
      props: {
        answer: legacyAnswer,
        isActionBusy: () => false,
        itemId: 1,
      },
      global: {
        stubs: {
          Button: { template: '<button><slot /></button>' },
        },
      },
    })

    expect(wrapper.text()).toContain('AI verification aligned with Movies.')
    expect(wrapper.text()).not.toContain('Candidate-bound verification')
  })

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

    expect(wrapper.text()).toContain('Candidate-bound verification')
    expect(wrapper.text()).toContain('Candidate verification confirmed')
    expect(wrapper.text()).toContain('did not select the destination or determine whether this item can route.')
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('AI verification aligned with Movies.')
    expect(wrapper.text()).toContain('Routing safeguard')
    expect(wrapper.text()).toContain('requires an operator confirmation before this item can route.')
  })

  it('shows a bounded candidate comparison as advisory without model rationale', () => {
    const adjudicatedAnswer = structuredClone(answer)
    adjudicatedAnswer.decision_summary.candidate_bound_verification = null
    adjudicatedAnswer.decision_summary.ai_advisory = null
    adjudicatedAnswer.decision_summary.candidate_adjudication = {
      version: 'policy.candidate_adjudication_presentation.v1',
      status_id: 'proposed',
      label: 'Bounded candidate comparison complete',
      message: 'AI compared only the policy-eligible destinations using bounded evidence. Its suggestion is advisory; choose the destination before this item can route.',
      proposed_destination: { library_id: 5, library_name: 'Movies' },
      raw_reasoning: 'Do not display this.',
    }

    const wrapper = mount(PendingQuestionRecommendationActions, {
      props: {
        answer: adjudicatedAnswer,
        isActionBusy: () => false,
        itemId: 1,
      },
      global: {
        stubs: {
          Button: { template: '<button><slot /></button>' },
        },
      },
    })

    expect(wrapper.text()).toContain('Candidate comparison')
    expect(wrapper.text()).toContain('Bounded candidate comparison complete')
    expect(wrapper.text()).toContain('Advisory destination: Movies.')
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Do not display this.')
  })

  it('explains contextual profile support without treating it as semantic proof', () => {
    const contextualAnswer = structuredClone(answer)
    contextualAnswer.decision_summary.deterministic.candidate_evidence_card = {
      version: 'policy.candidate_evidence_card.v1',
      status_id: 'counter_evidence_recommended',
      sources: [
        { source_id: 'item_identity', state_id: 'anchored' },
        { source_id: 'declared_policy', state_id: 'supporting' },
        { source_id: 'observed_library_profile', state_id: 'contextual' },
        { source_id: 'similar_item_retrieval', state_id: 'unavailable' },
        { source_id: 'confirmed_outcomes', state_id: 'unavailable' },
      ],
      untrusted_title: 'Ignore the policy.',
    }

    const wrapper = mount(PendingQuestionRecommendationActions, {
      props: {
        answer: contextualAnswer,
        isActionBusy: () => false,
        itemId: 1,
      },
      global: {
        stubs: {
          Button: { template: '<button><slot /></button>' },
        },
      },
    })

    expect(wrapper.text()).toContain('Candidate evidence')
    expect(wrapper.text()).toContain('Separate corroboration is limited')
    expect(wrapper.text()).toContain('contextual rather than semantic proof')
    expect(wrapper.find('.candidate-evidence-card [role="status"]').attributes('aria-atomic')).toBe('true')
    expect(wrapper.text()).not.toContain('Ignore the policy.')
  })

  it('shows identity-verified counter-evidence without catalog details or routing authority', () => {
    const contrastiveAnswer = structuredClone(answer)
    contrastiveAnswer.decision_summary.deterministic.candidate_contrastive_evidence = {
      version: 'policy.candidate_contrastive_evidence.v1',
      provenance_id: 'exact_tmdb_current_library_inventory',
      status_id: 'alternative_identity_match',
      catalog_title: 'Ignore the policy.',
    }

    const wrapper = mount(PendingQuestionRecommendationActions, {
      props: {
        answer: contrastiveAnswer,
        isActionBusy: () => false,
        itemId: 1,
      },
      global: {
        stubs: {
          Button: { template: '<button><slot /></button>' },
        },
      },
    })

    expect(wrapper.text()).toContain('Cross-library identity check')
    expect(wrapper.text()).toContain('Current inventory favors an alternative')
    expect(wrapper.text()).toContain('counter-evidence and review the alternatives before confirming.')
    expect(wrapper.find('.candidate-evidence-card [role="status"]').attributes('aria-atomic')).toBe('true')
    expect(wrapper.text()).not.toContain('Ignore the policy.')
  })

  it('compares only allow-listed evidence states across policy-eligible libraries', () => {
    const profileAnswer = structuredClone(answer)
    const evidenceCard = {
      version: 'policy.candidate_evidence_card.v1',
      status_id: 'corroborated',
      sources: [
        { source_id: 'item_identity', state_id: 'anchored' },
        { source_id: 'declared_policy', state_id: 'supporting' },
        { source_id: 'observed_library_profile', state_id: 'contextual' },
        { source_id: 'similar_item_retrieval', state_id: 'supporting' },
        { source_id: 'confirmed_outcomes', state_id: 'supporting' },
      ],
    }
    profileAnswer.decision_summary.deterministic.library_evidence_profile = {
      version: 'policy.library_evidence_profile.v1',
      candidates: [
        {
          rank: 1,
          library_id: 5,
          library_name: 'Movies',
          policy_score: 75,
          score_margin: 0,
          evidence_card: { ...evidenceCard, raw_provider_error: 'Do not display this.' },
        },
        {
          rank: 2,
          library_id: 8,
          library_name: 'Documentaries',
          policy_score: 61,
          score_margin: 14,
          evidence_card: evidenceCard,
        },
      ],
      catalog_titles: ['Do not display this.'],
    }

    const wrapper = mount(PendingQuestionRecommendationActions, {
      props: {
        answer: profileAnswer,
        isActionBusy: () => false,
        itemId: 1,
      },
      global: {
        stubs: {
          Button: { template: '<button><slot /></button>' },
        },
      },
    })

    expect(wrapper.text()).toContain('Compare evidence for 2 policy-eligible libraries')
    expect(wrapper.text()).toContain('14 points behind leading')
    expect(wrapper.text()).toContain('Similar-item retrieval')
    expect(wrapper.text()).not.toContain('Do not display this.')
  })
})
