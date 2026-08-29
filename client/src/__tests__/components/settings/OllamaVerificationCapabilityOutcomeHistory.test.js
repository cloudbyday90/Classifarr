/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OllamaVerificationCapabilityOutcomeHistory from '@/components/settings/OllamaVerificationCapabilityOutcomeHistory.vue'

const ButtonStub = {
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>'
}

function mountHistory(props = {}) {
  return mount(OllamaVerificationCapabilityOutcomeHistory, {
    props,
    global: {
      stubs: {
        Button: ButtonStub
      }
    }
  })
}

describe('OllamaVerificationCapabilityOutcomeHistory', () => {
  it('renders only allow-listed aggregate outcomes and the mixed signal', () => {
    const wrapper = mountHistory({
      report: {
        totalTests: '0003',
        signal: {
          id: 'intermittent',
          label: 'Mixed test outcomes',
          message: 'private server message'
        },
        outcomes: [
          {
            statusId: 'verification_ready',
            count: '2',
            lastObservedAt: '2026-08-29T12:34:56.000Z',
            model: 'private-model-name',
            host: 'private-host.local'
          },
          {
            statusId: 'classification_only',
            count: '1',
            lastObservedAt: null,
            response: 'private model output'
          },
          {
            statusId: 'unexpected',
            count: '99',
            error: 'private provider failure'
          }
        ]
      }
    })

    expect(wrapper.get('[data-testid="verification-outcome-signal-label"]').text()).toBe('Mixed test outcomes')
    expect(wrapper.get('[data-testid="verification-outcome-count-verification_ready"]').text()).toBe('2')
    expect(wrapper.get('[data-testid="verification-outcome-count-classification_only"]').text()).toBe('1')
    expect(wrapper.get('[data-testid="verification-outcome-count-unavailable"]').text()).toBe('0')
    expect(wrapper.text()).toContain('3 saved tests in the last 30 days.')
    expect(wrapper.text()).not.toContain('private-')
  })

  it('normalizes malformed values to safe empty values', () => {
    const wrapper = mountHistory({
      report: {
        totalTests: '-2',
        outcomes: [{ statusId: 'verification_ready', count: '-1', lastObservedAt: 'not-a-timestamp' }]
      }
    })

    expect(wrapper.get('[data-testid="verification-outcome-signal-label"]').text()).toBe('No recent tests')
    expect(wrapper.get('[data-testid="verification-outcome-count-verification_ready"]').text()).toBe('0')
    expect(wrapper.text()).toContain('0 saved tests in the last 30 days.')
    expect(wrapper.text()).toContain('Last: Not observed')
  })

  it('emits a parameter-free refresh request', async () => {
    const wrapper = mountHistory()

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })
})
