/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyBuilderSetupCards from '@/components/policies/PolicyBuilderSetupCards.vue'

describe('PolicyBuilderSetupCards.vue', () => {
  it('renders the destination-first setup cards with concrete actions', () => {
    const wrapper = mount(PolicyBuilderSetupCards, {
      props: {
        cards: [
          {
            stepId: 'observed_application',
            heading: 'What already belongs here?',
            helperText: 'Use the current library as suggestions.',
            primaryActionLabel: 'Review suggestions',
            completionSignal: 'Accepted observed suggestions become declared destination meaning.',
            termLabels: ['Belongs Here'],
            targetId: 'policy-builder-library-context',
            state: {
              status: 'complete',
              statusLabel: 'Evidence ready',
              statusMessage: '2 current-library genre signals are available as suggestions.',
            },
          },
          {
            stepId: 'declared_destination_rules',
            heading: 'What should always or never belong here?',
            helperText: 'Add explicit operator intent.',
            primaryActionLabel: 'Set destination rules',
            completionSignal: 'Declared rules can define, block, or warn.',
            termLabels: ['Helpful Matches', 'Hard Limits', 'Avoid'],
            targetId: 'policy-builder-destination-rules',
            state: {
              status: 'needs_action',
              statusLabel: 'Needs rules',
              statusMessage: 'Add at least one belongs-here, helpful, hard-limit, boost, or avoid signal.',
            },
          },
          {
            stepId: 'review_behavior',
            heading: 'When should Classifarr ask?',
            helperText: 'Choose review triggers.',
            primaryActionLabel: 'Set review triggers',
            completionSignal: 'Review behavior controls when Classifarr asks.',
            termLabels: ['Ask When Unsure', 'Readiness'],
            targetId: 'policy-builder-review-behavior',
            state: {
              status: 'optional',
              statusLabel: 'Default checks',
              statusMessage: 'No operator-declared triggers yet; Classifarr can still ask when readiness is unsafe.',
            },
          },
          {
            stepId: 'routing_and_readiness',
            heading: 'Can this destination route?',
            helperText: 'Confirm where approved matches can be sent.',
            primaryActionLabel: 'Check routing readiness',
            completionSignal: 'Routing readiness confirms the destination can apply approved matches safely.',
            termLabels: ['Routing Target', 'Readiness'],
            targetId: 'policy-builder-routing-readiness',
            state: {
              status: 'complete',
              statusLabel: 'Ready',
              statusMessage: 'Routing target ready',
            },
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('Policy Setup')
    expect(wrapper.text()).toContain('Start from destination meaning')
    expect(wrapper.text()).toContain('What already belongs here?')
    expect(wrapper.text()).toContain('What should always or never belong here?')
    expect(wrapper.text()).toContain('When should Classifarr ask?')
    expect(wrapper.text()).toContain('Can this destination route?')
    expect(wrapper.text()).toContain('Belongs Here')
    expect(wrapper.text()).toContain('Hard Limits')
    expect(wrapper.text()).toContain('Readiness')
    expect(wrapper.text()).toContain('Evidence ready')
    expect(wrapper.text()).toContain('Needs rules')
    expect(wrapper.text()).toContain('Default checks')
    expect(wrapper.text()).toContain('Routing target ready')

    const actions = wrapper.findAll('a')
    expect(actions.map(action => action.text())).toEqual([
      'Review suggestions',
      'Set destination rules',
      'Set review triggers',
      'Check routing readiness',
    ])
    expect(actions.map(action => action.attributes('href'))).toEqual([
      '#policy-builder-library-context',
      '#policy-builder-destination-rules',
      '#policy-builder-review-behavior',
      '#policy-builder-routing-readiness',
    ])
  })
})
