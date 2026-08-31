/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RouteSafetyMaintenanceHandoff from '@/components/settings/RouteSafetyMaintenanceHandoff.vue'

const RouterLinkStub = {
  props: ['to'],
  template: '<a :data-route="JSON.stringify(to)"><slot /></a>',
}

function report() {
  return {
    version: 'classification.route_safety_maintenance_handoff.v1',
    status: { id: 'review_recommended' },
    handoff: { gateId: 'policy_confirmation_required', currentCount: 4, previousCount: 5 },
  }
}

describe('RouteSafetyMaintenanceHandoff', () => {
  it('shows one descriptive, advisory link without server-derived policy data', () => {
    const wrapper = mount(RouteSafetyMaintenanceHandoff, {
      props: {
        report: {
          ...report(),
          title: 'Private media title',
          handoff: { ...report().handoff, policyId: 'private-policy', url: 'https://untrusted.example/' },
        },
      },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })

    expect(wrapper.text()).toContain('Repeated policy confirmations')
    expect(wrapper.text()).toContain('Review policy configuration')
    expect(wrapper.text()).toContain('does not select a policy')
    expect(wrapper.get('a').attributes('data-route')).toContain('Policies')
    expect(wrapper.text()).not.toContain('Private media title')
    expect(wrapper.text()).not.toContain('private-policy')
    expect(wrapper.text()).not.toContain('untrusted.example')
  })

  it('announces only a transition to a recommended review', async () => {
    const wrapper = mount(RouteSafetyMaintenanceHandoff, {
      props: {
        report: {
          version: 'classification.route_safety_maintenance_handoff.v1',
          status: { id: 'not_recommended' },
          handoff: null,
        },
      },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })

    await wrapper.setProps({ report: report() })

    expect(wrapper.get('[role="status"]').text()).toContain('Policy maintenance review is recommended.')
  })
})
