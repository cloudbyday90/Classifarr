/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

import { useImageEmbeddingSettings } from '@/composables/useImageEmbeddingSettings'

function createToast() {
  return {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }
}

const AI_SETTINGS_WRITE_PRECONDITION = '"00000000-0000-4000-8000-000000000408"'
const DEFAULT_AI_CONFIG = {
  image_embedding_provider_mode: 'separate_local',
  image_embedding_local_host: 'image-embedder',
  image_embedding_local_port: 8000,
  image_embedding_local_model: 'ViT-B-16',
  image_embedding_local_api_key: 'local-key',
  image_embedding_local_timeout_ms: 15000,
  image_embedding_image_size: 512,
  image_embedding_rps: 2,
  image_embedding_concurrency: 2,
  image_embedding_batch_size: 1,
  image_embedding_cache_ttl_hours: 24,
  image_embedding_cache_max_mb: 1024,
  image_embedding_cloud_provider: 'voyage',
  image_embedding_cloud_api_key: 'cloud-key',
  image_embedding_cloud_model: 'voyage-multimodal-3',
  image_embedding_cloud_api_endpoint: 'https://example.test/models',
}

function createApiClient(overrides = {}) {
  return {
    getAIConfig: vi.fn().mockResolvedValue(DEFAULT_AI_CONFIG),
    getAIConfigForUpdate: vi.fn().mockResolvedValue({
      config: DEFAULT_AI_CONFIG,
      writePrecondition: AI_SETTINGS_WRITE_PRECONDITION,
    }),
    getRagStatus: vi.fn().mockResolvedValue({
      image: {
        enabled: true,
        providerOnline: false,
        providerConfigured: true,
        status: 'configured',
        provider: 'local',
        model: 'ViT-B-16',
      },
    }),
    getBackfillStatus: vi.fn().mockResolvedValue({
      idle: { enabled: true, presentation: { statusLabel: 'On' } },
      scheduled: { enabled: false, presentation: { statusLabel: 'Off' } },
    }),
    getImageModelMetadata: vi.fn().mockResolvedValue({
      data: {
        models: [{ id: 'ViT-B-16', name: 'ViT-B-16', dims: 512 }],
        fetchedAt: '2026-05-11T12:00:00.000Z',
        cacheHit: true,
      },
    }),
    updateAIConfig: vi.fn().mockResolvedValue({
      data: { success: true },
      headers: { etag: AI_SETTINGS_WRITE_PRECONDITION },
    }),
    testImageEmbeddingConnection: vi.fn().mockResolvedValue({
      data: {
        success: true,
        dims: 512,
      },
    }),
    reembedImages: vi.fn().mockResolvedValue({ data: { cleared: 12 } }),
    ...overrides,
  }
}

function mountImageSettings({ apiClient, toast }) {
  let settings

  const TestComponent = defineComponent({
    setup() {
      settings = useImageEmbeddingSettings({ apiClient, toast })
      return settings
    },
    template: '<div />',
  })

  const wrapper = mount(TestComponent)
  return { settings, wrapper }
}

describe('useImageEmbeddingSettings composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    localStorage.clear()
    global.confirm = vi.fn(() => true)
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('hydrates config, runtime status, backfill state, and server model cache on mount', async () => {
    const apiClient = createApiClient()
    const toast = createToast()

    const { settings, wrapper } = mountImageSettings({ apiClient, toast })
    await flushPromises()

    expect(apiClient.getAIConfigForUpdate).toHaveBeenCalledTimes(1)
    expect(apiClient.getRagStatus).toHaveBeenCalledTimes(1)
    expect(apiClient.getBackfillStatus).toHaveBeenCalledTimes(1)
    expect(apiClient.getImageModelMetadata).toHaveBeenCalledWith({
      mode: 'separate_local',
      local_host: 'image-embedder',
      local_port: 8000,
      local_api_key: 'local-key',
      refresh: false,
    })
    expect(settings.config.value.image_mode).toBe('separate_local')
    expect(settings.imageLocalModels.value[0]).toMatchObject({ id: 'ViT-B-16', dims: 512 })
    expect(settings.modelsCacheSource.value).toBe('server')

    wrapper.unmount()
  })

  it('clears stale hidden secrets and persists when switching to disabled mode', async () => {
    const apiClient = createApiClient()
    const toast = createToast()

    const { settings, wrapper } = mountImageSettings({ apiClient, toast })
    await flushPromises()

    settings.config.value.image_mode = 'disabled'
    await settings.onImageModeChange()

    expect(settings.config.value.image_local_api_key).toBe('')
    expect(settings.config.value.image_cloud_provider).toBe('')
    expect(settings.config.value.image_cloud_api_key).toBe('')
    expect(settings.config.value.image_cloud_model).toBe('')
    expect(settings.imageCloudModels.value).toEqual([])
    expect(apiClient.updateAIConfig).toHaveBeenCalledWith(expect.objectContaining({
      image_embedding_provider_mode: 'disabled',
      image_embedding_local_api_key: '',
      image_embedding_cloud_provider: '',
      image_embedding_cloud_api_key: '',
      image_embedding_cloud_model: '',
      image_embedding_cloud_api_endpoint: '',
    }), AI_SETTINGS_WRITE_PRECONDITION)

    wrapper.unmount()
  })

  it('tests the image connection and persists config on success', async () => {
    const apiClient = createApiClient()
    const toast = createToast()

    const { settings, wrapper } = mountImageSettings({ apiClient, toast })
    await flushPromises()

    await settings.testImageConnection()

    expect(apiClient.testImageEmbeddingConnection).toHaveBeenCalledWith({
      mode: 'separate_local',
      local_host: 'image-embedder',
      local_port: 8000,
      local_model: 'ViT-B-16',
      local_api_key: 'local-key',
      cloud_provider: 'voyage',
      cloud_api_key: 'cloud-key',
      cloud_model: 'voyage-multimodal-3',
      cloud_api_endpoint: 'https://example.test/models',
      image_size: 512,
    })
    expect(apiClient.updateAIConfig).toHaveBeenCalledWith(expect.objectContaining({
      image_embedding_provider_mode: 'separate_local',
      image_embedding_local_api_key: 'local-key',
      image_embedding_local_timeout_ms: 15000,
    }), AI_SETTINGS_WRITE_PRECONDITION)
    expect(toast.success).toHaveBeenCalledWith('Image embedding configuration looks good')

    wrapper.unmount()
  })

  it('re-embeds images after confirmation', async () => {
    const apiClient = createApiClient()
    const toast = createToast()

    const { settings, wrapper } = mountImageSettings({ apiClient, toast })
    await flushPromises()

    await settings.reembedImages()

    expect(global.confirm).toHaveBeenCalledTimes(1)
    expect(apiClient.reembedImages).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Cleared 12 image embeddings')

    wrapper.unmount()
  })

  it('shows error toast when testImageConnection fails and does not save', async () => {
    const apiClient = createApiClient({
      testImageEmbeddingConnection: vi.fn().mockRejectedValue({
        response: { data: { error: 'Connection refused' } },
      }),
    })
    const toast = createToast()

    const { settings, wrapper } = mountImageSettings({ apiClient, toast })
    await flushPromises()

    await settings.testImageConnection()

    expect(toast.error).toHaveBeenCalledWith('Connection refused')
    expect(apiClient.updateAIConfig).not.toHaveBeenCalledWith(expect.objectContaining({
      image_embedding_provider_mode: 'separate_local',
    }))
    expect(settings.testing.value).toBe(false)

    wrapper.unmount()
  })

  it('skips toast when saveConfig is called with silent=true', async () => {
    const apiClient = createApiClient()
    const toast = createToast()

    const { settings, wrapper } = mountImageSettings({ apiClient, toast })
    await flushPromises()

    const result = await settings.saveConfig({ silent: true })

    expect(result).toBe(true)
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('shows info toast and returns early when testing connection while disabled', async () => {
    const apiClient = createApiClient()
    const toast = createToast()

    const { settings, wrapper } = mountImageSettings({ apiClient, toast })
    await flushPromises()

    settings.config.value.image_mode = 'disabled'
    await settings.testImageConnection()

    expect(toast.info).toHaveBeenCalledWith('Image embeddings are disabled')
    expect(apiClient.testImageEmbeddingConnection).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('aborts reembed when user cancels confirmation', async () => {
    const apiClient = createApiClient()
    const toast = createToast()
    global.confirm.mockReturnValueOnce(false)

    const { settings, wrapper } = mountImageSettings({ apiClient, toast })
    await flushPromises()

    await settings.reembedImages()

    expect(apiClient.reembedImages).not.toHaveBeenCalled()
    expect(settings.reembeddingImages.value).toBe(false)

    wrapper.unmount()
  })

  it('clears cloud state when switching to cloud from a non-cloud mode', async () => {
    const apiClient = createApiClient()
    const toast = createToast()

    const { settings, wrapper } = mountImageSettings({ apiClient, toast })
    await flushPromises()

    settings.config.value.image_mode = 'cloud'
    await settings.onImageModeChange()
    await flushPromises()

    expect(settings.config.value.image_cloud_api_key).toBe('')
    expect(settings.config.value.image_cloud_model).toBe('')
    expect(apiClient.updateAIConfig).toHaveBeenCalledWith(expect.objectContaining({
      image_embedding_provider_mode: 'cloud',
    }), AI_SETTINGS_WRITE_PRECONDITION)

    wrapper.unmount()
  })

  it('shows error toast when reembedImages API call fails', async () => {
    const apiClient = createApiClient({
      reembedImages: vi.fn().mockRejectedValue({
        response: { data: { error: 'Server error' } },
      }),
    })
    const toast = createToast()

    const { settings, wrapper } = mountImageSettings({ apiClient, toast })
    await flushPromises()

    await settings.reembedImages()

    expect(toast.error).toHaveBeenCalledWith('Server error')
    expect(settings.reembeddingImages.value).toBe(false)

    wrapper.unmount()
  })

  it('preserves local api key when switching to separate_local mode', async () => {
    const apiClient = createApiClient()
    const toast = createToast()

    const { settings, wrapper } = mountImageSettings({ apiClient, toast })
    await flushPromises()

    settings.config.value.image_local_api_key = 'secret-key'
    settings.config.value.image_mode = 'separate_local'
    await settings.onImageModeChange()
    await flushPromises()

    expect(settings.config.value.image_local_api_key).toBe('secret-key')
    expect(apiClient.updateAIConfig).toHaveBeenCalledWith(expect.objectContaining({
      image_embedding_provider_mode: 'separate_local',
      image_embedding_local_api_key: 'secret-key',
    }), AI_SETTINGS_WRITE_PRECONDITION)

    wrapper.unmount()
  })
})
