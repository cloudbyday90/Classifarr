/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyAuthoringLifecycleEntry from '@/components/policies/PolicyAuthoringLifecycleEntry.vue'

function buildEntry(overrides = {}) {
  return {
    statusId: 'eligible_to_prepare_proposal',
    library: { id: 7, name: 'Movies', mediaType: 'movie' },
    policy: null,
    label: 'Ready to review',
    message: 'Classifarr found a current destination candidate for this library.',
    tone: 'success',
    canSelect: true,
    ...overrides,
  }
}

describe('PolicyAuthoringLifecycleEntry.vue', () => {
  it('renders the only selectable lifecycle outcome as a proposal-review action', async () => {
    const wrapper = mount(PolicyAuthoringLifecycleEntry, {
      props: { entry: buildEntry() },
    })

    expect(wrapper.text()).toContain('Movies')
    expect(wrapper.text()).toContain('Ready to review')
    expect(wrapper.find('button').text()).toBe('Review destination proposal')

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('select')).toEqual([[7]])
  })

  it('keeps existing policy and automatic recovery outcomes non-interactive', () => {
    const existing = mount(PolicyAuthoringLifecycleEntry, {
      props: {
        entry: buildEntry({
          statusId: 'existing_native_policy',
          label: 'Policy already exists',
          policy: { id: 3, name: 'Movies Policy' },
          canSelect: false,
        }),
      },
    })
    const recovery = mount(PolicyAuthoringLifecycleEntry, {
      props: {
        entry: buildEntry({
          statusId: 'profile_recovery_required',
          label: 'Profile recovery in progress',
          message: 'Classifarr is automatically recovering the library profile.',
          canSelect: false,
        }),
      },
    })

    expect(existing.text()).toContain('Existing policy: Movies Policy')
    expect(existing.findAll('button')).toHaveLength(0)
    expect(recovery.text()).toContain('automatically recovering')
    expect(recovery.findAll('button')).toHaveLength(0)
  })
})
