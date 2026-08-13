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

const AI_SETTINGS_WRITE_PRECONDITION = '"00000000-0000-4000-8000-000000000407"'
const DEFAULT_AI_CONFIG = {
  primary_provider: 'openai',
  embedding_provider_mode: 'cloud',
  embedding_model: 'text-embedding-3-small',
  embedding_ollama_host: 'localhost',
  embedding_ollama_port: 11434,
  embedding_ollama_model: 'nomic-embed-text',
  embedding_cloud_provider: 'openai',
  embedding_cloud_api_key: 'cloud-key',
  embedding_cloud_model: 'text-embedding-3-large',
}

function createApiClient(overrides = {}) {
  return {
    getAIConfig: vi.fn().mockResolvedValue(DEFAULT_AI_CONFIG),
    getAIConfigForUpdate: vi.fn().mockResolvedValue({
      config: DEFAULT_AI_CONFIG,
      writePrecondition: AI_SETTINGS_WRITE_PRECONDITION,
    }),
    getRagStatus: vi.fn().mockResolvedValue({
      providerOnline: true,
    }),
    getBackfillStatus: vi.fn().mockResolvedValue({
      idle: { enabled: true, presentation: { statusLabel: 'On' } },
      scheduled: { enabled: false, presentation: { statusLabel: 'Off' } },
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
    updateAIConfig: vi.fn().mockResolvedValue({
      data: { success: true },
      headers: { etag: AI_SETTINGS_WRITE_PRECONDITION },
    }),
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

    expect(apiClient.getAIConfigForUpdate).toHaveBeenCalledTimes(1)
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
    }), AI_SETTINGS_WRITE_PRECONDITION)

    wrapper.unmount()
  })

  it('reloads only after a bounded stale-write response and does not retry the save', async () => {
    const refreshedConfig = {
      ...DEFAULT_AI_CONFIG,
      embedding_provider_mode: 'same',
      embedding_cloud_provider: '',
      embedding_cloud_api_key: '',
      embedding_cloud_model: '',
    }
    const apiClient = createApiClient({
      getAIConfigForUpdate: vi.fn()
        .mockResolvedValueOnce({
          config: DEFAULT_AI_CONFIG,
          writePrecondition: AI_SETTINGS_WRITE_PRECONDITION,
        })
        .mockResolvedValueOnce({
          config: refreshedConfig,
          writePrecondition: '"00000000-0000-4000-8000-000000000409"',
        }),
      updateAIConfig: vi.fn().mockRejectedValue({
        response: { data: { code: 'ai_settings_stale_write' } },
      }),
    })
    const toast = createToast()

    const { settings, wrapper } = mountTextSettings({ apiClient, toast })
    await flushPromises()

    settings.config.value.mode = 'same'
    await settings.onModeChange()

    expect(apiClient.updateAIConfig).toHaveBeenCalledTimes(1)
    expect(apiClient.updateAIConfig).toHaveBeenCalledWith(expect.any(Object), AI_SETTINGS_WRITE_PRECONDITION)
    expect(apiClient.getAIConfigForUpdate).toHaveBeenCalledTimes(2)
    expect(settings.config.value.mode).toBe('same')
    expect(toast.warning).toHaveBeenCalledWith(
      'AI settings changed before this save. Current settings were reloaded; review them and save again.',
    )

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

  it('stores failure result when connection test returns success false', async () => {
    const apiClient = createApiClient({
      testRagConnection: vi.fn().mockResolvedValue({
        data: { success: false, error: 'Timeout' },
      }),
    })
    const toast = createToast()

    const { settings, wrapper } = mountTextSettings({ apiClient, toast })
    await flushPromises()

    await settings.testConnection()

    expect(settings.testResult.value).toMatchObject({ success: false, error: 'Timeout' })
    expect(toast.error).toHaveBeenCalledWith('Timeout')

    wrapper.unmount()
  })

  it('stores failure result when connection test throws', async () => {
    const apiClient = createApiClient({
      testRagConnection: vi.fn().mockRejectedValue(new Error('Network failure')),
    })
    const toast = createToast()

    const { settings, wrapper } = mountTextSettings({ apiClient, toast })
    await flushPromises()

    await settings.testConnection()

    expect(settings.testResult.value).toMatchObject({ success: false, error: 'Network failure' })
    expect(toast.error).toHaveBeenCalledWith('Network failure')
    expect(settings.testing.value).toBe(false)

    wrapper.unmount()
  })

  it('shows error toast when saveConfig fails', async () => {
    const apiClient = createApiClient({
      updateAIConfig: vi.fn().mockRejectedValue({
        response: { data: { error: 'Server rejected' } },
      }),
    })
    const toast = createToast()

    const { settings, wrapper } = mountTextSettings({ apiClient, toast })
    await flushPromises()

    await settings.saveConfig()

    expect(toast.error).toHaveBeenCalledWith('Server rejected')
    expect(settings.saving.value).toBe(false)

    wrapper.unmount()
  })

  it('resets cloud provider state when switching to cloud from a non-cloud mode', async () => {
    const apiClient = createApiClient()
    const toast = createToast()

    const { settings, wrapper } = mountTextSettings({ apiClient, toast })
    await flushPromises()

    settings.config.value.mode = 'same'
    await settings.onModeChange()
    await flushPromises()

    settings.config.value.mode = 'cloud'
    await settings.onModeChange()
    await flushPromises()

    expect(apiClient.updateAIConfig).toHaveBeenCalledWith(expect.objectContaining({
      embedding_provider_mode: 'cloud',
    }), AI_SETTINGS_WRITE_PRECONDITION)

    wrapper.unmount()
  })
})
