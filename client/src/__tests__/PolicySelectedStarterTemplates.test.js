/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicySelectedStarterTemplates from '@/components/policies/PolicySelectedStarterTemplates.vue'

function mountTemplates(overrides = {}) {
  return mount(PolicySelectedStarterTemplates, {
    props: {
      selectedPresets: overrides.selectedPresets || [{
        id: 3,
        preset_id: 3,
        name: 'Regional',
        icon: '🌍',
        weight: 1,
        suggestion_warnings: ['runtime_semantics_review_recommended'],
        customSignals: null,
      }],
      expandedPresetIds: overrides.expandedPresetIds || new Set([3]),
      allPresets: overrides.allPresets || [{
        id: 3,
        signals: {
          language: {
            require_any: ['sv'],
            strict: false,
          },
        },
      }],
      availableRatings: ['PG'],
      availableGenres: ['Comedy'],
    },
  })
}

describe('PolicySelectedStarterTemplates.vue', () => {
  it('renders selected starter templates and expanded details', () => {
    const wrapper = mountTemplates()

    expect(wrapper.text()).toContain('Starter Templates (1)')
    expect(wrapper.text()).toContain('Regional')
    expect(wrapper.text()).toContain('Advisory by default')
    expect(wrapper.text()).toContain('Language / Regional:')
  })

  it('emits shell events for toggle, weight, and remove actions', async () => {
    const wrapper = mountTemplates()

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('toggle-preset-customize')?.[0]).toEqual([3])

    await wrapper.find('input[type="number"]').setValue('1.5')
    expect(wrapper.emitted('update-preset-weight')?.[0][0]).toEqual({
      presetId: 3,
      weight: '1.5',
    })

    const removeButton = wrapper.findAll('button').find(button => button.text() === '×')
    await removeButton.trigger('click')
    expect(wrapper.emitted('remove-preset')?.[0]).toEqual([3])
  })

  it('passes detail events through with explicit payloads', async () => {
    const wrapper = mountTemplates({
      selectedPresets: [{
        id: 3,
        preset_id: 3,
        name: 'Regional',
        icon: '🌍',
        weight: 1,
        customSignals: {
          keywords: {
            require_any: ['space opera'],
          },
        },
      }],
    })

    await wrapper.find('input[type="text"]').setValue('  nordic  ')
    await wrapper.find('input[type="text"]').trigger('keydown.enter')
    expect(wrapper.emitted('add-custom-signal')?.[0][0]).toMatchObject({
      signalType: 'keywords',
      key: 'require_any',
      value: 'nordic',
    })

    const strictButton = wrapper.findAll('button').find(button => button.text() === 'Strict')
    await strictButton.trigger('click')
    expect(wrapper.emitted('set-signal-strict')?.[0][0]).toMatchObject({
      signalType: 'language',
      strict: true,
      baseStrict: false,
    })
  })
})
