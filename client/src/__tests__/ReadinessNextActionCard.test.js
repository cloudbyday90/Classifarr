/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ReadinessNextActionCard from '@/components/policies/ReadinessNextActionCard.vue'

describe('ReadinessNextActionCard.vue', () => {
  it('announces the server-owned next action without exposing diagnostics', () => {
    const wrapper = mount(ReadinessNextActionCard, {
      props: {
        readiness: {
          ready: false,
          nextAction: { label: 'Connect a routing target' },
        },
      },
    })

    const status = wrapper.find('[role="status"]')
    expect(status.attributes('aria-live')).toBe('polite')
    expect(status.attributes('aria-atomic')).toBe('true')
    expect(status.text()).toContain('Automation readiness:')
    expect(status.text()).toContain('Connect a routing target')
    expect(status.text()).not.toContain('diagnostic')
  })

  it('does not render a status when the server provides no next action', () => {
    const wrapper = mount(ReadinessNextActionCard, {
      props: {
        readiness: { ready: true },
      },
    })

    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })
})
