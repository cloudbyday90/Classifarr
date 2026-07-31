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

    await wrapper.find('input[value="Family"]').setValue(true)
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

  it('renders direct editing context without browser-derived workflow claims', () => {
    const wrapper = mountEditor()
    const text = wrapper.text()

    expect(text).toContain('Edit destination intent')
    expect(text).toContain('Choose policy context')
    expect(text).toContain('When should Classifarr ask?')
    expect(text).toContain('Ask When Unsure')
    expect(text).toContain('What clearly belongs here?')
    expect(text).toContain('What should always or never belong here?')
    expect(text).toContain('What helps after fit is clear?')
    expect(text).toContain('Use this for identity evidence that should define the destination.')
    expect(text).not.toContain('Policy Readiness')
    expect(text).not.toContain('Ready with notes')
    expect(text).not.toContain('Needs identity')
    expect(text).not.toContain('Why it matters:')
    expect(text).not.toContain('Policy Intent Builder')
    expect(text).not.toContain('without changing how existing policies save')
    expect(text).not.toContain('The media server shows how this library is used today')
    expect(text).not.toContain('Classifarr reconciles both')
    expect(text).not.toMatch(/\d+\s+existing policy context/)
    expect(text.indexOf('Ask When Unsure')).toBeLessThan(text.indexOf('Choose policy context'))
    expect(wrapper.find('#policy-builder-review-behavior').exists()).toBe(true)
    expect(wrapper.find('#policy-builder-destination-identity').exists()).toBe(true)
    expect(wrapper.find('#policy-builder-destination-rules').exists()).toBe(true)
    expect(wrapper.find('#policy-builder-confidence-support').exists()).toBe(true)
    expect(text.indexOf('What should always or never belong here?')).toBeLessThan(text.indexOf('Helpful Matches'))
  })

  it('keeps the no-compatibility-context empty state as a focusable status target', () => {
    const wrapper = mount(PolicyIntentEditor, {
      props: {
        selectedPresets: [],
        allPresets: [],
        intentDraft: buildPolicyIntentDraft([]),
        availableGenres: ['Family', 'Comedy'],
        availableRatings: ['PG', 'PG-13', 'R'],
      },
    })

    const emptyState = wrapper.find('#policy-builder-destination-rules')

    expect(emptyState.exists()).toBe(true)
    expect(emptyState.attributes('tabindex')).toBe('-1')
    expect(emptyState.attributes('aria-label')).toBe('Destination intent unavailable')
    expect(emptyState.text()).toContain('No editable destination signals are available for this policy.')
    expect(emptyState.text()).not.toContain('New policy intent is established')
  })

  it('emits review trigger draft commands from the review behavior section', async () => {
    const wrapper = mountEditor()

    await wrapper.find('input[value="evidence_missing"]').setValue(true)
    await wrapper.findAll('button').find(button => button.text() === 'Add review triggers').trigger('click')

    expect(wrapper.emitted('draft-add-signal')?.[0]?.[0]).toMatchObject({
      presetId: 7,
      signalType: 'review_triggers',
      key: 'when_any',
      value: 'evidence_missing',
      extras: { semantics: 'review' },
    })
  })

  it('emits draft signal config and clear commands', async () => {
    const wrapper = mountEditor()
    const ratingSelect = wrapper.findAll('select').find(select =>
      select.findAll('option').some(option => option.attributes('value') === 'PG-13')
    )

    await ratingSelect.setValue('PG-13')
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

  it('does not emit duplicate draft add commands for already configured section values', async () => {
    const wrapper = mountEditor({
      customSignals: {
        genres: {
          require_any: ['Family'],
          semantics: 'identity',
        },
      },
    })

    expect(wrapper.text()).toContain('Family is already configured as a belongs-here genre.')

    const duplicateOption = wrapper.find('input[value="Family"]')
    expect(duplicateOption.attributes('disabled')).toBeDefined()

    await wrapper.findAll('button').find(button => button.text() === 'Add belongs-here genre').trigger('click')

    expect(wrapper.emitted('draft-add-signal')).toBeUndefined()
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
