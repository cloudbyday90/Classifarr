import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyObservedSuggestionSelector from '@/components/policies/PolicyObservedSuggestionSelector.vue'

function candidate(overrides = {}) {
  return {
    candidateId: 'genre:Animation:purpose',
    value: 'Animation',
    label: 'Animation',
    signalType: 'genres',
    operator: 'require_any',
    questionId: 'what_belongs_here',
    sourceId: 'suggested_from_observed_profile',
    explanation: 'Animation appears in 48 items in the current library.',
    evidenceCount: 48,
    requiresExplicitAcceptance: true,
    canAutoDeclare: false,
    ...overrides,
  }
}

describe('PolicyObservedSuggestionSelector.vue', () => {
  it('uses a semantic checkbox group and emits an explicit typed add command', async () => {
    const wrapper = mount(PolicyObservedSuggestionSelector, {
      props: {
        candidates: [candidate()],
        libraryName: 'Animation Movies',
      },
    })

    expect(wrapper.find('fieldset').exists()).toBe(true)
    expect(wrapper.find('legend').text()).toBe('Select all that apply')
    expect(wrapper.find('input[type="checkbox"]').element.checked).toBe(false)
    expect(wrapper.text()).toContain('48 items currently here')

    await wrapper.find('input[type="checkbox"]').setValue(true)
    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('draft-command-plan')).toEqual([[
      expect.objectContaining({
        commandBoundary: 'typed_draft_commands',
        commands: [expect.objectContaining({ commandId: 'add_signal_value' })],
      }),
    ]])
  })

  it('renders accepted values with an explicit typed removal action', async () => {
    const wrapper = mount(PolicyObservedSuggestionSelector, {
      props: {
        acceptedCandidates: [candidate()],
        candidates: [candidate()],
      },
    })

    const removeButton = wrapper.get('button[aria-label*="Remove Animation"]')
    await removeButton.trigger('click')

    expect(wrapper.text()).toContain('Declared destination values')
    expect(wrapper.emitted('draft-command-plan')).toEqual([[
      expect.objectContaining({
        commands: [expect.objectContaining({ commandId: 'remove_signal_value' })],
      }),
    ]])
  })
})
