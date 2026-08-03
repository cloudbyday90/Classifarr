/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyBuilderFooterActions from '@/components/policies/PolicyBuilderFooterActions.vue'

describe('PolicyBuilderFooterActions.vue', () => {
  it('renders a direct disabled-save reason and defer action', async () => {
    const wrapper = mount(PolicyBuilderFooterActions, {
      props: {
        boundary: {
          canSave: false,
          saveLabel: 'Create Policy',
          deferLabel: 'Defer for now',
          disabledReason: 'Choose a destination library before saving.',
        },
      },
    })

    expect(wrapper.find('[role="status"]').attributes('aria-live')).toBe('polite')
    expect(wrapper.text()).toContain('Choose a destination library before saving.')
    expect(wrapper.text()).toContain('Defer for now')

    const buttons = wrapper.findAll('button')
    const deferButton = buttons.find(button => button.text().includes('Defer for now'))
    const saveButton = buttons.find(button => button.text().includes('Create Policy'))

    expect(deferButton.exists()).toBe(true)
    expect(saveButton.attributes('disabled')).toBeDefined()
    expect(saveButton.attributes('title')).toBeUndefined()
    expect(wrapper.find('#policy-builder-save-blocked-reason').text())
      .toContain('Choose a destination library before saving.')
    expect(saveButton.attributes('aria-describedby')).toBe('policy-builder-save-blocked-reason')

    await deferButton.trigger('click')
    expect(wrapper.emitted('defer')).toEqual([[]])
  })

  it('emits save without rendering a browser-derived ready status', async () => {
    const wrapper = mount(PolicyBuilderFooterActions, {
      props: {
        boundary: {
          canSave: true,
          saveLabel: 'Save Policy',
          deferLabel: 'Defer for now',
          disabledReason: '',
        },
      },
    })

    const saveButton = wrapper.findAll('button')
      .find(button => button.text().includes('Save Policy'))

    expect(saveButton.attributes('disabled')).toBeUndefined()
    expect(wrapper.find('#policy-builder-save-blocked-reason').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(saveButton.attributes('aria-describedby')).toBeUndefined()
    expect(wrapper.text()).not.toContain('Ready to save')
    await saveButton.trigger('click')

    expect(wrapper.emitted('save')).toEqual([[]])
  })

  it('prevents duplicate saves and exposes safe returned-action feedback', () => {
    const wrapper = mount(PolicyBuilderFooterActions, {
      props: {
        boundary: {
          canSave: true,
          saveLabel: 'Save Policy',
          deferLabel: 'Defer for now',
          disabledReason: '',
        },
        saving: true,
        saveFeedback: {
          statusId: 'rejected',
          message: 'Classifarr could not accept this policy. Review the current destination details and try again.',
        },
      },
    })

    const saveButton = wrapper.findAll('button')
      .find(button => button.text().includes('Saving policy...'))

    expect(saveButton.attributes('disabled')).toBeDefined()
    expect(saveButton.attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[role="alert"]').text()).toContain('could not accept this policy')
    expect(saveButton.attributes('aria-describedby')).toContain('policy-builder-save-error')
  })
})
