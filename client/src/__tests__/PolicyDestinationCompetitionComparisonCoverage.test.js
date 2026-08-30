/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyDestinationCompetitionComparisonCoverage from '@/components/policies/PolicyDestinationCompetitionComparisonCoverage.vue'

describe('PolicyDestinationCompetitionComparisonCoverage', () => {
  it('explains complete comparison coverage without claiming routing safety', () => {
    const wrapper = mount(PolicyDestinationCompetitionComparisonCoverage, {
      props: {
        coverage: {
          comparedActiveCompetitorPolicyCount: 25,
          maximumCompetitorPolicyCount: 25,
          additionalActiveCompetitorsExcluded: false,
        },
      },
    })

    expect(wrapper.get('h4').text()).toBe('Comparison coverage is complete')
    expect(wrapper.text()).toContain('Every active same-media-type destination fit')
    expect(wrapper.text()).toContain('25 active destinations were compared')
    expect(wrapper.text()).toContain('Exact totals, identities, configurations, and the server-only cap check remain private.')
    expect(wrapper.text()).not.toContain('Range of Stars')
  })

  it('warns when the fixed cap excluded at least one active competitor', () => {
    const wrapper = mount(PolicyDestinationCompetitionComparisonCoverage, {
      props: {
        coverage: {
          comparedActiveCompetitorPolicyCount: 25,
          maximumCompetitorPolicyCount: 25,
          additionalActiveCompetitorsExcluded: true,
        },
      },
    })

    expect(wrapper.get('h4').text()).toBe('Comparison coverage is capped')
    expect(wrapper.text()).toContain('Do not treat absence of shared eligibility')
  })

  it('does not render malformed coverage', () => {
    const wrapper = mount(PolicyDestinationCompetitionComparisonCoverage, {
      props: {
        coverage: {
          comparedActiveCompetitorPolicyCount: 26,
          maximumCompetitorPolicyCount: 25,
          additionalActiveCompetitorsExcluded: false,
        },
      },
    })

    expect(wrapper.find('section').exists()).toBe(false)
  })
})
