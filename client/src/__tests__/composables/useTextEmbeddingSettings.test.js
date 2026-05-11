/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

import { useTextEmbeddingSettings } from '@/composables/useTextEmbeddingSettings'

function createToast() {
  return {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }
}

function createApiClient(overrides = {}) {
  return {
    getAIConfig: vi.fn().mockResolvedValue({
      data: {
        primary_provider: 'openai',
        embedding_provider_mode: 'cloud',
        embedding_model: 'text-embedding-3-small',
        embedding_ollama_host: 'localhost',
        embedding_ollama_port: 11434,
        embedding_ollama_model: 'nomic-embed-text',
        embedding_cloud_provider: 'openai',
        embedding_cloud_api_key: 'cloud-key',
        embedding_cloud_model: 'text-embedding-3-large',
      },
    }),
    getRagStatus: vi.fn().mockResolvedValue({
      data: {
        providerOnline: true,
      },
    }),
    getBackfillStatus: vi.fn().mockResolvedValue({
      data: {
        idle: { enabled: true, presentation: { statusLabel: 'On' } },
        scheduled: { enabled: false, presentation: { statusLabel: 'Off' } },
      },
    }),
    getRagTextModels: vi.fn().mockResolvedValue({
      data: {
        models: [{ id: 'text-embedding-3-large', name: 'text-embedding-3-large' }],
        recommended: [{ id: 'text-embedding-3-large', description: 'OpenAI large', dims: 3072 }],
      },
    }),
    testRagConnection: vi.fn().mockResolvedValue({
      data: {
        success: true,
        dims: 3072,
        latency: 42,
      },
    }),
    updateAIConfig: vi.fn().mockResolvedValue({ data: { success: true } }),
    ...overrides,
  }
}

function mountTextSettings({ apiClient, toast }) {
  let settings

  const TestComponent = defineComponent({
    setup() {
      settings = useTextEmbeddingSettings({ apiClient, toast })
      return settings
    },
    template: '<div />',
  })

  const wrapper = mount(TestComponent)
  return { settings, wrapper }
}

describe('useTextEmbeddingSettings composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hydrates config, status, backfill state, and recommended models on mount', async () => {
    const apiClient = createApiClient()
    const toast = createToast()

    const { settings, wrapper } = mountTextSettings({ apiClient, toast })
    await flushPromises()

    expect(apiClient.getAIConfig).toHaveBeenCalledTimes(1)
    expect(apiClient.getRagStatus).toHaveBeenCalledTimes(1)
    expect(apiClient.getBackfillStatus).toHaveBeenCalledTimes(1)
    expect(settings.config.value.mode).toBe('cloud')
    expect(settings.cloudModels.value).toEqual([{ id: 'text-embedding-3-large', name: 'text-embedding-3-large' }])
    expect(settings.recommendedModels.value).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'text-embedding-3-large', dims: 3072 }),
      expect.objectContaining({ id: 'text-embedding-3-small', description: 'Configured model' }),
      expect.objectContaining({ id: 'nomic-embed-text', description: 'Configured model' }),
    ]))
    expect(settings.backfillStatus.value.idle.presentation.statusLabel).toBe('On')

    wrapper.unmount()
  })

  it('reloads recommended models when the selected mode changes', async () => {
    const apiClient = createApiClient()
    const toast = createToast()

    const { settings, wrapper } = mountTextSettings({ apiClient, toast })
    await flushPromises()

    apiClient.getRagTextModels.mockClear()
    apiClient.getRagTextModels.mockResolvedValueOnce({
      data: {
        models: [],
        recommended: [{ id: 'nomic-embed-text', description: 'Ollama local', dims: 768 }],
      },
    })

    settings.config.value.mode = 'separate_ollama'
    await flushPromises()

    expect(apiClient.getRagTextModels).toHaveBeenCalledWith({
      mode: 'separate_ollama',
      provider: undefined,
      api_key: undefined,
    })
    expect(settings.recommendedModels.value).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'nomic-embed-text', description: 'Ollama local', dims: 768 }),
      expect.objectContaining({ id: 'text-embedding-3-small', description: 'Configured model' }),
    ]))

    wrapper.unmount()
  })

  it('clears hidden cloud settings and persists when switching away from cloud mode', async () => {
    const apiClient = createApiClient()
    const toast = createToast()

    const { settings, wrapper } = mountTextSettings({ apiClient, toast })
    await flushPromises()

    settings.testResult.value = { success: true }
    settings.config.value.mode = 'same'

    await settings.onModeChange()

    expect(settings.testResult.value).toBeNull()
    expect(settings.config.value.cloud_provider).toBe('')
    expect(settings.config.value.cloud_api_key).toBe('')
    expect(settings.config.value.cloud_model).toBe('')
    expect(apiClient.updateAIConfig).toHaveBeenCalledWith(expect.objectContaining({
      embedding_provider_mode: 'same',
      embedding_cloud_provider: '',
      embedding_cloud_api_key: '',
      embedding_cloud_model: '',
    }))

    wrapper.unmount()
  })

  it('tests the current connection and stores the returned result', async () => {
    const apiClient = createApiClient()
    const toast = createToast()

    const { settings, wrapper } = mountTextSettings({ apiClient, toast })
    await flushPromises()

    await settings.testConnection()

    expect(apiClient.testRagConnection).toHaveBeenCalledWith({
      mode: 'cloud',
      host: 'localhost',
      port: 11434,
      model: 'nomic-embed-text',
    })
    expect(settings.testResult.value).toMatchObject({ success: true, dims: 3072 })
    expect(toast.success).toHaveBeenCalledWith('Connected successfully (3072 dimensions, 42ms)')

    wrapper.unmount()
  })
})