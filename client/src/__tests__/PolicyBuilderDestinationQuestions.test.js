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

  it('keeps new-library guidance actionless while mapping progress is in flight', () => {
    const wrapper = mount(PolicyBuilderDestinationQuestions, {
      props: {
        sections: buildSections(),
        emptyStates: [
          {
            stateId: 'new_library',
            sectionId: 'what_belongs_here',
            label: 'New library',
            description: 'No observed profile is available yet. Declare the destination intent instead of treating an empty library as evidence.',
            nextAction: {
              actionId: 'add_declared_intent',
              label: 'Add declared intent',
              targetId: 'policy-builder-belongs-here',
              mode: 'guidance',
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
        activeEmptyStateActionId: 'map_routing_destination',
        activeEmptyStateStatusId: 'policy-builder-empty-state-action-status',
      },
    })

    const buttons = wrapper.findAll('button')
    expect(wrapper.text()).toContain('Add declared intent')
    expect(wrapper.text()).not.toContain('Sync library now')
    expect(buttons.find(button => button.text() === 'Opening library mapping...')?.attributes('disabled')).toBeDefined()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(buttons.find(button => button.text() === 'Opening library mapping...')?.attributes('aria-describedby'))
      .toContain('policy-builder-empty-state-action-status')
  })

  it('renders observed signal selection only for selectable server projection', () => {
    const nonSelectableWrapper = mount(PolicyBuilderDestinationQuestions, {
      props: {
        sections: buildSections(),
        selectionEnabled: true,
        intentSignalOptions: [{
          candidateId: 'genre:anime',
          label: 'Anime',
          selectable: false,
        }],
      },
    })

    expect(nonSelectableWrapper.find('#intent-signal-picker-title').exists()).toBe(false)
    expect(nonSelectableWrapper.findAll('button')).toHaveLength(0)

    const selectableWrapper = mount(PolicyBuilderDestinationQuestions, {
      props: {
        sections: buildSections(),
        selectionEnabled: true,
        intentSignalOptions: [{
          candidateId: 'genre:anime',
          value: 'Anime',
          label: 'Anime',
          sourceId: 'suggested_from_observed_profile',
          sourceLabel: 'Suggested from this library',
          selectionStateId: 'selectable_suggestion',
          selectable: true,
          readOnlyEvidence: false,
          requiresExplicitAcceptance: true,
          canAutoDeclare: false,
          commandId: 'add_signal_value',
          signalType: 'genres',
          operator: 'require_any',
          questionId: 'what_belongs_here',
          explanation: 'Anime appears in the current library.',
          evidence: { count: 4 },
        }],
      },
    })

    expect(selectableWrapper.find('#intent-signal-picker-title').exists()).toBe(true)
    expect(selectableWrapper.text()).toContain('Add declared destination signals')
  })
})
