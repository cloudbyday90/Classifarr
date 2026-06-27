/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyCombinedSignalsSummary from '@/components/policies/PolicyCombinedSignalsSummary.vue'

const combinedSignals = {
  certifications: {
    include: [{ value: 'PG', sources: ['Family', 'Animated'] }],
  },
  genres: {
    prefer: [{ value: 'Animation', sources: ['Animated'] }],
    exclude: [{ value: 'Horror', sources: ['Family'] }],
  },
  keywords: {
    prefer: [{ value: 'disney', sources: ['Animated'] }],
    exclude: [{ value: 'slasher', sources: ['Family'] }],
    require_any: [{ value: 'princess', sources: ['Family', 'Animated'] }],
  },
}

describe('PolicyCombinedSignalsSummary.vue', () => {
  it('does not render for a single selected starter template', () => {
    const wrapper = mount(PolicyCombinedSignalsSummary, {
      props: {
        presetCount: 1,
        combinedSignals,
      },
    })

    expect(wrapper.text()).toBe('')
  })

  it('renders visible combined signal sections with source counts', () => {
    const wrapper = mount(PolicyCombinedSignalsSummary, {
      props: {
        presetCount: 2,
        combinedSignals,
      },
    })

    expect(wrapper.text()).toContain('Combined Signals (2 presets)')
    expect(wrapper.text()).toContain('Content Ratings (included):')
    expect(wrapper.text()).toContain('PG (2)')
    expect(wrapper.text()).toContain('Preferred Genres:')
    expect(wrapper.text()).toContain('Animation (1)')
    expect(wrapper.text()).toContain('Excluded Genres:')
    expect(wrapper.text()).toContain('✕ Horror (1)')
    expect(wrapper.text()).toContain('Required Keywords (any match):')
    expect(wrapper.text()).toContain('princess (2)')
  })

  it('omits empty sections', () => {
    const wrapper = mount(PolicyCombinedSignalsSummary, {
      props: {
        presetCount: 2,
        combinedSignals: {
          certifications: { include: [] },
          genres: { prefer: [], exclude: [] },
          keywords: { prefer: [], exclude: [], require_any: [] },
        },
      },
    })

    expect(wrapper.text()).toContain('Combined Signals (2 presets)')
    expect(wrapper.text()).not.toContain('Content Ratings (included):')
    expect(wrapper.text()).not.toContain('Preferred Genres:')
  })
})
