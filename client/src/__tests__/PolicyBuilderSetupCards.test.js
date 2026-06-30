/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyBuilderSetupCards from '@/components/policies/PolicyBuilderSetupCards.vue'

describe('PolicyBuilderSetupCards.vue', () => {
  it('renders the destination-first setup cards with concrete actions', () => {
    const wrapper = mount(PolicyBuilderSetupCards)

    expect(wrapper.text()).toContain('Policy Setup')
    expect(wrapper.text()).toContain('Start from destination meaning')
    expect(wrapper.text()).toContain('What already belongs here?')
    expect(wrapper.text()).toContain('What should always or never belong here?')
    expect(wrapper.text()).toContain('When should Classifarr ask?')
    expect(wrapper.text()).toContain('Can this destination route?')
    expect(wrapper.text()).toContain('Belongs Here')
    expect(wrapper.text()).toContain('Hard Limits')
    expect(wrapper.text()).toContain('Readiness')

    const actions = wrapper.findAll('a')
    expect(actions.map(action => action.text())).toEqual([
      'Review suggestions',
      'Set destination rules',
      'Set review triggers',
      'Check routing readiness',
    ])
    expect(actions.map(action => action.attributes('href'))).toEqual([
      '#policy-builder-library-context',
      '#policy-builder-destination-rules',
      '#policy-builder-review-behavior',
      '#policy-builder-advanced-settings',
    ])
  })
})
