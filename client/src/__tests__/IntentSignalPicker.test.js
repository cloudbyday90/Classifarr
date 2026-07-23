/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import IntentSignalPicker from '@/components/policies/IntentSignalPicker.vue'

function observedEvidence(overrides = {}) {
  return {
    key: 'genre:Animation',
    candidateId: 'genre:Animation',
    value: 'Animation',
    label: 'Animation',
    sourceId: 'observed_in_library',
    sourceLabel: 'Already in this library',
    selectionStateId: 'read_only_evidence',
    selectable: false,
    readOnlyEvidence: true,
    requiresExplicitAcceptance: true,
    canAutoDeclare: false,
    explanation: 'Animation appears in 48 items in the current library.',
    evidence: { count: 48, confidence: 0.84 },
    ...overrides,
  }
}

function selectableOption(overrides = {}) {
  return {
    candidateId: 'genre:Animation:purpose',
    value: 'Animation',
    label: 'Animation',
    sourceId: 'suggested_from_observed_profile',
    sourceLabel: 'Suggested from this library',
    selectionStateId: 'selectable_suggestion',
    selectable: true,
    readOnlyEvidence: false,
    commandId: 'add_signal_value',
    signalType: 'genres',
    operator: 'require_any',
    questionId: 'what_belongs_here',
    explanation: 'Animation appears in 48 items in the current library.',
    evidence: { count: 48, confidence: 0.84 },
    requiresExplicitAcceptance: true,
    canAutoDeclare: false,
    ...overrides,
  }
}

describe('IntentSignalPicker.vue', () => {
  it('separates read-only library evidence from an explicit typed multi-select command', async () => {
    const wrapper = mount(IntentSignalPicker, {
      props: {
        observedEvidence: [observedEvidence()],
        options: [selectableOption()],
        libraryName: 'Animation Movies',
      },
    })

    expect(wrapper.text()).toContain('Already in this library')
    expect(wrapper.text()).toContain('Suggested from this library')
    expect(wrapper.text()).toContain('48 items currently here')
    expect(wrapper.find('fieldset').exists()).toBe(true)
    expect(wrapper.find('legend').text()).toBe('Add declared destination signals')
    expect(wrapper.find('input[type="checkbox"]').element.checked).toBe(false)

    await wrapper.find('input[type="checkbox"]').setValue(true)
    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('draft-command-plan')).toEqual([[
      expect.objectContaining({
        version: 'policy.intent_signal_command_plan.v1',
        componentId: 'intent_signal_picker',
        commandBoundary: 'typed_draft_commands',
        commands: [expect.objectContaining({ commandId: 'add_signal_value' })],
      }),
    ]])
  })

  it('marks unavailable options disabled and removes declared signals through a typed command', async () => {
    const unavailableOption = selectableOption({
      candidateId: 'genre:Drama:declared',
      value: 'Drama',
      label: 'Drama',
      sourceId: 'already_declared',
      sourceLabel: 'Already added',
      selectionStateId: 'disabled_already_declared',
      selectable: false,
      commandId: '',
      signalType: '',
      operator: '',
      questionId: '',
      requiresExplicitAcceptance: false,
      disabledReason: 'Drama is already declared for this destination.',
    })
    const acceptedSignal = selectableOption()
    const wrapper = mount(IntentSignalPicker, {
      props: {
        acceptedSignals: [acceptedSignal],
        options: [acceptedSignal, unavailableOption],
      },
    })

    const disabledInput = wrapper.get('input[disabled]')
    expect(disabledInput.attributes('aria-describedby')).toContain('description')
    expect(wrapper.text()).toContain('Drama is already declared for this destination.')

    await wrapper.get('button[aria-label*="Remove Animation"]').trigger('click')

    expect(wrapper.emitted('draft-command-plan')).toEqual([[
      expect.objectContaining({
        commands: [expect.objectContaining({ commandId: 'remove_signal_value' })],
      }),
    ]])
  })

  it('forwards a custom value only for server validation before it can be selected', async () => {
    const wrapper = mount(IntentSignalPicker, {
      props: {
        customEntryInput: {
          enabled: true,
          signalTypes: [{ id: 'studios', label: 'Studio' }],
          valueMaximumLength: 160,
          explanationMaximumLength: 320,
          requiresExplanation: true,
        },
      },
    })

    await wrapper.get('input[type="text"]').setValue('Studio Ghibli')
    await wrapper.get('textarea').setValue('This library is intended for films from this studio.')
    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.emitted('validate-custom-signal')).toEqual([[{
      signalType: 'studios',
      value: 'Studio Ghibli',
      explanation: 'This library is intended for films from this studio.',
    }]])
    expect(wrapper.emitted('draft-command-plan')).toBeUndefined()
  })
})
