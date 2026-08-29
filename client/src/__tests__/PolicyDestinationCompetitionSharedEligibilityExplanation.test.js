/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyDestinationCompetitionSharedEligibilityExplanation from '@/components/policies/PolicyDestinationCompetitionSharedEligibilityExplanation.vue'

describe('PolicyDestinationCompetitionSharedEligibilityExplanation', () => {
  it('presents only anonymous configured-category aggregates as a structured explanation', () => {
    const wrapper = mount(PolicyDestinationCompetitionSharedEligibilityExplanation, {
      props: {
        explanation: {
          categories: [{
            categoryId: 'genre_purpose',
            label: 'Genre-based declared purpose',
            configuredCompetitorPolicyCount: 2,
          }],
          guidance: {
            description: 'This category may contribute to shared eligibility.',
          },
        },
      },
    })

    expect(wrapper.get('h4').text()).toBe('Why shared eligibility may occur')
    expect(wrapper.get('ul').text()).toContain('Genre-based declared purpose')
    expect(wrapper.text()).toContain('2 anonymous active competitor configurations')
    expect(wrapper.text()).toContain('Rule values, policy identities, media records, and individual outcomes remain private.')
    expect(wrapper.text()).not.toContain('Range of Stars')
  })

  it('keeps malformed categories out of the explanation', () => {
    const wrapper = mount(PolicyDestinationCompetitionSharedEligibilityExplanation, {
      props: {
        explanation: {
          categories: [{
            categoryId: 'genre_purpose',
            label: 'Genre-based declared purpose',
            configuredCompetitorPolicyCount: 0,
          }],
        },
      },
    })

    expect(wrapper.find('ul').exists()).toBe(false)
  })
})
