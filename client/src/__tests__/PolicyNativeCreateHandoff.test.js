/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyNativeCreateHandoff from '@/components/policies/PolicyNativeCreateHandoff.vue'

function buildHandoff(overrides = {}) {
  return {
    policy: {
      id: 91,
      name: 'Sci-Fi Movies Policy',
      libraryName: 'Sci-Fi Movies',
    },
    declaredIntent: {
      authorityLabel: 'Declared destination intent',
      ruleCount: 2,
    },
    routing: {
      configured: false,
      label: 'Routing setup still needed',
      message: 'Set a routing target before approved matches can be applied automatically.',
    },
    detailsAvailable: true,
    ...overrides,
  }
}

describe('PolicyNativeCreateHandoff.vue', () => {
  it('announces a server-owned policy result and offers one completion action', async () => {
    const wrapper = mount(PolicyNativeCreateHandoff, {
      props: { handoff: buildHandoff() },
      attachTo: document.body,
    })

    expect(wrapper.find('[role="status"]').text()).toContain('Policy created')
    expect(wrapper.text()).toContain('2 declared destination rules')
    expect(wrapper.text()).toContain('Routing setup still needed')

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('done')).toHaveLength(1)
  })

  it('focuses its outcome heading after save completion', () => {
    const wrapper = mount(PolicyNativeCreateHandoff, {
      props: { handoff: buildHandoff() },
      attachTo: document.body,
    })

    wrapper.vm.focus()
    expect(document.activeElement?.id).toBe('policy-native-create-handoff-title')
  })

  it('does not claim that a failed details reread invalidated a saved policy', () => {
    const wrapper = mount(PolicyNativeCreateHandoff, {
      props: {
        handoff: buildHandoff({ detailsAvailable: false }),
      },
    })

    expect(wrapper.text()).toContain('The policy is saved.')
    expect(wrapper.text()).not.toContain('Set a routing target before approved matches')
  })
})
