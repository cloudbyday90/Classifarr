/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyDestinationEmptyStateNotice from '@/components/policies/PolicyDestinationEmptyStateNotice.vue'

function buildEmptyState(overrides = {}) {
  return {
    stateId: 'new_library',
    label: 'New library',
    description: 'No observed profile is available yet.',
    nextAction: {
      actionId: 'sync_media_server_library',
      label: 'Sync library now',
      targetId: 'policy-builder-library-context',
      mode: 'sync_library',
    },
    ...overrides,
  }
}

describe('PolicyDestinationEmptyStateNotice.vue', () => {
  it('renders and emits a bounded actionable next step', async () => {
    const emptyState = buildEmptyState()
    const wrapper = mount(PolicyDestinationEmptyStateNotice, {
      props: { emptyState },
    })

    expect(wrapper.text()).toContain('New library')
    expect(wrapper.text()).toContain('Sync library now')

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('next-action')).toEqual([[emptyState]])
  })

  it('keeps an unavailable declared-intent control as guidance instead of a dead button', () => {
    const wrapper = mount(PolicyDestinationEmptyStateNotice, {
      props: {
        emptyState: buildEmptyState({
          stateId: 'sparse_library',
          label: 'Sparse library',
          nextAction: {
            actionId: 'add_declared_intent',
            label: 'Add declared intent',
            targetId: 'policy-builder-belongs-here',
            mode: 'guidance',
          },
        }),
      },
    })

    expect(wrapper.text()).toContain('Add declared intent')
    expect(wrapper.text()).toContain('will not guess a destination')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
