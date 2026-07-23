/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyIntentCustomSignalEntry from '@/components/policies/PolicyIntentCustomSignalEntry.vue'

const inputContract = {
  enabled: true,
  signalTypes: [
    { id: 'genres', label: 'Genre' },
    { id: 'keywords', label: 'Keyword' },
    { id: 'studios', label: 'Studio' },
  ],
  valueMaximumLength: 160,
  explanationMaximumLength: 320,
  requiresExplanation: true,
}

describe('PolicyIntentCustomSignalEntry.vue', () => {
  it('submits only explicit custom-entry fields and keeps the form optional', async () => {
    const wrapper = mount(PolicyIntentCustomSignalEntry, {
      props: { inputContract },
    })

    expect(wrapper.find('details').exists()).toBe(true)
    expect(wrapper.text()).toContain('optional')

    await wrapper.get('select').setValue('studios')
    await wrapper.get('input[type="text"]').setValue('Studio Ghibli')
    await wrapper.get('textarea').setValue('This library is intended for films from this studio.')
    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.emitted('validate-custom-signal')).toEqual([[{
      signalType: 'studios',
      value: 'Studio Ghibli',
      explanation: 'This library is intended for films from this studio.',
    }]])
  })

  it('shows server validation feedback without treating it as an accepted policy signal', () => {
    const wrapper = mount(PolicyIntentCustomSignalEntry, {
      props: {
        inputContract,
        message: 'Classifarr checked the custom value. Review it below before adding it to this policy.',
      },
    })

    expect(wrapper.text()).toContain('Review it below before adding it to this policy.')
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })
})
