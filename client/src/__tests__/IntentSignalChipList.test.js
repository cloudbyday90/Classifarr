/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import IntentSignalChipList from '@/components/policies/IntentSignalChipList.vue'

function candidate(overrides = {}) {
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

describe('IntentSignalChipList.vue', () => {
  it('renders declared candidates with visible and programmatic removal names', async () => {
    const wrapper = mount(IntentSignalChipList, {
      props: {
        signals: [candidate()],
      },
    })

    expect(wrapper.find('section').attributes('aria-labelledby'))
      .toBe('intent-signal-chip-list-title')
    expect(wrapper.text()).toContain('Declared destination signals')
    expect(wrapper.text()).toContain('Animation')

    const removeButton = wrapper.get('button')
    expect(removeButton.text()).toBe('Remove')
    expect(removeButton.attributes('aria-label'))
      .toBe('Remove Animation from declared destination signals')

    await removeButton.trigger('click')

    expect(wrapper.emitted('draft-command-plan')).toEqual([[expect.objectContaining({
      version: 'policy.intent_signal_command_plan.v1',
      componentId: 'intent_signal_picker',
      commandBoundary: 'typed_draft_commands',
      commands: [expect.objectContaining({
        commandId: 'remove_signal_value',
        candidate: expect.objectContaining({ candidateId: 'genre:Animation:purpose' }),
      })],
    })]])
  })

  it('does not expose malformed candidates or emit an untyped removal', () => {
    const wrapper = mount(IntentSignalChipList, {
      props: {
        signals: [candidate({
          candidateId: '',
          commandId: '',
        })],
      },
    })

    expect(wrapper.find('section').exists()).toBe(false)
    expect(wrapper.emitted('draft-command-plan')).toBeUndefined()
  })
})
