/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  buildImageEmbeddingConnectionRequest,
  buildImageEmbeddingPayload,
  buildImageModelOptions,
  buildImageModelRequest,
  DEFAULT_IMAGE_MODEL_OPTIONS,
  getCloudImageModelsCacheKey,
  getImageConfigSignature,
  getImageModelDimsLabel,
  getLocalImageModelsCacheKey,
  getOriginalImageConfigSignature,
  getSelectedImageModelName,
  isImageModelsCacheStale,
  normalizeImageEmbeddingConfig,
  readImageModelsCache,
  writeImageModelsCache,
} from '@/utils/ragImageEmbeddingsUi'

describe('ragImageEmbeddingsUi utility helpers', () => {
  it('normalizes server config into the client image embedding shape', () => {
    expect(normalizeImageEmbeddingConfig({
      image_embedding_provider_mode: 'cloud',
      image_embedding_local_host: 'image-embedder',
      image_embedding_local_port: 9000,
      image_embedding_local_model: 'ViT-L-14',
      image_embedding_local_api_key: 'local-key',
      image_embedding_local_timeout_ms: 30000,
      image_embedding_cloud_provider: 'voyage',
      image_embedding_cloud_api_key: 'cloud-key',
      image_embedding_cloud_model: 'voyage-multimodal-3',
      image_embedding_cloud_api_endpoint: 'https://example.test/models',
      image_embedding_image_size: 640,
      image_embedding_rps: 4,
      image_embedding_concurrency: 3,
      image_embedding_batch_size: 2,
      image_embedding_cache_ttl_hours: 12,
      image_embedding_cache_max_mb: 2048,
    })).toEqual({
      image_mode: 'cloud',
      image_local_host: 'image-embedder',
      image_local_port: 9000,
      image_local_model: 'ViT-L-14',
      image_cloud_provider: 'voyage',
      image_cloud_api_key: 'cloud-key',
      image_cloud_model: 'voyage-multimodal-3',
      image_cloud_api_endpoint: 'https://example.test/models',
      image_size: 640,
      image_rps: 4,
      image_concurrency: 3,
      image_batch_size: 2,
      image_cache_ttl_hours: 12,
      image_cache_max_mb: 2048,
      image_local_api_key: 'local-key',
      image_local_timeout_ms: 30000,
    })
  })

  it('builds image connection and model requests for local and cloud modes', () => {
    const cloudConfig = {
      image_mode: 'cloud',
      image_local_host: 'image-embedder',
      image_local_port: 8000,
      image_local_model: 'ViT-B-16',
      image_local_api_key: 'local-key',
      image_cloud_provider: 'voyage',
      image_cloud_api_key: 'cloud-key',
      image_cloud_model: 'voyage-multimodal-3',
      image_cloud_api_endpoint: 'https://example.test/models',
      image_size: 512,
    }

    expect(buildImageEmbeddingConnectionRequest(cloudConfig)).toEqual({
      mode: 'cloud',
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

    expect(buildImageModelRequest(cloudConfig, { refresh: true })).toEqual({
      mode: 'cloud',
      local_host: 'image-embedder',
      local_port: 8000,
      local_api_key: 'local-key',
      cloud_provider: 'voyage',
      cloud_api_key: 'cloud-key',
      cloud_api_endpoint: 'https://example.test/models',
      refresh: true,
    })

    expect(buildImageModelRequest({
      image_mode: 'separate_local',
      image_local_host: 'image-embedder',
      image_local_port: 8000,
      image_local_api_key: 'local-key',
    })).toEqual({
      mode: 'separate_local',
      local_host: 'image-embedder',
      local_port: 8000,
      local_api_key: 'local-key',
      refresh: false,
    })
  })

  it('builds image payloads and config signatures by mode', () => {
    const config = {
      image_mode: 'cloud',
      image_local_host: 'image-embedder',
      image_local_port: 8000,
      image_local_model: 'ViT-B-16',
      image_local_api_key: 'local-key',
      image_local_timeout_ms: 15000,
      image_cloud_provider: 'voyage',
      image_cloud_api_key: 'cloud-key',
      image_cloud_model: 'voyage-multimodal-3',
      image_cloud_api_endpoint: 'https://example.test/models',
      image_size: 512,
      image_rps: 2,
      image_concurrency: 2,
      image_batch_size: 1,
      image_cache_ttl_hours: 24,
      image_cache_max_mb: 1024,
    }

    expect(buildImageEmbeddingPayload(config)).toEqual(expect.objectContaining({
      image_embedding_provider_mode: 'cloud',
      image_embedding_cloud_provider: 'voyage',
      image_embedding_cloud_api_key: 'cloud-key',
      image_embedding_cloud_model: 'voyage-multimodal-3',
      image_embedding_cloud_api_endpoint: 'https://example.test/models',
      image_embedding_local_api_key: '',
    }))

    expect(buildImageEmbeddingPayload({ ...config, image_mode: 'separate_local' })).toEqual(expect.objectContaining({
      image_embedding_provider_mode: 'separate_local',
      image_embedding_local_host: 'image-embedder',
      image_embedding_local_port: 8000,
      image_embedding_local_model: 'ViT-B-16',
      image_embedding_local_api_key: 'local-key',
      image_embedding_local_timeout_ms: 15000,
      image_embedding_cloud_provider: '',
    }))

    expect(getImageConfigSignature(config)).toBe('cloud|voyage|ViT-B-16|voyage-multimodal-3')
    expect(getOriginalImageConfigSignature(config)).toBe('cloud|voyage|ViT-B-16|voyage-multimodal-3')
    expect(getOriginalImageConfigSignature({})).toBe('')
  })

  it('builds model options from live models and preserves the current selection when missing', () => {
    expect(buildImageModelOptions([
      { id: 'ViT-L-14', name: 'ViT-L-14', dims: 768 },
    ], { currentModel: 'ViT-B-16' })).toEqual([
      { name: 'ViT-B-16', description: 'Current selection' },
      { name: 'ViT-L-14', description: 'ViT-L-14', dims: 768 },
    ])
  })

  it('falls back to the default model catalog when no live models exist', () => {
    expect(buildImageModelOptions([], { currentModel: 'ViT-B-16' })).toEqual([
      ...DEFAULT_IMAGE_MODEL_OPTIONS,
    ])
  })

  it('selects the active image model name for local and cloud modes', () => {
    expect(getSelectedImageModelName({ image_mode: 'separate_local', image_local_model: 'ViT-B-16' })).toBe('ViT-B-16')
    expect(getSelectedImageModelName({ image_mode: 'cloud', image_cloud_model: 'voyage-multimodal-3' })).toBe('voyage-multimodal-3')
  })

  it('derives the displayed model dimensions from live or fallback options', () => {
    expect(getImageModelDimsLabel({
      config: { image_mode: 'separate_local', image_local_model: 'ViT-L-14' },
      models: [{ id: 'ViT-L-14', name: 'ViT-L-14', dims: 768 }],
    })).toBe('768')

    expect(getImageModelDimsLabel({
      config: { image_mode: 'separate_local', image_local_model: 'ViT-B-32' },
      models: [],
    })).toBe('512')

    expect(getImageModelDimsLabel({
      config: { image_mode: 'cloud', image_cloud_model: 'unknown' },
      models: [],
    })).toBe('n/a')
  })

  it('builds cache keys and handles browser cache helpers safely', () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    }

    expect(getLocalImageModelsCacheKey({ image_local_host: 'image-embedder', image_local_port: 8000 })).toBe('classifarr:image-models:local:image-embedder:8000')
    expect(getCloudImageModelsCacheKey({ image_cloud_provider: 'voyage', image_cloud_api_endpoint: 'https://example.test/models' })).toBe('classifarr:image-models:cloud:voyage:https://example.test/models')

    storage.getItem.mockReturnValueOnce(JSON.stringify({
      models: [{ id: 'ViT-B-16' }],
      fetchedAt: '2026-05-11T12:00:00.000Z',
    }))
    expect(readImageModelsCache(storage, 'cache-key')).toEqual({
      models: [{ id: 'ViT-B-16' }],
      fetchedAt: '2026-05-11T12:00:00.000Z',
    })

    writeImageModelsCache(storage, 'cache-key', [{ id: 'ViT-B-16' }])
    expect(storage.setItem).toHaveBeenCalledTimes(1)

    expect(isImageModelsCacheStale(new Date(Date.now() - 60 * 60 * 1000).toISOString(), 15 * 60 * 1000)).toBe(true)
    expect(isImageModelsCacheStale(new Date(Date.now() - 5 * 60 * 1000).toISOString(), 15 * 60 * 1000)).toBe(false)
  })
})
