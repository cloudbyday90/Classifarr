/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useTextEmbeddingModelCatalog } from '@/composables/useTextEmbeddingModelCatalog'

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
    mode: 'cloud',
    embedding_model: 'text-embedding-3-small',
    ollama_model: 'nomic-embed-text',
    cloud_provider: 'openai',
    cloud_api_key: 'cloud-key',
    cloud_model: 'text-embedding-3-large',
    ...overrides,
  })
}

function createApiClient(overrides = {}) {
  return {
    getRagTextModels: vi.fn().mockResolvedValue({
      data: {
        models: [{ id: 'text-embedding-3-large', name: 'text-embedding-3-large' }],
        recommended: [{ id: 'text-embedding-3-large', description: 'OpenAI large', dims: 3072 }],
      },
    }),
    ...overrides,
  }
}

describe('useTextEmbeddingModelCatalog composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads recommended models for the current text mode', async () => {
    const config = createConfig({ mode: 'separate_ollama', cloud_provider: '', cloud_api_key: '' })
    const apiClient = createApiClient({
      getRagTextModels: vi.fn().mockResolvedValue({
        data: {
          recommended: [{ id: 'nomic-embed-text', description: 'Ollama local', dims: 768 }],
        },
      }),
    })
    const toast = createToast()

    const catalog = useTextEmbeddingModelCatalog({ config, apiClient, toast })
    await catalog.loadRecommendedModels()

    expect(apiClient.getRagTextModels).toHaveBeenCalledWith({
      mode: 'separate_ollama',
      provider: undefined,
      api_key: undefined,
    })
    expect(catalog.recommendedModels.value).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'nomic-embed-text', dims: 768 }),
      expect.objectContaining({ id: 'text-embedding-3-small', description: 'Configured model' }),
    ]))
  })

  it('fetches cloud models and preserves the configured selection', async () => {
    const config = createConfig()
    const apiClient = createApiClient()
    const toast = createToast()

    const catalog = useTextEmbeddingModelCatalog({ config, apiClient, toast })
    await catalog.fetchCloudModels()

    expect(apiClient.getRagTextModels).toHaveBeenCalledWith({
      mode: 'cloud',
      provider: 'openai',
      api_key: 'cloud-key',
    })
    expect(catalog.cloudModels.value).toEqual([{ id: 'text-embedding-3-large', name: 'text-embedding-3-large' }])
    expect(catalog.lastModelsFetchAt.value).toBeInstanceOf(Date)
    expect(toast.success).toHaveBeenCalledWith('Found 1 models')
  })

  it('clears cloud selections and can seed the configured cloud model', () => {
    const config = createConfig()
    const apiClient = createApiClient()
    const toast = createToast()

    const catalog = useTextEmbeddingModelCatalog({ config, apiClient, toast })
    catalog.seedConfiguredCloudModel()

    expect(catalog.cloudModels.value).toEqual([{ id: 'text-embedding-3-large', name: 'text-embedding-3-large' }])

    catalog.clearCloudSelection()

    expect(config.value.cloud_provider).toBe('')
    expect(config.value.cloud_api_key).toBe('')
    expect(config.value.cloud_model).toBe('')
    expect(catalog.cloudModels.value).toEqual([])
    expect(catalog.lastModelsFetchAt.value).toBeNull()
  })
})
