/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyStarterTemplateAccelerator from '@/components/policies/PolicyStarterTemplateAccelerator.vue'

const presets = [
  {
    id: 1,
    name: 'Animated Family',
    description: 'Animation and family signals',
    category: 'family',
    icon: '🎬',
    usage_count: 2,
    suggestion_score: 92,
  },
  {
    id: 2,
    name: 'Comedy',
    description: 'Comedy signals',
    category: 'comedy',
    usage_count: 1,
  },
]

function mountAccelerator(overrides = {}) {
  return mount(PolicyStarterTemplateAccelerator, {
    props: {
      searchQuery: '',
      selectedCategory: 'all',
      suggestedPresets: [presets[0]],
      availablePresets: [presets[1]],
      selectedPresets: [],
      allPresets: presets,
      categoryTabs: [
        { value: 'all', label: 'All', count: 2 },
        { value: 'family', label: 'Family', count: 1 },
      ],
      expandedPresetIds: new Set(),
      availableRatings: ['PG'],
      availableGenres: ['Family'],
      combinedSignals: {},
      getPresetUsageCount: preset => preset?.usage_count ?? 0,
      formatUsageLabel: count => `Used in ${count} ${count === 1 ? 'policy' : 'policies'}`,
      ...overrides.props,
    },
  })
}

describe('PolicyStarterTemplateAccelerator.vue', () => {
  it('keeps starter-template accelerator collapsed and optional when no template is selected', async () => {
    const wrapper = mountAccelerator()
    const button = wrapper.find('button')

    expect(wrapper.text()).toContain('Starter Template Accelerator')
    expect(wrapper.text()).toContain('Optional · 0 selected')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(button.attributes('aria-controls')).toBe('policy-builder-starter-template-accelerator')
    expect(wrapper.text()).not.toContain('Suggested')

    await button.trigger('click')

    expect(button.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('#policy-builder-starter-template-accelerator').exists()).toBe(true)
    expect(wrapper.text()).toContain('Saving without a starter template is allowed.')
    expect(wrapper.text()).toContain('Suggested')
    expect(wrapper.text()).toContain('Animated Family')
  })

  it('collapses accelerator by default when starter templates are already selected', async () => {
    const wrapper = mountAccelerator({
      props: {
        selectedPresets: [{
          preset_id: 1,
          name: 'Animated Family',
          weight: 1,
        }],
      },
    })

    expect(wrapper.text()).toContain('1 selected')
    expect(wrapper.text()).not.toContain('Suggested')

    await wrapper.find('button').trigger('click')

    expect(wrapper.text()).toContain('Suggested')
    expect(wrapper.text()).toContain('Starter Templates (1)')
  })

  it('passes browser and selected-template events through explicitly', async () => {
    const wrapper = mountAccelerator()

    await wrapper.find('button').trigger('click')
    await wrapper.find('input[type="search"]').setValue('family')
    await wrapper.findAll('button').find(button => button.text().includes('Family')).trigger('click')
    await wrapper.findAll('button').find(button => button.text().includes('+ Add All')).trigger('click')
    await wrapper.findAll('.cursor-pointer')[0].trigger('click')

    expect(wrapper.emitted('update:searchQuery')).toEqual([['family']])
    expect(wrapper.emitted('update:selectedCategory')).toEqual([['family']])
    expect(wrapper.emitted('add-all-suggested')).toHaveLength(1)
    expect(wrapper.emitted('toggle-preset')).toEqual([[presets[0]]])
  })
})
