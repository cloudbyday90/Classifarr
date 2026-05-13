/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { computed, ref } from 'vue'

import {
  buildImageModelRequest,
  getCloudImageModelsCacheKey,
  getLocalImageModelsCacheKey,
  isImageModelsCacheStale,
  readImageModelsCache,
  writeImageModelsCache,
} from '@/utils/ragImageEmbeddingsUi'

function getBrowserStorage() {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function useImageEmbeddingModelCatalog({
  config,
  imageDisabled,
  canFetchImageModels,
  apiClient,
  toast,
  cacheTtlMs = 15 * 60 * 1000,
  storage = getBrowserStorage(),
}) {
  const imageCloudModels = ref([])
  const imageLocalModels = ref([])
  const loadingImageCloudModels = ref(false)
  const loadingImageLocalModels = ref(false)
  const lastModelsFetchAt = ref(null)
  const refreshPending = ref(false)
  const modelsCacheSource = ref(null)

  const loadingImageModels = computed(() => loadingImageCloudModels.value || loadingImageLocalModels.value)

  const resetImageModelFetchState = () => {
    imageCloudModels.value = []
    imageLocalModels.value = []
    lastModelsFetchAt.value = null
    modelsCacheSource.value = null
  }

  const fetchImageCloudModels = async ({ silent = false } = {}) => {
    if (!config.value.image_cloud_provider) {
      if (!silent) {
        toast?.warning?.('Select a cloud provider first')
      }
      return
    }

    loadingImageCloudModels.value = true
    try {
      const response = await apiClient.getImageModelMetadata(buildImageModelRequest(config.value, { refresh: true }))
      const models = response.data?.models || []

      if (config.value.image_cloud_model && !models.find((model) => model.id === config.value.image_cloud_model)) {
        models.unshift({ id: config.value.image_cloud_model, name: config.value.image_cloud_model })
      }

      imageCloudModels.value = models
      lastModelsFetchAt.value = new Date()
      writeImageModelsCache(storage, getCloudImageModelsCacheKey(config.value), models)
      modelsCacheSource.value = 'live'

      if (!silent) {
        if (models.length > 0) {
          toast?.success?.(`Found ${models.length} models`)
        } else {
          toast?.warning?.('No models found')
        }
      }
    } catch (error) {
      console.error('Failed to fetch image embedding models:', error)
      if (!silent) {
        toast?.error?.(error.response?.data?.error || 'Failed to fetch models')
      }
    } finally {
      loadingImageCloudModels.value = false
    }
  }

  const fetchImageLocalModels = async ({ silent = false } = {}) => {
    const host = (config.value.image_local_host || '').trim()
    if (!host) {
      if (!silent) {
        toast?.warning?.('Set a local host to fetch models')
      }
      return
    }

    loadingImageLocalModels.value = true
    try {
      const response = await apiClient.getImageModelMetadata(buildImageModelRequest(config.value, { refresh: true }))
      const models = response.data?.models || []

      imageLocalModels.value = models
      lastModelsFetchAt.value = new Date()
      writeImageModelsCache(storage, getLocalImageModelsCacheKey(config.value), models)
      modelsCacheSource.value = 'live'

      if (!silent) {
        if (models.length > 0) {
          toast?.success?.(`Found ${models.length} models`)
        } else {
          toast?.warning?.('No models found')
        }
      }
    } catch (error) {
      console.error('Failed to fetch local image embedding models:', error)
      if (!silent) {
        toast?.error?.(error.response?.data?.error || 'Failed to fetch local models')
      }
    } finally {
      loadingImageLocalModels.value = false
    }
  }

  const fetchImageModels = async ({ silent = false } = {}) => {
    if (imageDisabled.value) {
      if (!silent) {
        toast?.info?.('Image embeddings are disabled')
      }
      return
    }
    if (config.value.image_mode === 'cloud') {
      await fetchImageCloudModels({ silent })
      return
    }

    await fetchImageLocalModels({ silent })
  }

  const scheduleIdleRefresh = (fetchedAt) => {
    if (refreshPending.value) return
    if (!canFetchImageModels.value) return
    if (!isImageModelsCacheStale(fetchedAt, cacheTtlMs)) return

    refreshPending.value = true
    const run = async () => {
      refreshPending.value = false
      await fetchImageModels({ silent: true })
    }

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 2000 })
    } else {
      setTimeout(run, 1500)
    }
  }

  const hydrateCachedModels = () => {
    if (imageDisabled.value) {
      resetImageModelFetchState()
      return
    }

    modelsCacheSource.value = null

    if (config.value.image_mode === 'cloud') {
      const cache = readImageModelsCache(storage, getCloudImageModelsCacheKey(config.value))
      if (cache) {
        imageCloudModels.value = cache.models
        lastModelsFetchAt.value = cache.fetchedAt
        modelsCacheSource.value = 'browser'
      }
      scheduleIdleRefresh(cache?.fetchedAt)
      return
    }

    const cache = readImageModelsCache(storage, getLocalImageModelsCacheKey(config.value))
    if (cache) {
      imageLocalModels.value = cache.models
      lastModelsFetchAt.value = cache.fetchedAt
      modelsCacheSource.value = 'browser'
    }
    scheduleIdleRefresh(cache?.fetchedAt)
  }

  const loadServerModelsCache = async () => {
    if (imageDisabled.value) return
    try {
      const response = await apiClient.getImageModelMetadata(buildImageModelRequest(config.value, { refresh: false }))
      const models = response.data?.models || []
      const fetchedAt = response.data?.fetchedAt || null
      const cacheHit = response.data?.cacheHit === true

      if (config.value.image_mode === 'cloud') {
        if (cacheHit && models.length > 0) {
          imageCloudModels.value = models
          lastModelsFetchAt.value = fetchedAt
          writeImageModelsCache(storage, getCloudImageModelsCacheKey(config.value), models)
          modelsCacheSource.value = 'server'
        } else if (cacheHit && fetchedAt) {
          lastModelsFetchAt.value = fetchedAt
          modelsCacheSource.value = 'server'
        }
        return
      }

      if (cacheHit && models.length > 0) {
        imageLocalModels.value = models
        lastModelsFetchAt.value = fetchedAt
        writeImageModelsCache(storage, getLocalImageModelsCacheKey(config.value), models)
        modelsCacheSource.value = 'server'
      } else if (cacheHit && fetchedAt) {
        lastModelsFetchAt.value = fetchedAt
        modelsCacheSource.value = 'server'
      }
    } catch {
      // Best-effort cache warm; ignore failures
    }
  }

  return {
    imageCloudModels,
    imageLocalModels,
    loadingImageCloudModels,
    loadingImageLocalModels,
    loadingImageModels,
    lastModelsFetchAt,
    modelsCacheSource,
    fetchImageCloudModels,
    fetchImageLocalModels,
    fetchImageModels,
    hydrateCachedModels,
    loadServerModelsCache,
    resetImageModelFetchState,
  }
}
