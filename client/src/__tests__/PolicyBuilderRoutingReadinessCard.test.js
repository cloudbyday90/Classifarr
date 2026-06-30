/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyBuilderRoutingReadinessCard from '@/components/policies/PolicyBuilderRoutingReadinessCard.vue'

describe('PolicyBuilderRoutingReadinessCard.vue', () => {
  it('renders a polite status and one next action when routing needs setup', () => {
    const wrapper = mount(PolicyBuilderRoutingReadinessCard, {
      props: {
        readiness: {
          status: 'needs_routing_target',
          tone: 'warning',
          canRoute: false,
          label: 'Connect a routing target',
          message: 'Family Movies needs a mapped Radarr destination before approved matches can route automatically.',
          nextActionLabel: 'Review routing settings',
          targetId: 'policy-builder-advanced-settings',
          facts: [
            { label: 'Library', value: 'Family Movies' },
            { label: 'Destination service', value: 'Radarr' },
          ],
        },
      },
    })

    expect(wrapper.find('[role="status"]').attributes('aria-live')).toBe('polite')
    expect(wrapper.text()).toContain('Routing Readiness')
    expect(wrapper.text()).toContain('Connect a routing target')
    expect(wrapper.text()).toContain('Needs setup')
    expect(wrapper.text()).toContain('Library')
    expect(wrapper.text()).toContain('Family Movies')
    expect(wrapper.find('a').text()).toBe('Review routing settings')
    expect(wrapper.find('a').attributes('href')).toBe('#policy-builder-advanced-settings')
  })

  it('renders ready state without a setup action', () => {
    const wrapper = mount(PolicyBuilderRoutingReadinessCard, {
      props: {
        readiness: {
          status: 'ready',
          tone: 'success',
          canRoute: true,
          label: 'Routing target ready',
          message: 'Animated Movies can send approved matches to Radarr at /movies/animated.',
          nextActionLabel: '',
          targetId: 'policy-builder-routing-readiness',
          facts: [
            { label: 'Library', value: 'Animated Movies' },
            { label: 'Destination service', value: 'Radarr' },
            { label: 'Root folder', value: '/movies/animated' },
          ],
        },
      },
    })

    expect(wrapper.text()).toContain('Ready')
    expect(wrapper.text()).toContain('Root folder')
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.find('.text-green-100').exists()).toBe(true)
  })
})
