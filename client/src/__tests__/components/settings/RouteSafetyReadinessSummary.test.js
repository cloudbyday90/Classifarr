/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RouteSafetyReadinessSummary from '@/components/settings/RouteSafetyReadinessSummary.vue'

function mountSummary(props = {}) {
  return mount(RouteSafetyReadinessSummary, { props })
}

describe('RouteSafetyReadinessSummary', () => {
  it('shows a concise, automatically refreshed aggregate without media or provider fields', () => {
    const wrapper = mountSummary({
      report: {
        version: 'classification.route_safety_readiness.v1',
        window: { days: 7 },
        observationCount: 4,
        primaryGates: [
          { id: 'policy_confirmation_required', count: 4 },
        ],
        status: { id: 'safeguards_observed' },
        title: 'Private media title',
        model: 'private-model',
      },
      lastUpdatedAt: '2026-08-31T12:00:00.000Z',
    })

    expect(wrapper.text()).toContain('Route safeguards observed')
    expect(wrapper.text()).toContain('Policy confirmation')
    expect(wrapper.text()).toContain('4')
    expect(wrapper.text()).toContain('Updates automatically while this page is visible.')
    expect(wrapper.text()).not.toContain('Private media title')
    expect(wrapper.text()).not.toContain('private-model')
  })

  it('announces a meaningful status transition without announcing refresh timestamps', async () => {
    const wrapper = mountSummary({
      report: {
        version: 'classification.route_safety_readiness.v1',
        window: { days: 7 },
        observationCount: 0,
        primaryGates: [],
        status: { id: 'no_recent_safeguard_decisions' },
      },
    })

    await wrapper.setProps({
      report: {
        version: 'classification.route_safety_readiness.v1',
        window: { days: 7 },
        observationCount: 1,
        primaryGates: [{ id: 'policy_confirmation_required', count: 1 }],
        status: { id: 'safeguards_observed' },
      },
      lastUpdatedAt: '2026-08-31T12:02:00.000Z',
    })

    expect(wrapper.get('[role="status"]').text()).toContain('Route-safety readiness changed: Route safeguards observed.')
  })
})
