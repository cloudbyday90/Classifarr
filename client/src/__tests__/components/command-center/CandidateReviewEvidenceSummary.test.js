/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import CandidateReviewEvidenceSummary from '@/components/command-center/CandidateReviewEvidenceSummary.vue'

describe('CandidateReviewEvidenceSummary', () => {
  it('keeps source-level evidence and advisory comparison inside one user-controlled disclosure', () => {
    const wrapper = mount(CandidateReviewEvidenceSummary, {
      props: {
        itemId: 42,
        candidateEvidence: {
          status_id: 'counter_evidence_recommended',
          sources: [{
            id: 'observed_library_profile',
            label: 'Existing library fit',
            message: 'Titles already in this library make it a plausible fit, but they do not prove this item belongs here.',
          }],
        },
        contrastiveEvidence: {
          status_id: 'no_candidate_identity_match',
          label: 'Current inventory provides no cross-check',
          message: 'No viable candidate currently contains this exact stable item identity.',
        },
        candidateAdjudication: {
          label: 'Bounded candidate comparison complete',
          message: 'AI compared only the policy-eligible destinations using bounded evidence.',
          proposed_destination: { library_name: 'Movies' },
        },
      },
    })

    expect(wrapper.text()).toContain('This destination is plausible, but not proven')
    expect(wrapper.find('details').attributes('open')).toBeUndefined()
    expect(wrapper.find('summary').text()).toBe('Review evidence details')
    expect(wrapper.text()).toContain('Existing library fit')
    expect(wrapper.text()).toContain('AI comparison')
    expect(wrapper.text()).toContain('Advisory destination: Movies.')
  })
})
