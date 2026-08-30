/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AiReadinessController from '@/components/settings/AiReadinessController.vue'

const ButtonStub = {
  props: ['ariaPressed', 'disabled', 'size', 'variant'],
  emits: ['click'],
  template: '<button :aria-pressed="ariaPressed" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
}

function mountController(props = {}) {
  return mount(AiReadinessController, {
    props,
    global: {
      stubs: {
        Button: ButtonStub,
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  })
}

describe('AiReadinessController', () => {
  it('presents a ready saved Ollama capability without an unnecessary test action', () => {
    const wrapper = mountController({
      capability: {
        ollamaVerificationCapability: {
          statusId: 'verification_ready',
          label: 'Ollama verification is ready',
          message: 'The saved model passed the bounded test.',
          guidance: [],
          testable: true,
          host: 'private-ollama.internal',
          model: 'private-model',
        },
      },
      lastUpdatedAt: '2026-08-30T12:00:00.000Z',
    })

    expect(wrapper.text()).toContain('Ollama verification is ready')
    expect(wrapper.text()).toContain('Ready')
    expect(wrapper.text()).toContain('Updates automatically while this page is visible.')
    expect(wrapper.text()).not.toContain('Test saved Ollama verification')
    expect(wrapper.text()).not.toContain('private-ollama.internal')
    expect(wrapper.text()).not.toContain('private-model')
  })

  it('presents a server-owned non-Ollama ready capability as ready', () => {
    const wrapper = mountController({
      capability: {
        statusId: 'verification_ready',
        label: 'Strict verification is available',
        message: 'The saved primary AI path can admit strict candidate-bound verification.',
        guidance: [],
      },
    })

    expect(wrapper.text()).toContain('Ready')
    expect(wrapper.text()).not.toContain('Status unavailable')
  })

  it('gives a classification-only saved Ollama capability one clear verification action', async () => {
    const wrapper = mountController({
      capability: {
        ollamaVerificationCapability: {
          statusId: 'classification_only',
          label: 'Ollama is classification-only',
          message: 'The saved model did not satisfy the strict contract.',
          guidance: ['General AI classification remains available.'],
          testable: true,
        },
      },
    })

    expect(wrapper.text()).toContain('Classification only')
    const testButton = wrapper.findAll('button').find((button) => button.text().includes('Test saved Ollama verification'))
    expect(testButton).toBeDefined()

    await testButton.trigger('click')

    expect(wrapper.emitted('test')).toHaveLength(1)
  })

  it('exposes automatic-update controls only in diagnostics', async () => {
    const wrapper = mountController({ autoRefreshEnabled: true })
    const diagnostics = wrapper.get('[data-testid="ai-readiness-diagnostics"]')

    diagnostics.element.open = true
    await diagnostics.trigger('toggle')

    expect(wrapper.emitted('diagnostics-toggle')?.[0]).toEqual([true])

    const pauseButton = wrapper.findAll('button').find((button) => button.text().includes('Pause automatic updates'))
    expect(pauseButton).toBeDefined()
    expect(pauseButton.attributes('aria-pressed')).toBe('true')

    await pauseButton.trigger('click')
    expect(wrapper.emitted('toggle-auto-refresh')).toHaveLength(1)
  })
})
