/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyIntentSecondaryActionButton from '@/components/policies/PolicyIntentSecondaryActionButton.vue'

describe('PolicyIntentSecondaryActionButton.vue', () => {
  it('renders an explicit secondary action and emits activate', async () => {
    const wrapper = mount(PolicyIntentSecondaryActionButton, {
      props: {
        label: 'Clear max rating',
      },
    })

    const button = wrapper.find('button')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-label')).toBe('Clear max rating')
    expect(button.text()).toBe('Clear max rating')

    await button.trigger('click')

    expect(wrapper.emitted('activate')).toHaveLength(1)
  })
})
