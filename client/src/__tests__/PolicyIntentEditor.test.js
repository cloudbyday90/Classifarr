/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyIntentEditor from '../components/policies/PolicyIntentEditor.vue'
import { buildPolicyIntentDraft } from '../utils/policyIntentDraftBridge'

describe('PolicyIntentEditor.vue', () => {
  const selectedPresets = [
    {
      id: 7,
      name: 'Starter',
      weight: 1,
      customSignals: null,
    },
  ]

  const mountEditor = (presetOverrides = {}) => {
    const presets = selectedPresets.map(preset => ({
      ...preset,
      ...presetOverrides,
    }))

    return mount(PolicyIntentEditor, {
      props: {
        selectedPresets: presets,
        allPresets: [],
        intentDraft: buildPolicyIntentDraft(presets),
        availableGenres: ['Family', 'Comedy'],
        availableRatings: ['PG', 'PG-13', 'R'],
      },
    })
  }

  it('emits draft add-signal commands instead of legacy signal events', async () => {
    const wrapper = mountEditor()
    const selects = wrapper.findAll('select')

    await selects[1].setValue('Family')
    await wrapper.findAll('button').find(button => button.text() === 'Add belongs-here genre').trigger('click')

    expect(wrapper.emitted('draft-add-signal')?.[0]?.[0]).toMatchObject({
      presetId: 7,
      signalType: 'genres',
      key: 'require_any',
      value: 'Family',
      extras: { semantics: 'identity' },
    })
    expect(wrapper.emitted('add-signal')).toBeUndefined()
  })

  it('emits draft signal config and clear commands', async () => {
    const wrapper = mountEditor()
    const selects = wrapper.findAll('select')

    await selects[3].setValue('PG-13')
    await wrapper.findAll('button').find(button => button.text() === 'Set max rating').trigger('click')

    expect(wrapper.emitted('draft-set-signal-config')?.[0]?.[0]).toMatchObject({
      presetId: 7,
      signalType: 'certifications',
      config: {
        mode: 'max',
        max: 'PG-13',
        constraint_mode: 'strict',
      },
    })
    await wrapper.findAll('button').find(button => button.text() === 'Clear max rating').trigger('click')

    expect(wrapper.emitted('draft-clear-signal-config')?.[0]?.[0]).toMatchObject({
      presetId: 7,
      signalType: 'certifications',
    })
    expect(wrapper.emitted('set-signal-config')).toBeUndefined()
    expect(wrapper.emitted('clear-signal-config')).toBeUndefined()
  })

  it('emits draft remove commands for removable intent chips', async () => {
    const wrapper = mountEditor({
      customSignals: {
        genres: {
          require_any: ['Family'],
          semantics: 'identity',
        },
      },
    })

    await wrapper.find('button[aria-label="Remove Belongs here: Family"]').trigger('click')

    expect(wrapper.emitted('draft-remove-signal-value')?.[0]?.[0]).toEqual({
      presetId: 7,
      signalType: 'genres',
      key: 'require_any',
      value: 'Family',
    })
  })

  it('emits value-specific remove commands for avoid-rating chips', async () => {
    const wrapper = mountEditor({
      customSignals: {
        certifications: {
          mode: 'exclude',
          exclude: ['R', 'NC-17'],
        },
      },
    })

    expect(wrapper.text()).toContain('Avoid rating: R')
    expect(wrapper.text()).toContain('Avoid rating: NC-17')

    await wrapper.find('button[aria-label="Remove Avoid rating: NC-17"]').trigger('click')

    expect(wrapper.emitted('draft-remove-signal-value')?.[0]?.[0]).toEqual({
      presetId: 7,
      signalType: 'certifications',
      key: 'exclude',
      value: 'NC-17',
    })
  })
})
