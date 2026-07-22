/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ObservedProfileSummary from '@/components/policies/ObservedProfileSummary.vue'

const observedProfile = {
  available: true,
  current: true,
  suggestionCount: 2,
}

const suggestions = [
  { key: 'genre:Animation', label: 'Animation', count: 48 },
  { key: 'genre:Family', label: 'Family', count: 32 },
]

describe('ObservedProfileSummary.vue', () => {
  it('renders observed library values as read-only suggestions outside selection mode', () => {
    const wrapper = mount(ObservedProfileSummary, {
      props: {
        libraryName: 'Family Movies',
        observedProfile,
        suggestions,
      },
    })

    expect(wrapper.find('section').attributes('aria-labelledby')).toBe('policy-builder-observed-profile-title')
    expect(wrapper.text()).toContain('What Classifarr sees in Family Movies')
    expect(wrapper.text()).toContain('2 observed signals')
    expect(wrapper.text()).toMatch(/Animation\s*48\s*currently here/)
    expect(wrapper.text()).toMatch(/Family\s*32\s*currently here/)
    expect(wrapper.find('[aria-label="Observed library suggestions"]').exists()).toBe(true)
  })

  it('does not duplicate observed options while native selection is enabled', () => {
    const wrapper = mount(ObservedProfileSummary, {
      props: {
        libraryName: 'Family Movies',
        observedProfile,
        suggestions,
        selectionEnabled: true,
      },
    })

    expect(wrapper.text()).toContain('What Classifarr sees in Family Movies')
    expect(wrapper.find('[aria-label="Observed library suggestions"]').exists()).toBe(false)
  })

  it('explains when the observed profile is unavailable', () => {
    const wrapper = mount(ObservedProfileSummary, {
      props: {
        observedProfile: {
          available: false,
          current: false,
          suggestionCount: 0,
        },
      },
    })

    expect(wrapper.text()).toContain('Profile unavailable')
    expect(wrapper.text()).toContain('A current library profile is not available yet.')
  })
})
