/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VerificationCapabilityCurrentStateSummary from '@/components/settings/VerificationCapabilityCurrentStateSummary.vue'

const ButtonStub = {
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>'
}

function mountSummary(props = {}) {
  return mount(VerificationCapabilityCurrentStateSummary, {
    props,
    global: {
      stubs: {
        Button: ButtonStub,
        RouterLink: { template: '<a><slot /></a>' }
      }
    }
  })
}

describe('VerificationCapabilityCurrentStateSummary', () => {
  it('shows a model-change-only manual remediation and only normalized aggregate context', async () => {
    const wrapper = mountSummary({
      capability: {
        label: 'Strict verification needs attention',
        message: 'A saved model changed.',
        guidance: [],
        ollamaVerificationCapability: {
          statusId: 'model_changed',
          label: 'Ollama model changed since verification',
          message: 'Test the saved configuration again.',
          guidance: [],
          testable: true,
        },
      },
      runtimeMismatchSummary: {
        modelDigestMismatchCount: '0004',
        lastObservedAt: '2026-08-29T12:34:56.000Z',
        model: 'private-model-name',
        host: 'private-host.local',
        digest: 'a'.repeat(64),
        error: 'private provider failure',
      },
    })

    expect(wrapper.text()).toContain('Recommended next step')
    expect(wrapper.text()).toContain('4 runtime mismatches')
    expect(wrapper.text()).toContain('This never retries automatically')
    expect(wrapper.text()).toContain('Re-test saved Ollama verification')
    expect(wrapper.text()).not.toContain('Test Ollama Verification')
    expect(wrapper.text()).not.toContain('private-')
    expect(wrapper.text()).not.toContain('a'.repeat(64))

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('test')).toHaveLength(1)
  })

  it('keeps the ordinary test action for every state other than model_changed', () => {
    const wrapper = mountSummary({
      capability: {
        ollamaVerificationCapability: {
          statusId: 'ready',
          label: 'Ollama verification is ready',
          message: 'Saved capability is current.',
          guidance: [],
          testable: true,
        },
      },
      runtimeMismatchSummary: {
        modelDigestMismatchCount: '99',
        lastObservedAt: '2026-08-29T12:34:56.000Z',
      },
    })

    expect(wrapper.text()).not.toContain('Recommended next step')
    expect(wrapper.text()).toContain('Test Ollama Verification')
    expect(wrapper.text()).not.toContain('99 runtime mismatches')
  })
})
