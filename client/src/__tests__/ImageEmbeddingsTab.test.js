/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ImageEmbeddingsTab from '@/views/rag/ImageEmbeddingsTab.vue'
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
    getImageModelMetadata: vi.fn(),
    updateAIConfig: vi.fn(),
    testImageEmbeddingConnection: vi.fn(),
    reembedImages: vi.fn()
  }
}))

vi.mock('@/stores/toast', () => ({
  useToast: () => toast
}))

const baseConfig = {
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
  image_embedding_cache_max_mb: 1024
}

function mockMountApis(overrides = {}) {
  api.getAIConfig.mockResolvedValue({
    ...baseConfig,
    ...(overrides.config || {})
  })

  api.getRagStatus.mockResolvedValue({
    image: {
      enabled: true,
      providerOnline: false,
      providerConfigured: true,
      status: 'configured',
      provider: 'local',
      model: 'ViT-B-16',
      ...(overrides.imageStatus || {})
    }
  })

  api.getBackfillStatus.mockResolvedValue({
    idle: { enabled: true, presentation: { statusLabel: 'On' } },
    scheduled: { enabled: false, presentation: { statusLabel: 'Off' } },
    ...(overrides.backfillStatus || {})
  })

  api.getImageModelMetadata.mockResolvedValue({
    data: {
      models: [{ id: 'ViT-B-16', name: 'ViT-B-16', dims: 512 }],
      fetchedAt: new Date().toISOString(),
      cacheHit: true,
      ...(overrides.modelMetadata || {})
    }
  })

  api.updateAIConfig.mockResolvedValue({ data: { success: true } })
  api.testImageEmbeddingConnection.mockResolvedValue({ data: { success: true, dims: 512 } })
  api.reembedImages.mockResolvedValue({ data: { cleared: 12 } })
}

function mountTab() {
  return mount(ImageEmbeddingsTab)
}

describe('ImageEmbeddingsTab.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    localStorage.clear()
    global.confirm = vi.fn(() => true)
    mockMountApis()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('renders the configured status label and hardens the local API key field', async () => {
    mockMountApis({
      config: { image_embedding_local_api_key: '' }
    })

    const wrapper = mountTab()
    await flushPromises()

    expect(wrapper.text()).toContain('Ready (Configured)')

    const apiKeyInput = wrapper.find('input[placeholder="Leave blank if your sidecar has no auth"]')
    expect(apiKeyInput.attributes('autocomplete')).toBe('off')
    expect(apiKeyInput.attributes('data-1p-ignore')).toBe('true')
    expect(apiKeyInput.attributes('data-lpignore')).toBe('true')
    expect(apiKeyInput.attributes('spellcheck')).toBe('false')

    wrapper.unmount()
  })

  it('fetches local models with the configured sidecar API key', async () => {
    api.getImageModelMetadata
      .mockResolvedValueOnce({
        data: {
          models: [{ id: 'ViT-B-16', name: 'ViT-B-16', dims: 512 }],
          fetchedAt: new Date().toISOString(),
          cacheHit: false
        }
      })
      .mockResolvedValueOnce({
        data: {
          models: [{ id: 'ViT-L-14', name: 'ViT-L-14', dims: 768 }],
          fetchedAt: new Date().toISOString(),
          cacheHit: false
        }
      })

    const wrapper = mountTab()
    await flushPromises()

    const fetchButton = wrapper.findAll('button').find((button) => button.text().includes('Fetch Models'))
    await fetchButton.trigger('click')
    await flushPromises()

    expect(api.getImageModelMetadata).toHaveBeenLastCalledWith({
      mode: 'separate_local',
      local_host: 'image-embedder',
      local_port: 8000,
      local_api_key: 'local-key',
      refresh: true
    })
    expect(toast.success).toHaveBeenCalledWith('Found 1 models')

    wrapper.unmount()
  })

  it('tests the connection and persists config on success', async () => {
    const wrapper = mountTab()
    await flushPromises()

    const testButton = wrapper.findAll('button').find((button) => button.text().includes('Test Connection'))
    await testButton.trigger('click')
    await flushPromises()

    expect(api.testImageEmbeddingConnection).toHaveBeenCalledWith({
      mode: 'separate_local',
      local_host: 'image-embedder',
      local_port: 8000,
      local_model: 'ViT-B-16',
      local_api_key: 'local-key',
      cloud_provider: '',
      cloud_api_key: '',
      cloud_model: '',
      cloud_api_endpoint: '',
      image_size: 512
    })
    expect(api.updateAIConfig).toHaveBeenCalledWith(expect.objectContaining({
      image_embedding_provider_mode: 'separate_local',
      image_embedding_local_api_key: 'local-key',
      image_embedding_local_timeout_ms: 15000
    }))
    expect(toast.success).toHaveBeenCalledWith('Image embedding configuration looks good')

    wrapper.unmount()
  })

  it('clears stale hidden cloud and local secrets when saving disabled mode', async () => {
    mockMountApis({
      config: {
        image_embedding_provider_mode: 'disabled',
        image_embedding_local_api_key: 'masked-local-key',
        image_embedding_cloud_provider: 'voyage',
        image_embedding_cloud_api_key: 'masked-cloud-key',
        image_embedding_cloud_model: 'voyage-multimodal-3'
      },
      imageStatus: {
        enabled: false,
        status: 'disabled'
      }
    })

    const wrapper = mountTab()
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save Configuration'))
    await saveButton.trigger('click')
    await flushPromises()

    expect(api.updateAIConfig).toHaveBeenCalledWith(expect.objectContaining({
      image_embedding_provider_mode: 'disabled',
      image_embedding_local_api_key: '',
      image_embedding_cloud_provider: '',
      image_embedding_cloud_api_key: '',
      image_embedding_cloud_model: '',
      image_embedding_cloud_api_endpoint: ''
    }))

    wrapper.unmount()
  })

  it('clears cloud key and model when the image cloud provider changes', async () => {
    mockMountApis({
      config: {
        image_embedding_provider_mode: 'cloud',
        image_embedding_cloud_provider: 'voyage',
        image_embedding_cloud_api_key: 'cloud-key',
        image_embedding_cloud_model: 'voyage-multimodal-3',
        image_embedding_cloud_api_endpoint: 'https://example.test/models'
      },
      imageStatus: {
        provider: 'voyage',
        model: 'voyage-multimodal-3'
      }
    })

    const wrapper = mountTab()
    await flushPromises()

    const providerSelect = wrapper.findAll('select')[1]
    await providerSelect.setValue('cohere')
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save Configuration'))
    await saveButton.trigger('click')
    await flushPromises()

    expect(api.updateAIConfig).toHaveBeenCalledWith(expect.objectContaining({
      image_embedding_provider_mode: 'cloud',
      image_embedding_cloud_provider: 'cohere',
      image_embedding_cloud_api_key: '',
      image_embedding_cloud_model: '',
      image_embedding_cloud_api_endpoint: 'https://example.test/models',
      image_embedding_local_api_key: ''
    }))

    wrapper.unmount()
  })

  it('re-embeds images after confirmation', async () => {
    const wrapper = mountTab()
    await flushPromises()

    const reembedButton = wrapper.findAll('button').find((button) => button.text().includes('Re-embed Images'))
    await reembedButton.trigger('click')
    await flushPromises()

    expect(global.confirm).toHaveBeenCalledTimes(1)
    expect(api.reembedImages).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Cleared 12 image embeddings')

    wrapper.unmount()
  })
})
