/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyStarterTemplateBrowser from '@/components/policies/PolicyStarterTemplateBrowser.vue'

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
    source: 'custom',
    usage_count: 1,
  },
]

const mountComponent = (overrides = {}) => mount(PolicyStarterTemplateBrowser, {
  props: {
    suggestedPresets: [presets[0]],
    availablePresets: [presets[1]],
    selectedPresets: [],
    allPresets: presets,
    categoryTabs: [
      { value: 'all', label: 'All', count: 2 },
      { value: 'custom', label: 'My Templates', count: 1 },
    ],
    selectedCategory: 'all',
    searchQuery: '',
    getPresetUsageCount: preset => preset?.usage_count ?? 0,
    formatUsageLabel: count => `Used in ${count} ${count === 1 ? 'policy' : 'policies'}`,
    ...overrides.props,
  },
})

describe('PolicyStarterTemplateBrowser.vue', () => {
  it('renders suggested and available starter templates with usage labels', () => {
    const wrapper = mountComponent()

    expect(wrapper.text()).toContain('Suggested')
    expect(wrapper.text()).toContain('Animated Family')
    expect(wrapper.text()).toContain('Suggestion score: 92')
    expect(wrapper.text()).toContain('Comedy')
    expect(wrapper.text()).toContain('Custom')
    expect(wrapper.text()).toContain('Used in 2 policies')
    expect(wrapper.text()).toContain('Used in 1 policy')
  })

  it('emits search, category, add-all, and template toggle events', async () => {
    const wrapper = mountComponent()

    await wrapper.find('input[type="search"]').setValue('family')
    await wrapper.findAll('button').find(button => button.text().includes('My Templates')).trigger('click')
    await wrapper.findAll('button').find(button => button.text().includes('+ Add All')).trigger('click')
    await wrapper.findAll('.cursor-pointer')[0].trigger('click')

    expect(wrapper.emitted('update:searchQuery')).toEqual([['family']])
    expect(wrapper.emitted('update:selectedCategory')).toEqual([['custom']])
    expect(wrapper.emitted('add-all-suggested')).toHaveLength(1)
    expect(wrapper.emitted('toggle-preset')).toEqual([[presets[0]]])
  })

  it('marks selected templates and shows an empty state when no available templates match', () => {
    const wrapper = mountComponent({
      props: {
        selectedPresets: [{ preset_id: 1, name: 'Animated Family' }],
        availablePresets: [],
      },
    })

    expect(wrapper.text()).toContain('No templates found matching your search')
    expect(wrapper.find('.bg-success').exists()).toBe(true)
  })
})
