/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyBuilderWorkflowShell from '@/components/policies/PolicyBuilderWorkflowShell.vue'

const sectionIds = [
  'what_belongs_here',
  'what_should_not_go_here',
  'what_helps_but_should_not_decide_alone',
  'when_should_classifarr_ask',
  'can_this_route',
]

function buildWorkflowRead() {
  return {
    library: {
      id: 6,
      name: 'Family Movies',
    },
    observedProfile: {
      available: true,
      current: true,
      suggestionCount: 2,
      suggestions: [
        { key: 'genre:Animation', label: 'Animation', count: 48 },
        { key: 'genre:Family', label: 'Family', count: 32 },
      ],
    },
    workflow: {
      title: 'Destination setup',
      summary: 'Review this destination from current library evidence.',
      readiness: {
        ready: false,
        nextAction: { label: 'Connect a routing target' },
      },
      sections: sectionIds.map((sectionId, index) => ({
        sectionId,
        heading: `Section ${index + 1}`,
        plainQuestion: `Question ${index + 1}`,
        helperText: `Helper ${index + 1}`,
        statusId: index === 0 ? 'complete' : index === 1 ? 'optional' : 'needs_action',
        editable: sectionId !== 'can_this_route',
        readiness: sectionId === 'can_this_route'
          ? { nextAction: { label: 'Connect a routing target' } }
          : {},
      })),
    },
  }
}

describe('PolicyBuilderWorkflowShell.vue', () => {
  it('renders the five destination-first questions with observed library suggestions', () => {
    const wrapper = mount(PolicyBuilderWorkflowShell, {
      props: {
        workflowRead: buildWorkflowRead(),
      },
    })

    expect(wrapper.text()).toContain('What Classifarr sees in Family Movies')
    expect(wrapper.text()).toMatch(/Animation\s*48\s*currently here/)
    expect(wrapper.text()).toMatch(/Family\s*32\s*currently here/)
    expect(wrapper.text()).toContain('suggestions, not policy rules')
    expect(wrapper.findAll('article')).toHaveLength(5)
    expect(wrapper.text()).toContain('Automation readiness:')
    expect(wrapper.text()).toContain('Connect a routing target')
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.findAll('input')).toHaveLength(0)
  })

  it('announces loading and bounded errors without showing raw failure details', () => {
    const loadingWrapper = mount(PolicyBuilderWorkflowShell, {
      props: { loading: true },
    })

    expect(loadingWrapper.find('[role="status"]').text()).toContain('Loading the current library workflow.')
    expect(loadingWrapper.find('section').attributes('aria-busy')).toBe('true')

    const errorWrapper = mount(PolicyBuilderWorkflowShell, {
      props: { error: 'Classifarr could not load the library workflow. You can still review the connected library details.' },
    })

    expect(errorWrapper.find('[role="alert"]').text()).toContain('could not load the library workflow')
    expect(errorWrapper.text()).not.toContain('stack trace')
  })

  it('explains when observed profile evidence is unavailable', () => {
    const workflowRead = buildWorkflowRead()
    workflowRead.observedProfile = {
      available: false,
      current: false,
      suggestionCount: 0,
      suggestions: [],
    }

    const wrapper = mount(PolicyBuilderWorkflowShell, {
      props: { workflowRead },
    })

    expect(wrapper.text()).toContain('Profile unavailable')
    expect(wrapper.text()).toContain('A current library profile is not available yet.')
  })

  it('puts bounded empty-state actions in their owning destination question', async () => {
    const workflowRead = buildWorkflowRead()
    workflowRead.emptyStateProjection = {
      version: 'policy.operator_workflow_empty_state.v1',
      states: [
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
          description: 'This destination cannot route until it is mapped to an Arr root folder.',
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
    }

    const wrapper = mount(PolicyBuilderWorkflowShell, {
      props: { workflowRead, selectionEnabled: true },
    })

    const belongsHereArticle = wrapper.find('#policy-builder-workflow-what_belongs_here-title').element.closest('article')
    const routingArticle = wrapper.find('#policy-builder-workflow-can_this_route-title').element.closest('article')
    expect(belongsHereArticle?.textContent).toContain('Sync library now')
    expect(routingArticle?.textContent).toContain('Open library mapping')

    await wrapper.findAll('button').find(button => button.text() === 'Sync library now').trigger('click')
    expect(wrapper.emitted('empty-state-action')?.[0]?.[0]).toEqual(
      workflowRead.emptyStateProjection.states[0]
    )
  })

  it('forwards an empty-state action ID without relabeling other recovery actions', () => {
    const workflowRead = buildWorkflowRead()
    workflowRead.emptyStateProjection = {
      version: 'policy.operator_workflow_empty_state.v1',
      states: [
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
    }

    const wrapper = mount(PolicyBuilderWorkflowShell, {
      props: {
        workflowRead,
        selectionEnabled: true,
        activeEmptyStateActionId: 'sync_media_server_library',
      },
    })

    expect(wrapper.text()).toContain('Syncing library...')
    expect(wrapper.text()).toContain('Open library mapping')
    expect(wrapper.text()).not.toContain('Opening library mapping...')
  })

  it('keeps native observed values unavailable until a stale profile is refreshed', async () => {
    const workflowRead = buildWorkflowRead()
    workflowRead.observedProfile = {
      available: true,
      current: false,
      suggestionCount: 2,
      suggestions: [],
      intentSignalProjection: { options: [{
        candidateId: 'genre:Animation:purpose',
        value: 'Animation',
      }] },
    }

    const wrapper = mount(PolicyBuilderWorkflowShell, {
      props: {
        workflowRead,
        selectionEnabled: true,
      },
    })

    expect(wrapper.text()).toContain('Library evidence needs a refresh')
    expect(wrapper.text()).not.toContain('What should define this destination?')

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('refresh-profile')).toHaveLength(1)
  })

  it('offers a bounded workflow reload when native evidence cannot be read', async () => {
    const wrapper = mount(PolicyBuilderWorkflowShell, {
      props: {
        error: 'Classifarr could not load the library workflow.',
        selectionEnabled: true,
      },
    })

    expect(wrapper.text()).toContain('Library evidence is unavailable')
    expect(wrapper.text()).toContain('Try evidence check again')

    await wrapper.findAll('button').at(-1).trigger('click')
    expect(wrapper.emitted('reload-workflow')).toHaveLength(1)
  })

  it('keeps native policy creation focused on accepted library evidence', () => {
    const workflowRead = buildWorkflowRead()
    workflowRead.observedProfile.intentSignalProjection = {
      observedEvidence: workflowRead.observedProfile.suggestions,
      options: [{
      candidateId: 'genre:Animation:purpose',
      value: 'Animation',
      label: 'Animation',
      signalType: 'genres',
      operator: 'require_any',
      questionId: 'what_belongs_here',
      sourceId: 'suggested_from_observed_profile',
      sourceLabel: 'Suggested from this library',
      selectionStateId: 'selectable_suggestion',
      selectable: true,
      readOnlyEvidence: false,
      commandId: 'add_signal_value',
      explanation: 'Animation appears in 48 items in the current library.',
      evidence: { count: 48, confidence: 0.84 },
      requiresExplicitAcceptance: true,
      canAutoDeclare: false,
      }],
    }

    const wrapper = mount(PolicyBuilderWorkflowShell, {
      props: {
        workflowRead,
        selectionEnabled: true,
      },
    })

    expect(wrapper.text()).toContain('Define this destination')
    expect(wrapper.text()).toContain('What should define this destination?')
    expect(wrapper.text()).toContain('Add declared destination signals')
    expect(wrapper.findAll('article')).toHaveLength(5)
    expect(wrapper.find('[aria-label="Destination policy questions"]').exists()).toBe(true)
    const belongsHereArticle = wrapper.find('#policy-builder-workflow-what_belongs_here-title').element.closest('article')
    const routingArticle = wrapper.find('#policy-builder-workflow-can_this_route-title').element.closest('article')
    expect(belongsHereArticle?.textContent).toContain('What should define this destination?')
    expect(routingArticle?.textContent)
      .toContain('Creation does not route media. Classifarr will only apply approved matches after routing is ready.')
    expect(routingArticle?.textContent).not.toContain('Connect a routing target')
    expect(wrapper.text()).not.toContain('Automation readiness:')
    expect(wrapper.text()).not.toContain('Routing:')
  })
})
