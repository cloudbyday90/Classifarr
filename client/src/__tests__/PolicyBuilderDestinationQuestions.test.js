/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyBuilderDestinationQuestions from '@/components/policies/PolicyBuilderDestinationQuestions.vue'

function buildSections() {
  return [
    {
      sectionId: 'what_belongs_here',
      heading: 'What belongs here',
      plainQuestion: 'What observed examples should define this destination?',
      helperText: 'Use the current library as evidence.',
      statusId: 'needs_action',
      editable: true,
      readiness: {
        nextAction: { label: 'Accept observed examples' },
      },
    },
    {
      sectionId: 'can_this_route',
      heading: 'Can this route',
      plainQuestion: 'Can approved matches route safely?',
      helperText: 'Routing is checked separately from policy creation.',
      statusId: 'needs_action',
      editable: false,
      readiness: {
        nextAction: { label: 'Connect a routing target' },
      },
    },
  ]
}

describe('PolicyBuilderDestinationQuestions.vue', () => {
  it('keeps generic readiness actions out of individual legacy question cards', () => {
    const wrapper = mount(PolicyBuilderDestinationQuestions, {
      props: {
        sections: buildSections(),
      },
    })

    expect(wrapper.text()).toContain('What belongs here')
    expect(wrapper.text()).toContain('Policy changes remain explicit')
    expect(wrapper.text()).not.toContain('Next:')
    expect(wrapper.text()).not.toContain('Accept observed examples')
    expect(wrapper.text()).not.toContain('Connect a routing target')
  })

  it('keeps native route guidance without duplicating a projected readiness label', () => {
    const wrapper = mount(PolicyBuilderDestinationQuestions, {
      props: {
        sections: buildSections(),
        selectionEnabled: true,
      },
    })

    const routingArticle = wrapper.find('#policy-builder-workflow-can_this_route-title')
      .element.closest('article')

    expect(routingArticle?.textContent)
      .toContain('Creation does not route media. Classifarr will only apply approved matches after routing is ready.')
    expect(routingArticle?.textContent).not.toContain('Connect a routing target')
    expect(wrapper.text()).not.toContain('Next:')
  })

  it('shows progress only on the empty-state action that is in flight', () => {
    const wrapper = mount(PolicyBuilderDestinationQuestions, {
      props: {
        sections: buildSections(),
        emptyStates: [
          {
            stateId: 'new_library',
            sectionId: 'what_belongs_here',
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
          },
          {
            stateId: 'unmapped_library',
            sectionId: 'can_this_route',
            label: 'Unmapped library',
            description: 'This destination cannot route until it is mapped.',
            nextAction: {
              actionId: 'map_routing_destination',
              label: 'Open library mapping',
              busyLabel: 'Opening library mapping...',
              busyMessage: 'Classifarr is opening the library mapping page.',
              targetId: 'library-arr-mapping',
              mode: 'open_library_mapping',
            },
          },
        ],
        activeEmptyStateActionId: 'sync_media_server_library',
      },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons.find(button => button.text() === 'Syncing library...')?.attributes('disabled')).toBeDefined()
    expect(buttons.find(button => button.text() === 'Open library mapping')?.attributes('disabled')).toBeDefined()
    expect(wrapper.find('[role="status"]').text())
      .toContain('syncing this library and refreshing its profile')
    expect(wrapper.text()).not.toContain('Opening library mapping...')
  })
})
