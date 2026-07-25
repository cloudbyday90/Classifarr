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
      busyLabel: 'Syncing library...',
      busyMessage: 'Classifarr is syncing this library and refreshing its profile.',
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
    expect(wrapper.text()).not.toContain('Next:')
    expect(wrapper.get('button').attributes('aria-describedby'))
      .toBe('policy-destination-empty-state-new_library-description')

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('next-action')).toEqual([[emptyState]])
  })

  it('keeps progress feedback scoped to the action currently running', async () => {
    const syncState = buildEmptyState()
    const syncWrapper = mount(PolicyDestinationEmptyStateNotice, {
      props: {
        emptyState: syncState,
        activeActionId: syncState.nextAction.actionId,
        activeActionStatusId: 'policy-builder-empty-state-action-status',
      },
    })

    expect(syncWrapper.get('button').text()).toBe('Syncing library...')
    expect(syncWrapper.get('button').attributes('disabled')).toBeDefined()
    expect(syncWrapper.get('button').attributes('aria-describedby'))
      .toBe('policy-destination-empty-state-new_library-description policy-builder-empty-state-action-status')

    await syncWrapper.get('button').trigger('click')
    expect(syncWrapper.emitted('next-action')).toBeUndefined()

    const mappingWrapper = mount(PolicyDestinationEmptyStateNotice, {
      props: {
        emptyState: buildEmptyState({
          stateId: 'unmapped_library',
          label: 'Unmapped library',
          nextAction: {
            actionId: 'map_routing_destination',
            label: 'Open library mapping',
            busyLabel: 'Opening library mapping...',
            busyMessage: 'Classifarr is opening the library mapping page.',
            targetId: 'library-arr-mapping',
            mode: 'open_library_mapping',
          },
        }),
        activeActionId: syncState.nextAction.actionId,
        activeActionStatusId: 'policy-builder-empty-state-action-status',
      },
    })

    expect(mappingWrapper.get('button').text()).toBe('Open library mapping')
    expect(mappingWrapper.get('button').attributes('disabled')).toBeDefined()
    expect(mappingWrapper.get('button').attributes('aria-describedby'))
      .toBe('policy-destination-empty-state-unmapped_library-description policy-builder-empty-state-action-status')
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
