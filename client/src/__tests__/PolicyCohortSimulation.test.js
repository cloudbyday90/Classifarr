/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyCohortSimulation from '@/components/policies/PolicyCohortSimulation.vue'

describe('PolicyCohortSimulation', () => {
  it('shows bounded aggregate eligibility deltas and emits one explicit simulation request', async () => {
    const wrapper = mount(PolicyCohortSimulation, {
      props: {
        available: true,
        simulation: {
          sample: {
            windowDays: 90,
            maximumItems: 100,
            evaluatedItemCount: 12,
          },
          comparison: {
            baseline: { eligible: 4 },
            proposed: { eligible: 6 },
            transitions: {
              newlyEligible: 3,
              noLongerEligible: 1,
            },
          },
          guidance: {
            title: 'The proposed policy changes historic eligibility',
            description: 'Review the aggregate change before saving.',
          },
          advisory: true,
          draftRetained: false,
          rawConfigurationExposed: false,
          rawHistoricItemsExposed: false,
          routingAffected: false,
          providerAccessed: false,
          databaseWritten: false,
        },
      },
    })

    expect(wrapper.get('[role="status"]').text()).toContain('The proposed policy changes historic eligibility')
    expect(wrapper.text()).toContain('Historic items evaluated')
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('Newly eligible')
    expect(wrapper.text()).toContain('No longer eligible')
    expect(wrapper.text()).toContain('no titles, AI calls, saving, or routing')
    expect(wrapper.text()).not.toContain('Range of Stars')

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('simulate')).toEqual([[]])
  })

  it('keeps unavailable and error feedback bounded', () => {
    const wrapper = mount(PolicyCohortSimulation, {
      props: {
        available: false,
        error: 'Admin access required',
      },
    })

    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role="alert"]').text()).toBe('Admin access required')
    expect(wrapper.text()).toContain('Save this policy once')
  })
})
