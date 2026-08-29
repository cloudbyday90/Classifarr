/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import QueueAdmissionDiagnostics from '@/components/command-center/QueueAdmissionDiagnostics.vue'

describe('QueueAdmissionDiagnostics', () => {
  it('shows worker capacity and strict model-change states as separate facts', async () => {
    const wrapper = mount(QueueAdmissionDiagnostics, {
      props: {
        diagnostics: {
          queue: { statusId: 'no_eligible_worker' },
          strictVerification: {
            statusId: 'model_changed',
            model: 'private-model',
            host: 'private-host',
            error: 'private-error',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Queue admission')
    expect(wrapper.text()).toContain('All eligible classification capacity is in use.')
    expect(wrapper.text()).toContain('Strict verification')
    expect(wrapper.text()).toContain('saved Ollama model changed after strict verification')
    expect(wrapper.text()).toContain('Open AI Settings')
    expect(wrapper.text()).not.toContain('private-model')
    expect(wrapper.text()).not.toContain('private-host')
    expect(wrapper.text()).not.toContain('private-error')

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('open-ai-settings')).toHaveLength(1)
  })

  it('does not render unknown or non-actionable server values', () => {
    const wrapper = mount(QueueAdmissionDiagnostics, {
      props: {
        diagnostics: {
          queue: { statusId: 'untrusted-value' },
          strictVerification: { statusId: 'not_blocked' },
        },
      },
    })

    expect(wrapper.find('[aria-label="Queue admission status"]').exists()).toBe(false)
  })
})
