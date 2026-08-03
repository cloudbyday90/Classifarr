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
const helpfulStudioOptions = [
  { value: 'Studio Example', sourceId: 'current_library_profile' },
  { value: 'Studio Second', sourceId: 'current_library_profile' },
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

  it('keeps helpful studios distinct from purpose and emits their typed narrowing command', async () => {
    const wrapper = mount(PolicyDestinationProposalAdjustmentDisclosure, {
      props: { genreOptions, helpfulStudioOptions },
    })

    await wrapper.get('button').trigger('click')
    expect(wrapper.text()).toContain('Keep these helpful studios')
    expect(wrapper.text()).toContain('helpful preferences, not destination identity')

    await wrapper.get('input[value="Studio Second"]').setValue(false)

    expect(wrapper.emitted('update:adjustment-commands')).toContainEqual([[
      {
        commandId: 'set_helpful_studios',
        values: ['Studio Example'],
      },
    ]])
    expect(wrapper.get('input[value="Studio Example"]').attributes('disabled')).toBeDefined()
  })

  it('does not render a one-value group that cannot be narrowed', () => {
    const wrapper = mount(PolicyDestinationProposalAdjustmentDisclosure, {
      props: {
        genreOptions: [{ value: 'Animation', sourceId: 'current_library_profile' }],
        helpfulStudioOptions: [{ value: 'Studio Example', sourceId: 'current_library_profile' }],
      },
    })

    expect(wrapper.find('section').exists()).toBe(false)
  })
})
