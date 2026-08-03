/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyDestinationProposalAdjustmentDisclosure from '@/components/policies/PolicyDestinationProposalAdjustmentDisclosure.vue'

const genreOptions = [
  { value: 'Animation', sourceId: 'current_library_profile' },
  { value: 'Family', sourceId: 'current_library_profile' },
]

describe('PolicyDestinationProposalAdjustmentDisclosure.vue', () => {
  it('keeps optional genre narrowing collapsed until explicitly requested', async () => {
    const wrapper = mount(PolicyDestinationProposalAdjustmentDisclosure, {
      props: { genreOptions },
    })

    const toggle = wrapper.get('button')
    expect(toggle.text()).toBe('Adjust this policy')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.findAll('input')).toHaveLength(0)

    await toggle.trigger('click')

    expect(toggle.text()).toBe('Hide adjustments')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.text()).toContain('Proposed from the current library profile.')
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(2)
  })

  it('emits only a typed narrowing command and keeps at least one proposed genre selected', async () => {
    const wrapper = mount(PolicyDestinationProposalAdjustmentDisclosure, {
      props: { genreOptions },
    })

    await wrapper.get('button').trigger('click')
    await wrapper.get('input[value="Family"]').setValue(false)

    expect(wrapper.emitted('update:adjustment-commands')).toContainEqual([[
      {
        commandId: 'set_purpose_genres',
        values: ['Animation'],
      },
    ]])
    expect(wrapper.get('input[value="Animation"]').attributes('disabled')).toBeDefined()
  })
})
