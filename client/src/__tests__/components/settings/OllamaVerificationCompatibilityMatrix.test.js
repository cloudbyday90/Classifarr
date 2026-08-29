/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OllamaVerificationCompatibilityMatrix from '@/components/settings/OllamaVerificationCompatibilityMatrix.vue'

const ButtonStub = {
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>'
}

function mountMatrix(props = {}) {
  return mount(OllamaVerificationCompatibilityMatrix, {
    props,
    global: { stubs: { Button: ButtonStub } }
  })
}

describe('OllamaVerificationCompatibilityMatrix', () => {
  it('renders only allow-listed advisory matrix fields', () => {
    const wrapper = mountMatrix({
      report: {
        stateId: 'completed',
        ollamaVersion: '0.12.4',
        omittedModelCount: 2,
        outcomes: [
          {
            modelName: 'gemma4:e4b',
            modelBuildId: 'a'.repeat(12),
            statusId: 'verification_ready',
            checkedAt: '2026-08-29T12:34:56.000Z',
            host: 'private-ollama.internal',
            prompt: 'private prompt',
            response: 'private model output'
          },
          {
            modelName: 'other:latest',
            modelBuildId: 'b'.repeat(12),
            statusId: 'classification_only',
            checkedAt: '2026-08-29T12:35:56.000Z'
          },
          {
            modelName: 'ignored:latest',
            modelBuildId: 'c'.repeat(12),
            statusId: 'unexpected'
          }
        ]
      }
    })

    expect(wrapper.get('[data-testid="compatibility-matrix-state"]').text()).toBe('Compatibility check complete')
    expect(wrapper.text()).toContain('gemma4:e4b')
    expect(wrapper.text()).toContain('Strict output ready')
    expect(wrapper.text()).toContain('Classification only')
    expect(wrapper.text()).toContain('2 installed models not tested in this run.')
    expect(wrapper.text()).not.toContain('private-')
    expect(wrapper.text()).not.toContain('ignored:latest')
  })

  it('renders safe fallback state and emits a parameter-free run request', async () => {
    const wrapper = mountMatrix({
      report: {
        stateId: 'unknown',
        ollamaVersion: 'not version / private host',
        outcomes: [{ modelName: 'unsafe model name', statusId: 'verification_ready' }]
      }
    })

    expect(wrapper.get('[data-testid="compatibility-matrix-state"]').text()).toBe('Compatibility result unavailable')
    expect(wrapper.text()).toContain('Ollama version: Unavailable')
    expect(wrapper.text()).not.toContain('unsafe model name')

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('run')).toHaveLength(1)
  })
})
