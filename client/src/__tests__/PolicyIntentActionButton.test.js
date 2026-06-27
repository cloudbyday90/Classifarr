/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyIntentActionButton from '@/components/policies/PolicyIntentActionButton.vue'

function mountButton(readiness = { canSubmit: true, reason: '' }) {
  return mount(PolicyIntentActionButton, {
    props: {
      label: 'Add belongs-here genre',
      readiness,
    },
  })
}

describe('PolicyIntentActionButton.vue', () => {
  it('emits activate for ready controls', async () => {
    const wrapper = mountButton()

    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('button').attributes('aria-label')).toBe('Add belongs-here genre')

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('activate')).toHaveLength(1)
  })

  it('blocks activation and explains disabled readiness', async () => {
    const reason = 'Choose a belongs-here genre before applying this edit.'
    const wrapper = mountButton({
      canSubmit: false,
      reason,
    })

    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('title')).toBe(reason)
    expect(button.attributes('aria-label')).toBe(`Add belongs-here genre: ${reason}`)

    await button.trigger('click')

    expect(wrapper.emitted('activate')).toBeUndefined()
  })
})
