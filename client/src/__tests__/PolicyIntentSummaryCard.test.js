/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyIntentSummaryCard from '../components/policies/PolicyIntentSummaryCard.vue'

describe('PolicyIntentSummaryCard.vue', () => {
  it('renders read-only policy behavior sections', () => {
    const wrapper = mount(PolicyIntentSummaryCard, {
      props: {
        summary: {
          has_warnings: false,
          sections: [
            {
              key: 'purpose',
              label: 'Purpose',
              help: 'Signals that define what belongs in this library.',
              tone: 'green',
              emptyText: 'No belongs-here signals yet.',
              items: [
                { text: 'genres: Family', source: 'Family' },
              ],
            },
            {
              key: 'hard_limits',
              label: 'Hard Limits',
              help: 'Constraints and avoid rules that can block a bad match.',
              tone: 'amber',
              emptyText: 'No hard limits or avoid rules yet.',
              items: [
                { text: 'certifications: max PG-13', source: 'Family' },
              ],
            },
          ],
        },
      },
    })

    expect(wrapper.text()).toContain('Policy Behavior Summary')
    expect(wrapper.text()).toContain('Looks complete')
    expect(wrapper.text()).toContain('Purpose')
    expect(wrapper.text()).toContain('genres: Family')
    expect(wrapper.text()).toContain('certifications: max PG-13')
  })

  it('renders warning and empty section copy', () => {
    const wrapper = mount(PolicyIntentSummaryCard, {
      props: {
        summary: {
          has_warnings: true,
          sections: [
            {
              key: 'purpose',
              label: 'Purpose',
              help: 'Signals that define what belongs in this library.',
              tone: 'green',
              emptyText: 'No belongs-here signals yet.',
              items: [],
            },
            {
              key: 'review_triggers',
              label: 'Review Triggers',
              help: 'Deterministic checks that explain weak intent.',
              tone: 'red',
              emptyText: 'No review triggers detected.',
              items: [
                { text: 'No belongs-here signals are defined yet.', source: 'Policy intent check' },
              ],
            },
          ],
        },
      },
    })

    expect(wrapper.text()).toContain('Needs review')
    expect(wrapper.text()).toContain('No belongs-here signals yet.')
    expect(wrapper.text()).toContain('No belongs-here signals are defined yet.')
  })
})
