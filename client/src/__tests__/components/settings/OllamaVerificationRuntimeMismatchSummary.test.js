/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OllamaVerificationRuntimeMismatchSummary from '@/components/settings/OllamaVerificationRuntimeMismatchSummary.vue'

const ButtonStub = {
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>'
}

function mountSummary(props = {}) {
  return mount(OllamaVerificationRuntimeMismatchSummary, {
    props,
    global: {
      stubs: {
        Button: ButtonStub
      }
    }
  })
}

describe('OllamaVerificationRuntimeMismatchSummary', () => {
  it('renders only the allow-listed aggregate fields', () => {
    const wrapper = mountSummary({
      report: {
        modelDigestMismatchCount: '0007',
        lastObservedAt: '2026-08-29T12:34:56.000Z',
        model: 'private-model-name',
        host: 'private-host.local',
        digest: 'a'.repeat(64),
        error: 'private provider failure'
      }
    })

    expect(wrapper.get('[data-testid="model-digest-mismatch-count"]').text()).toBe('7')
    expect(wrapper.get('[data-testid="model-digest-mismatch-last-observed"]').text()).not.toBe('Not observed')
    expect(wrapper.text()).not.toContain('private-')
    expect(wrapper.text()).not.toContain('a'.repeat(64))
  })

  it('normalizes malformed report values to a safe empty state', () => {
    const wrapper = mountSummary({
      report: {
        modelDigestMismatchCount: '-2',
        lastObservedAt: 'not-a-timestamp'
      }
    })

    expect(wrapper.get('[data-testid="model-digest-mismatch-count"]').text()).toBe('0')
    expect(wrapper.get('[data-testid="model-digest-mismatch-last-observed"]').text()).toBe('Not observed')
    expect(wrapper.text()).toContain('No strict-Ollama model-digest mismatches have been observed.')
  })

  it('emits a refresh request without accepting any filter input', async () => {
    const wrapper = mountSummary()

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })
})
