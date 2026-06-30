/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyBuilderFooterActions from '@/components/policies/PolicyBuilderFooterActions.vue'

describe('PolicyBuilderFooterActions.vue', () => {
  it('renders disabled save with an accessible reason and defer action', async () => {
    const wrapper = mount(PolicyBuilderFooterActions, {
      props: {
        boundary: {
          canSave: false,
          saveLabel: 'Create Policy',
          deferLabel: 'Defer for now',
          status: 'blocked',
          tone: 'warning',
          statusLabel: 'Choose a library before saving',
          statusMessage: 'Select the media-server library this policy should describe.',
          disabledReason: 'Choose a destination library before saving.',
        },
      },
    })

    expect(wrapper.find('[role="status"]').attributes('aria-live')).toBe('polite')
    expect(wrapper.text()).toContain('Choose a library before saving')
    expect(wrapper.text()).toContain('Defer for now')

    const buttons = wrapper.findAll('button')
    const deferButton = buttons.find(button => button.text().includes('Defer for now'))
    const saveButton = buttons.find(button => button.text().includes('Create Policy'))

    expect(deferButton.exists()).toBe(true)
    expect(saveButton.attributes('disabled')).toBeDefined()
    expect(saveButton.attributes('title')).toBe('Choose a destination library before saving.')
    expect(saveButton.attributes('aria-describedby')).toBe('policy-builder-save-status')

    await deferButton.trigger('click')
    expect(wrapper.emitted('defer')).toEqual([[]])
  })

  it('emits save when the boundary allows saving', async () => {
    const wrapper = mount(PolicyBuilderFooterActions, {
      props: {
        boundary: {
          canSave: true,
          saveLabel: 'Save Policy',
          deferLabel: 'Defer for now',
          status: 'ready',
          tone: 'success',
          statusLabel: 'Ready to save',
          statusMessage: 'This policy has the required setup.',
          disabledReason: '',
        },
      },
    })

    const saveButton = wrapper.findAll('button')
      .find(button => button.text().includes('Save Policy'))

    expect(saveButton.attributes('disabled')).toBeUndefined()
    await saveButton.trigger('click')

    expect(wrapper.emitted('save')).toEqual([[]])
  })
})
