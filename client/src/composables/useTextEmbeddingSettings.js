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

import { onMounted, ref, watch } from 'vue'

import { useTextEmbeddingModelCatalog } from '@/composables/useTextEmbeddingModelCatalog'
import {
  defaultBackfillModeStatus,
  normalizeBackfillModeStatus
} from '@/utils/backfillStatusUi'
import {
  buildTextConnectionRequest,
  buildTextEmbeddingPayload,
  getSelectedTextModelName,
  getTextProviderLabel,
  isTextProviderConfigured,
  normalizeTextEmbeddingConfig
} from '@/utils/ragTextEmbeddingsUi'
import { normalizeTextEmbeddingStatus } from '@/utils/ragStatusUi'

export function useTextEmbeddingSettings({ apiClient, toast }) {
  const config = ref({
    primary_provider: 'none',
    mode: 'same',
    embedding_model: 'nomic-embed-text',
    ollama_host: '',
    ollama_port: 11434,
    ollama_model: 'nomic-embed-text',
    cloud_provider: '',
    cloud_api_key: '',
    cloud_model: ''
  })

  const originalConfig = ref({})
  const status = ref({
    providerOnline: false,
    providerConfigured: false,
    providerLabel: 'unknown',
    modelLabel: 'unknown',
    mode: 'same'
  })
  const backfillStatus = ref({
    idle: defaultBackfillModeStatus('idle'),
    scheduled: defaultBackfillModeStatus('scheduled')
  })

  const saving = ref(false)
  const testing = ref(false)
  const testResult = ref(null)

  const textModelCatalog = useTextEmbeddingModelCatalog({
    config,
    apiClient,
    toast,
  })

  const loadConfig = async () => {
    try {
      const configRes = await apiClient.getAIConfig()
      config.value = normalizeTextEmbeddingConfig(configRes.data || {})

      originalConfig.value = { ...config.value }
      textModelCatalog.seedConfiguredCloudModel()
    } catch (error) {
      console.error('Failed to load text embedding config:', error)
    }
  }

  const loadStatus = async () => {
    try {
      const statusRes = await apiClient.getRagStatus()
      const data = statusRes.data || {}

      status.value = normalizeTextEmbeddingStatus({
        statusData: data,
        providerConfigured: isTextProviderConfigured(config.value),
        providerLabel: getTextProviderLabel(config.value),
        modelLabel: getSelectedTextModelName(config.value) || 'unknown',
        mode: config.value.mode,
      })
    } catch (error) {
      console.error('Failed to load text embedding status:', error)
    }
  }

  const loadBackfillStatus = async () => {
    try {
      const response = await apiClient.getBackfillStatus()
      backfillStatus.value = {
        idle: normalizeBackfillModeStatus('idle', response.data?.idle),
        scheduled: normalizeBackfillModeStatus('scheduled', response.data?.scheduled)
      }
    } catch (error) {
      console.error('Failed to load backfill status:', error)
    }
  }

  const saveConfig = async () => {
    saving.value = true

    try {
      await apiClient.updateAIConfig(buildTextEmbeddingPayload(config.value))
      toast.success('Text embedding configuration saved successfully')
      originalConfig.value = { ...config.value }
      await loadStatus()
    } catch (error) {
      console.error('Failed to save text embedding config:', error)
      toast.error(error.response?.data?.error || 'Failed to save configuration')
    } finally {
      saving.value = false
    }
  }

  const onModeChange = async () => {
    testResult.value = null
    if (config.value.mode !== 'cloud') {
      textModelCatalog.clearCloudSelection()
    } else if (originalConfig.value.mode !== 'cloud') {
      textModelCatalog.resetCloudProviderState()
    }
    await saveConfig()
  }

  const onCloudProviderChange = () => {
    textModelCatalog.resetCloudProviderState()
    testResult.value = null
  }

  const testConnection = async () => {
    testing.value = true
    testResult.value = null

    try {
      const response = await apiClient.testRagConnection(buildTextConnectionRequest(config.value))

      if (response.data.success) {
        testResult.value = {
          success: true,
          dims: response.data.dims,
          message: `Connected successfully (${response.data.latency}ms)`
        }
        toast.success(`Connected successfully (${response.data.dims} dimensions, ${response.data.latency}ms)`)
      } else {
        testResult.value = { success: false, error: response.data.error || 'Connection failed' }
        toast.error(response.data.error || 'Connection failed')
      }
    } catch (error) {
      testResult.value = {
        success: false,
        error: error.response?.data?.error || error.message
      }
      toast.error(error.response?.data?.error || error.message)
    } finally {
      testing.value = false
    }
  }

  onMounted(async () => {
    await loadConfig()
    await textModelCatalog.loadRecommendedModels()
    await loadStatus()
    await loadBackfillStatus()
  })

  watch(
    () => [config.value.mode, config.value.primary_provider, config.value.cloud_provider].join('|'),
    async () => {
      await textModelCatalog.loadRecommendedModels()
    }
  )

  return {
    config,
    originalConfig,
    status,
    backfillStatus,
    saving,
    testing,
    testResult,
    cloudModels: textModelCatalog.cloudModels,
    loadingCloudModels: textModelCatalog.loadingCloudModels,
    lastModelsFetchAt: textModelCatalog.lastModelsFetchAt,
    recommendedModels: textModelCatalog.recommendedModels,
    fetchCloudModels: textModelCatalog.fetchCloudModels,
    onModeChange,
    onCloudProviderChange,
    testConnection,
    saveConfig,
  }
}
