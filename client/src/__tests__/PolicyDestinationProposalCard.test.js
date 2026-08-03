/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyDestinationProposalCard from '@/components/policies/PolicyDestinationProposalCard.vue'

function buildProposal() {
  return {
    title: 'Anime Movies Policy',
    purpose: [{ signalType: 'genres', operator: 'any_of', values: ['Animation'] }],
    helpfulHints: [{ signalType: 'genres', operator: 'any_of', values: ['Adventure'] }],
    hardLimitCount: 1,
    avoidCount: 0,
    observedContext: {
      available: true,
      current: true,
      itemCount: 48,
      suggestionCount: 4,
      summary: 'The current library profile supports this destination.',
    },
  }
}

describe('PolicyDestinationProposalCard.vue', () => {
  it('shows observed and proposed state without a generic rule picker', async () => {
    const wrapper = mount(PolicyDestinationProposalCard, {
      props: { proposal: buildProposal() },
    })

    expect(wrapper.text()).toContain('Proposed, not saved')
    expect(wrapper.text()).toContain('48 items currently observed.')
    expect(wrapper.text()).toContain('genres any_of: Animation')
    expect(wrapper.findAll('input, select, textarea')).toHaveLength(0)
    expect(wrapper.find('button').text()).toBe('Create policy')
    expect(wrapper.find('button').attributes('aria-describedby'))
      .toBe('policy-destination-proposal-action-help')

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('admit')).toEqual([[]])
  })

  it('explains why the create action is disabled while admission is in progress', () => {
    const wrapper = mount(PolicyDestinationProposalCard, {
      props: { proposal: buildProposal(), loading: true },
    })

    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button').attributes('aria-busy')).toBe('true')
    expect(wrapper.text()).toContain('Wait for the server result before trying again.')
  })
})
