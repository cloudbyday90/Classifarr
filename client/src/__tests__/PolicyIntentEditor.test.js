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

  const mountEditor = () => mount(PolicyIntentEditor, {
    props: {
      selectedPresets,
      allPresets: [],
      intentDraft: buildPolicyIntentDraft(selectedPresets),
      availableGenres: ['Family', 'Comedy'],
      availableRatings: ['PG', 'PG-13', 'R'],
    },
  })

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

  it('renders policy context before editable compatibility controls', () => {
    const wrapper = mountEditor()
    const text = wrapper.text()

    expect(text).toContain('Policy context')
    expect(text).toContain('Changes apply only to this attached policy.')
    expect(text).toContain('Starter')
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
    expect(text).not.toContain('Edit destination intent')
    expect(text.indexOf('Policy context')).toBeLessThan(text.indexOf('Ask When Unsure'))
    expect(wrapper.find('#policy-builder-review-behavior').exists()).toBe(true)
    expect(wrapper.find('#policy-builder-destination-identity').exists()).toBe(true)
    expect(wrapper.find('#policy-builder-destination-rules').exists()).toBe(true)
    expect(wrapper.find('#policy-builder-confidence-support').exists()).toBe(true)
    expect(text.indexOf('What should always or never belong here?')).toBeLessThan(text.indexOf('Helpful Matches'))
  })
})
