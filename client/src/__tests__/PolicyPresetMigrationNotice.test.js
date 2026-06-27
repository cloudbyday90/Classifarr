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
  it('renders the upgrade notice summary and preview', () => {
    const wrapper = mountComponent()

    expect(wrapper.text()).toContain('Legacy preset attachments were auto-dropped after upgrade')
    expect(wrapper.text()).toContain('2 incompatible preset attachments were removed.')
    expect(wrapper.text()).toContain('Family Policy, Movies Policy')
  })

  it('omits the preview when the notice has no preview text', () => {
    const wrapper = mountComponent({ preview: '' })

    expect(wrapper.text()).toContain('2 incompatible preset attachments were removed.')
    expect(wrapper.text()).not.toContain('Family Policy, Movies Policy')
  })

  it('emits dismiss when the operator dismisses the notice', async () => {
    const wrapper = mountComponent()

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })
})
