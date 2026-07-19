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
        readiness: {},
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
    expect(wrapper.text()).toContain('Refresh the profile above before relying on observed suggestions.')
  })

  it('keeps native policy creation focused on accepted library evidence', () => {
    const workflowRead = buildWorkflowRead()
    workflowRead.observedProfile.selectableSuggestions = [{
      candidateId: 'genre:Animation:purpose',
      value: 'Animation',
      label: 'Animation',
      signalType: 'genres',
      operator: 'require_any',
      questionId: 'what_belongs_here',
      sourceId: 'suggested_from_observed_profile',
      explanation: 'Animation appears in 48 items in the current library.',
      evidenceCount: 48,
      requiresExplicitAcceptance: true,
      canAutoDeclare: false,
    }]

    const wrapper = mount(PolicyBuilderWorkflowShell, {
      props: {
        workflowRead,
        selectionEnabled: true,
      },
    })

    expect(wrapper.text()).toContain('Define this destination')
    expect(wrapper.text()).toContain('What should define this destination?')
    expect(wrapper.text()).toContain('Select all that apply')
    expect(wrapper.findAll('article')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Automation readiness:')
    expect(wrapper.text()).toContain('Routing:')
  })
})
