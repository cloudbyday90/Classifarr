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

function createApiClient(overrides = {}) {
  return {
    getAIConfig: vi.fn().mockResolvedValue({
      data: {
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
      },
    }),
    getRagStatus: vi.fn().mockResolvedValue({
      data: {
        image: {
          enabled: true,
          providerOnline: false,
          providerConfigured: true,
          status: 'configured',
          provider: 'local',
          model: 'ViT-B-16',
        },
      },
    }),
    getBackfillStatus: vi.fn().mockResolvedValue({
      data: {
        idle: { enabled: true, presentation: { statusLabel: 'On' } },
        scheduled: { enabled: false, presentation: { statusLabel: 'Off' } },
      },
    }),
    getImageModelMetadata: vi.fn().mockResolvedValue({
      data: {
        models: [{ id: 'ViT-B-16', name: 'ViT-B-16', dims: 512 }],
        fetchedAt: '2026-05-11T12:00:00.000Z',
        cacheHit: true,
      },
    }),
    updateAIConfig: vi.fn().mockResolvedValue({ data: { success: true } }),
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

    expect(apiClient.getAIConfig).toHaveBeenCalledTimes(1)
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
    }))

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
    }))
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
})
