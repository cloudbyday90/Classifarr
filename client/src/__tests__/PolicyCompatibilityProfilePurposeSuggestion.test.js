/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyCompatibilityProfilePurposeSuggestion from '@/components/policies/PolicyCompatibilityProfilePurposeSuggestion.vue'

const suggestion = {
  statusId: 'available',
  available: true,
  profile: { itemCount: 44, generatedAt: '2026-08-28T15:00:00.000Z' },
  suggestion: {
    rules: [{
      signalType: 'genres',
      operator: 'require_any',
      values: ['Animation', 'Family'],
      semantics: 'identity',
      constraintMode: 'advisory',
    }],
  },
}

describe('PolicyCompatibilityProfilePurposeSuggestion.vue', () => {
  it('shows an explicit, unsaved profile suggestion and emits only an apply request', async () => {
    const wrapper = mount(PolicyCompatibilityProfilePurposeSuggestion, {
      props: { suggestion, selectedPresetCount: 1 },
    })

    expect(wrapper.text()).toContain('Profile-based purpose suggestion')
    expect(wrapper.text()).toContain('does not change this policy')
    expect(wrapper.text()).toContain('Animation, Family')
    expect(wrapper.find('button').text()).toBe('Add suggested rule to draft')

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('apply')).toEqual([[]])
  })

  it('withholds the draft action when policy-context selection would be ambiguous', () => {
    const wrapper = mount(PolicyCompatibilityProfilePurposeSuggestion, {
      props: { suggestion, selectedPresetCount: 2 },
    })

    expect(wrapper.text()).toContain('multiple policy contexts')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('explains why no profile draft is available without inventing a rule', () => {
    const wrapper = mount(PolicyCompatibilityProfilePurposeSuggestion, {
      props: {
        suggestion: { statusId: 'profile_stale', available: false },
      },
    })

    expect(wrapper.text()).toContain('stale library profile')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })
})
