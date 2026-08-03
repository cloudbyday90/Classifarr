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
    description: 'No observed profile is available yet. Declare the destination intent instead of treating an empty library as evidence.',
    nextAction: {
      actionId: 'add_declared_intent',
      label: 'Add declared intent',
      targetId: 'policy-builder-belongs-here',
      mode: 'guidance',
    },
    ...overrides,
  }
}

describe('PolicyDestinationEmptyStateNotice.vue', () => {
  it('renders new-library guidance without a browser recovery action', () => {
    const emptyState = buildEmptyState()
    const wrapper = mount(PolicyDestinationEmptyStateNotice, {
      props: { emptyState },
    })

    expect(wrapper.text()).toContain('New library')
    expect(wrapper.text()).toContain('Next:')
    expect(wrapper.text()).toContain('Add declared intent')
    expect(wrapper.text()).toContain('will not guess a destination')
    expect(wrapper.text()).not.toContain('Sync library now')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('keeps progress feedback scoped to an actionable mapping transition', async () => {
    const mappingState = buildEmptyState({
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
    })
    const wrapper = mount(PolicyDestinationEmptyStateNotice, {
      props: {
        emptyState: mappingState,
        activeActionId: mappingState.nextAction.actionId,
        activeActionStatusId: 'policy-builder-empty-state-action-status',
      },
    })

    expect(wrapper.get('button').text()).toBe('Opening library mapping...')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button').attributes('aria-describedby'))
      .toBe('policy-destination-empty-state-unmapped_library-description policy-builder-empty-state-action-status')

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('next-action')).toBeUndefined()
  })

  it('does not render a control for an unsupported server action', () => {
    const wrapper = mount(PolicyDestinationEmptyStateNotice, {
      props: {
        emptyState: buildEmptyState({
          nextAction: {
            actionId: 'sync_library_now',
            label: 'Sync library now',
            mode: 'synchronize',
          },
        }),
      },
    })

    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toContain('This library action is not available from this screen.')
  })
})
