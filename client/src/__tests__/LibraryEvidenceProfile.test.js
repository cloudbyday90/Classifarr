/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import LibraryEvidenceProfile from '@/components/command-center/LibraryEvidenceProfile.vue'

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

const value = {
  version: 'policy.library_evidence_profile.v1',
  candidates: [
    {
      rank: 1,
      library_id: 1,
      library_name: 'Movies',
      policy_score: 80,
      score_margin: 0,
      evidence_card: { ...evidenceCard, raw_title: 'Do not display' },
    },
    {
      rank: 2,
      library_id: 2,
      library_name: 'Documentaries',
      policy_score: 64,
      score_margin: 16,
      evidence_card: evidenceCard,
    },
  ],
}

describe('LibraryEvidenceProfile', () => {
  it('renders an accessible, read-only candidate comparison without raw evidence', () => {
    const wrapper = mount(LibraryEvidenceProfile, {
      props: { itemId: 42, value },
    })

    expect(wrapper.get('summary').text()).toContain('Compare 2 library choices')
    expect(wrapper.get('details').attributes('open')).toBeUndefined()
    expect(wrapper.get('table').attributes('aria-labelledby')).toBeUndefined()
    expect(wrapper.get('section').attributes('aria-labelledby')).toBe('library-evidence-profile-42')
    expect(wrapper.text()).toContain('Movies')
    expect(wrapper.text()).toContain('Documentaries')
    expect(wrapper.text()).toContain('16 points behind leading')
    expect(wrapper.text()).toContain('Declared policy')
    expect(wrapper.text()).toContain('Similar-item retrieval')
    expect(wrapper.text()).toContain('cannot route this item or change your policy')
    expect(wrapper.text()).not.toContain('Do not display')

    const headers = wrapper.findAll('th')
    expect(headers.some((header) => header.attributes('scope') === 'col')).toBe(true)
    expect(headers.some((header) => header.attributes('scope') === 'row')).toBe(true)
  })
})
