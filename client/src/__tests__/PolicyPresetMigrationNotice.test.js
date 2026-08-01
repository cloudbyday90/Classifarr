/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyPresetMigrationNotice from '@/components/policies/PolicyPresetMigrationNotice.vue'

const mountComponent = (notice = {}) => mount(PolicyPresetMigrationNotice, {
  props: {
    notice: {
      summary: '2 incompatible preset attachments were removed.',
      preview: 'Family Policy, Movies Policy',
      ...notice,
    },
  },
})

describe('PolicyPresetMigrationNotice.vue', () => {
  it('renders only the supplied migration outcome and preview', () => {
    const wrapper = mountComponent()

    expect(wrapper.text()).toContain('2 incompatible preset attachments were removed.')
    expect(wrapper.text()).toContain('Family Policy, Movies Policy')
    expect(wrapper.text()).not.toContain('auto-dropped after upgrade')
    expect(wrapper.text()).not.toContain('Reapply corrected presets')
  })

  it('omits the preview when the notice has no preview text', () => {
    const wrapper = mountComponent({ preview: '' })

    expect(wrapper.text()).toContain('2 incompatible preset attachments were removed.')
    expect(wrapper.text()).not.toContain('Family Policy, Movies Policy')
  })

  it('emits dismiss when the operator dismisses the notice', async () => {
    const wrapper = mountComponent()

    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-atomic')).toBe('true')
    expect(wrapper.find('button').text()).toBe('Hide migration update')

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })
})
