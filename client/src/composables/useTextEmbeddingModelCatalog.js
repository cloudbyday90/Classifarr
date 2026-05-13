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

import { ref } from 'vue'

import {
  buildTextModelRequest,
  mergeConfiguredTextModels,
  toRecommendedTextModelOption,
} from '@/utils/ragTextEmbeddingsUi'

export function useTextEmbeddingModelCatalog({ config, apiClient, toast }) {
  const cloudModels = ref([])
  const loadingCloudModels = ref(false)
  const lastModelsFetchAt = ref(null)
  const recommendedModels = ref([])

  const clearCloudModels = () => {
    cloudModels.value = []
    lastModelsFetchAt.value = null
  }

  const seedConfiguredCloudModel = () => {
    if (config.value.cloud_model) {
      cloudModels.value = [{ id: config.value.cloud_model, name: config.value.cloud_model }]
    }
  }

  const clearCloudSelection = () => {
    config.value.cloud_provider = ''
    config.value.cloud_api_key = ''
    config.value.cloud_model = ''
    clearCloudModels()
  }

  const resetCloudProviderState = () => {
    config.value.cloud_api_key = ''
    config.value.cloud_model = ''
    clearCloudModels()
  }

  const loadRecommendedModels = async () => {
    try {
      const response = await apiClient.getRagTextModels(buildTextModelRequest(config.value))
      const providerModels = response.data?.recommended || []
      recommendedModels.value = mergeConfiguredTextModels(
        providerModels
          .map(toRecommendedTextModelOption)
          .filter((model) => model.id),
        config.value
      )
    } catch (error) {
      console.error('Failed to load recommended embedding models:', error)
      recommendedModels.value = mergeConfiguredTextModels([], config.value)
    }
  }

  const fetchCloudModels = async () => {
    if (!config.value.cloud_provider) {
      toast.warning('Select a cloud provider first')
      return
    }

    loadingCloudModels.value = true
    try {
      const response = await apiClient.getRagTextModels(buildTextModelRequest(config.value, { mode: 'cloud' }))

      const models = response.data?.models || []
      recommendedModels.value = mergeConfiguredTextModels(
        (response.data?.recommended || [])
          .map(toRecommendedTextModelOption)
          .filter((model) => model.id),
        config.value
      )
      if (config.value.cloud_model && !models.find((model) => model.id === config.value.cloud_model)) {
        models.unshift({ id: config.value.cloud_model, name: config.value.cloud_model })
      }

      cloudModels.value = models
      lastModelsFetchAt.value = new Date()

      if (models.length > 0) {
        toast.success(`Found ${models.length} models`)
      } else {
        toast.warning('No models found')
      }
    } catch (error) {
      console.error('Failed to fetch embedding models:', error)
      toast.error(error.response?.data?.error || 'Failed to fetch models')
    } finally {
      loadingCloudModels.value = false
    }
  }

  return {
    cloudModels,
    loadingCloudModels,
    lastModelsFetchAt,
    recommendedModels,
    clearCloudSelection,
    fetchCloudModels,
    loadRecommendedModels,
    resetCloudProviderState,
    seedConfiguredCloudModel,
  }
}
