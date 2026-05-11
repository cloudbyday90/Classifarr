/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import { useImageEmbeddingModelCatalog } from '@/composables/useImageEmbeddingModelCatalog'

function createToast() {
  return {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }
}

function createConfig(overrides = {}) {
  return ref({
    image_mode: 'cloud',
    image_local_host: 'image-embedder',
    image_local_port: 8000,
    image_local_api_key: 'local-key',
    image_cloud_provider: 'voyage',
    image_cloud_api_key: 'cloud-key',
    image_cloud_model: 'voyage-multimodal-3',
    image_cloud_api_endpoint: 'https://example.test/models',
    ...overrides,
  })
}

function createStorage() {
  const entries = new Map()
  return {
    getItem: vi.fn((key) => entries.get(key) ?? null),
    setItem: vi.fn((key, value) => entries.set(key, value)),
  }
}

function createApiClient(overrides = {}) {
  return {
    getImageModelMetadata: vi.fn().mockResolvedValue({
      data: {
        models: [{ id: 'voyage-multimodal-3', name: 'Voyage Multimodal 3', dims: 1024 }],
        fetchedAt: '2026-05-11T12:00:00.000Z',
        cacheHit: true,
      },
    }),
    ...overrides,
  }
}

describe('useImageEmbeddingModelCatalog composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-11T12:20:00.000Z'))
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('hydrates browser-cached cloud models', () => {
    const config = createConfig()
    const storage = createStorage()
    storage.getItem.mockReturnValue(JSON.stringify({
      models: [{ id: 'voyage-multimodal-3', name: 'Voyage Multimodal 3', dims: 1024 }],
      fetchedAt: '2026-05-11T12:10:00.000Z',
    }))

    const catalog = useImageEmbeddingModelCatalog({
      config,
      imageDisabled: computed(() => false),
      canFetchImageModels: computed(() => true),
      apiClient: createApiClient(),
      toast: createToast(),
      storage,
    })

    catalog.hydrateCachedModels()

    expect(catalog.imageCloudModels.value).toEqual([{ id: 'voyage-multimodal-3', name: 'Voyage Multimodal 3', dims: 1024 }])
    expect(catalog.lastModelsFetchAt.value).toBe('2026-05-11T12:10:00.000Z')
    expect(catalog.modelsCacheSource.value).toBe('browser')
  })

  it('warms local models from the server cache and stores them', async () => {
    const config = createConfig({
      image_mode: 'separate_local',
      image_cloud_provider: '',
      image_cloud_api_key: '',
      image_cloud_model: '',
      image_cloud_api_endpoint: '',
    })
    const storage = createStorage()
    const apiClient = createApiClient({
      getImageModelMetadata: vi.fn().mockResolvedValue({
        data: {
          models: [{ id: 'ViT-B-16', name: 'ViT-B-16', dims: 512 }],
          fetchedAt: '2026-05-11T12:05:00.000Z',
          cacheHit: true,
        },
      }),
    })

    const catalog = useImageEmbeddingModelCatalog({
      config,
      imageDisabled: computed(() => false),
      canFetchImageModels: computed(() => true),
      apiClient,
      toast: createToast(),
      storage,
    })

    await catalog.loadServerModelsCache()

    expect(apiClient.getImageModelMetadata).toHaveBeenCalledWith({
      mode: 'separate_local',
      local_host: 'image-embedder',
      local_port: 8000,
      local_api_key: 'local-key',
      refresh: false,
    })
    expect(catalog.imageLocalModels.value).toEqual([{ id: 'ViT-B-16', name: 'ViT-B-16', dims: 512 }])
    expect(catalog.modelsCacheSource.value).toBe('server')
    expect(storage.setItem).toHaveBeenCalledTimes(1)
  })

  it('fetches live cloud models and preserves the configured selection', async () => {
    const config = createConfig({ image_cloud_model: 'voyage-multimodal-3' })
    const storage = createStorage()
    const toast = createToast()
    const apiClient = createApiClient({
      getImageModelMetadata: vi.fn().mockResolvedValue({
        data: {
          models: [{ id: 'voyage-vision-2', name: 'Voyage Vision 2', dims: 1024 }],
        },
      }),
    })

    const catalog = useImageEmbeddingModelCatalog({
      config,
      imageDisabled: computed(() => false),
      canFetchImageModels: computed(() => true),
      apiClient,
      toast,
      storage,
    })

    await catalog.fetchImageCloudModels()

    expect(catalog.imageCloudModels.value).toEqual([
      { id: 'voyage-multimodal-3', name: 'voyage-multimodal-3' },
      { id: 'voyage-vision-2', name: 'Voyage Vision 2', dims: 1024 },
    ])
    expect(catalog.modelsCacheSource.value).toBe('live')
    expect(toast.success).toHaveBeenCalledWith('Found 2 models')
  })
})
