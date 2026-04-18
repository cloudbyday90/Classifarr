/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TextEmbeddingsTab from '@/views/rag/TextEmbeddingsTab.vue'
import api from '@/api'

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn()
}

vi.mock('@/api', () => ({
  default: {
    getAIConfig: vi.fn(),
    getRagStatus: vi.fn(),
    getBackfillStatus: vi.fn(),
    getRagTextModels: vi.fn(),
    testRagConnection: vi.fn(),
    updateAIConfig: vi.fn()
  }
}))

vi.mock('@/stores/toast', () => ({
  useToast: () => toast
}))

const baseConfig = {
  primary_provider: 'openai',
  embedding_provider_mode: 'same',
  embedding_model: 'text-embedding-3-small',
  embedding_ollama_host: 'localhost',
  embedding_ollama_port: 11434,
  embedding_ollama_model: 'nomic-embed-text',
  embedding_cloud_provider: '',
  embedding_cloud_api_key: '',
  embedding_cloud_model: ''
}

function mockMountApis(overrides = {}) {
  api.getAIConfig.mockResolvedValue({
    data: {
      ...baseConfig,
      ...(overrides.config || {})
    }
  })
  api.getRagStatus.mockResolvedValue({
    data: {
      providerOnline: true,
      ...(overrides.status || {})
    }
  })
  api.getBackfillStatus.mockResolvedValue({
    data: {
      idle: { enabled: true, presentation: { statusLabel: 'On' } },
      scheduled: { enabled: false, presentation: { statusLabel: 'Off' } },
      ...(overrides.backfillStatus || {})
    }
  })
  api.getRagTextModels.mockResolvedValue({
    data: {
      models: [{ id: 'text-embedding-3-small', name: 'text-embedding-3-small' }],
      recommended: [{ id: 'text-embedding-3-small', description: 'OpenAI small', dims: 1536 }],
      ...(overrides.models || {})
    }
  })
  api.testRagConnection.mockResolvedValue({
    data: {
      success: true,
      dims: 1536,
      latency: 42
    }
  })
  api.updateAIConfig.mockResolvedValue({ data: { success: true } })
}

function mountTab() {
  return mount(TextEmbeddingsTab)
}

describe('TextEmbeddingsTab.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMountApis()
  })

  it('renders status and provider details from the loaded config', async () => {
    const wrapper = mountTab()
    await flushPromises()

    expect(wrapper.text()).toContain('Online')
    expect(wrapper.text()).toContain('openai')
    expect(wrapper.text()).toContain('text-embedding-3-small')

    wrapper.unmount()
  })

  it('tests the current provider connection and reports success', async () => {
    const wrapper = mountTab()
    await flushPromises()

    const testButton = wrapper.findAll('button').find((button) => button.text().includes('Test Connection'))
    await testButton.trigger('click')
    await flushPromises()

    expect(api.testRagConnection).toHaveBeenCalledWith({
      mode: 'same',
      host: 'localhost',
      port: 11434,
      model: 'text-embedding-3-small'
    })
    expect(wrapper.text()).toContain('Connected successfully (1536 dimensions)')
    expect(toast.success).toHaveBeenCalledWith('Connected successfully (1536 dimensions, 42ms)')

    wrapper.unmount()
  })

  it('fetches cloud models and updates the selectable list', async () => {
    mockMountApis({
      config: {
        embedding_provider_mode: 'cloud',
        embedding_cloud_provider: 'openai',
        embedding_cloud_api_key: 'cloud-key',
        embedding_cloud_model: 'text-embedding-3-large'
      },
      models: {
        models: [{ id: 'text-embedding-3-large', name: 'text-embedding-3-large' }],
        recommended: [{ id: 'text-embedding-3-large', description: 'OpenAI large', dims: 3072 }]
      }
    })

    const wrapper = mountTab()
    await flushPromises()

    api.getRagTextModels.mockResolvedValueOnce({
      data: {
        models: [{ id: 'text-embedding-3-large', name: 'text-embedding-3-large' }],
        recommended: [{ id: 'text-embedding-3-large', description: 'OpenAI large', dims: 3072 }]
      }
    })

    const fetchButtons = wrapper.findAll('button').filter((button) => button.text().includes('Fetch'))
    await fetchButtons[0].trigger('click')
    await flushPromises()

    expect(api.getRagTextModels).toHaveBeenLastCalledWith({
      mode: 'cloud',
      provider: 'openai',
      api_key: 'cloud-key'
    })
    expect(toast.success).toHaveBeenCalledWith('Found 1 models')

    wrapper.unmount()
  })

  it('reloads recommended models when the mode changes', async () => {
    const wrapper = mountTab()
    await flushPromises()

    api.getRagTextModels.mockResolvedValueOnce({
      data: {
        models: [],
        recommended: [{ id: 'nomic-embed-text', description: 'Ollama local', dims: 768 }]
      }
    })

    const modeSelect = wrapper.find('select')
    await modeSelect.setValue('separate_ollama')
    await flushPromises()

    expect(api.getRagTextModels).toHaveBeenLastCalledWith({
      mode: 'separate_ollama',
      provider: undefined,
      api_key: undefined
    })

    wrapper.unmount()
  })

  it('saves the text embedding configuration', async () => {
    const wrapper = mountTab()
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save Configuration'))
    await saveButton.trigger('click')
    await flushPromises()

    expect(api.updateAIConfig).toHaveBeenCalledWith({
      rag_enabled: true,
      embedding_provider_mode: 'same',
      embedding_model: 'text-embedding-3-small',
      embedding_ollama_host: 'localhost',
      embedding_ollama_port: 11434,
      embedding_ollama_model: 'nomic-embed-text',
      embedding_cloud_provider: '',
      embedding_cloud_api_key: '',
      embedding_cloud_model: ''
    })
    expect(toast.success).toHaveBeenCalledWith('Text embedding configuration saved successfully')

    wrapper.unmount()
  })
})