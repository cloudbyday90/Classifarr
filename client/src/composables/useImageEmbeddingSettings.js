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

import { computed, onMounted, ref, watch } from 'vue'

import { useImageEmbeddingModelCatalog } from '@/composables/useImageEmbeddingModelCatalog'
import {
  defaultBackfillModeStatus,
  normalizeBackfillModeStatus
} from '@/utils/backfillStatusUi'
import {
  buildImageEmbeddingConnectionRequest,
  buildImageEmbeddingPayload,
  normalizeImageEmbeddingConfig
} from '@/utils/ragImageEmbeddingsUi'
import { normalizeRagImageRuntime } from '@/utils/ragStatusUi'
import {
  AI_SETTINGS_STALE_WRITE_RECOVERY_MESSAGE,
  getAiSettingsWritePreconditionFromResponse,
  isAiSettingsStaleWriteError,
} from '@/api/aiSettingsWritePrecondition'

export function useImageEmbeddingSettings({ apiClient, toast }) {
  const config = ref({
    image_mode: 'disabled',
    image_local_host: '',
    image_local_port: 8000,
    image_local_model: 'ViT-B-16',
    image_cloud_provider: '',
    image_cloud_api_key: '',
    image_cloud_model: '',
    image_cloud_api_endpoint: '',
    image_size: 512,
    image_rps: 2,
    image_concurrency: 2,
    image_batch_size: 1,
    image_cache_ttl_hours: 24,
    image_cache_max_mb: 1024,
    image_local_api_key: '',
    image_local_timeout_ms: 15000
  })

  const originalConfig = ref({})
  const aiSettingsWritePrecondition = ref(null)
  const status = ref({
    enabled: false,
    providerOnline: false,
    providerConfigured: false,
    state: 'disabled',
    providerLabel: 'unknown',
    modelLabel: 'unknown',
    mode: 'disabled'
  })
  const backfillStatus = ref({
    idle: defaultBackfillModeStatus('idle'),
    scheduled: defaultBackfillModeStatus('scheduled')
  })

  const saving = ref(false)
  const testing = ref(false)
  const reembeddingImages = ref(false)
  const imageDisabled = computed(() => config.value.image_mode === 'disabled')

  const canFetchImageModels = computed(() => {
    if (imageDisabled.value) {
      return false
    }
    if (config.value.image_mode === 'cloud') {
      return !!config.value.image_cloud_provider
    }
    return !!config.value.image_local_host
  })

  const imageModelCatalog = useImageEmbeddingModelCatalog({
    config,
    imageDisabled,
    canFetchImageModels,
    apiClient,
    toast
  })

  const loadConfig = async () => {
    try {
      const response = await apiClient.getAIConfigForUpdate()
      const configRes = response?.config || {}
      aiSettingsWritePrecondition.value = response?.writePrecondition || null
      config.value = normalizeImageEmbeddingConfig(configRes)

      originalConfig.value = { ...config.value }

      if (config.value.image_cloud_model) {
        imageModelCatalog.imageCloudModels.value = [{ id: config.value.image_cloud_model, name: config.value.image_cloud_model }]
      }
    } catch (error) {
      console.error('Failed to load image embedding config:', error)
    }
  }

  const loadStatus = async () => {
    try {
      const statusRes = await apiClient.getRagStatus()
      const imageStatus = normalizeRagImageRuntime(statusRes?.image)

      status.value = {
        enabled: imageStatus.enabled,
        providerOnline: imageStatus.providerOnline,
        providerConfigured: imageStatus.providerConfigured,
        state: imageStatus.state,
        providerLabel: imageStatus.provider,
        modelLabel: imageStatus.model || 'unknown',
        mode: config.value.image_mode
      }
    } catch (error) {
      console.error('Failed to load image embedding status:', error)
    }
  }

  const loadBackfillStatus = async () => {
    try {
      const response = await apiClient.getBackfillStatus()
      backfillStatus.value = {
        idle: normalizeBackfillModeStatus('idle', response?.idle),
        scheduled: normalizeBackfillModeStatus('scheduled', response?.scheduled)
      }
    } catch (error) {
      console.error('Failed to load backfill status:', error)
    }
  }

  const clearImageCloudSelection = () => {
    config.value.image_cloud_provider = ''
    config.value.image_cloud_api_key = ''
    config.value.image_cloud_model = ''
    config.value.image_cloud_api_endpoint = ''
    imageModelCatalog.imageCloudModels.value = []
  }

  const clearImageLocalSecret = () => {
    config.value.image_local_api_key = ''
  }

  const saveConfig = async ({ silent = false } = {}) => {
    saving.value = true

    try {
      const response = await apiClient.updateAIConfig(
        buildImageEmbeddingPayload(config.value),
        aiSettingsWritePrecondition.value,
      )
      aiSettingsWritePrecondition.value = getAiSettingsWritePreconditionFromResponse(response)
      if (!silent) {
        toast.success('Image embedding configuration saved successfully')
      }
      originalConfig.value = { ...config.value }
      await loadStatus()
      return true
    } catch (error) {
      console.error('Failed to save image embedding config:', error)
      if (isAiSettingsStaleWriteError(error)) {
        await loadConfig()
        if (!silent) {
          toast.warning(AI_SETTINGS_STALE_WRITE_RECOVERY_MESSAGE)
        }
        return false
      }
      if (!silent) {
        toast.error(error.response?.data?.error || 'Failed to save configuration')
      }
      return false
    } finally {
      saving.value = false
    }
  }

  const onImageModeChange = async () => {
    if (config.value.image_mode !== 'cloud') {
      clearImageCloudSelection()
    } else if (originalConfig.value.image_mode !== 'cloud') {
      config.value.image_cloud_api_key = ''
      config.value.image_cloud_model = ''
      config.value.image_cloud_api_endpoint = ''
      imageModelCatalog.imageCloudModels.value = []
    }

    if (config.value.image_mode !== 'separate_local') {
      clearImageLocalSecret()
    }

    imageModelCatalog.resetImageModelFetchState()
    imageModelCatalog.hydrateCachedModels()
    await imageModelCatalog.loadServerModelsCache()
    await saveConfig()
  }

  const onImageCloudProviderChange = () => {
    config.value.image_cloud_api_key = ''
    config.value.image_cloud_model = ''
    imageModelCatalog.resetImageModelFetchState()
  }

  const testImageConnection = async () => {
    if (imageDisabled.value) {
      toast.info('Image embeddings are disabled')
      return
    }
    testing.value = true
    try {
      const response = await apiClient.testImageEmbeddingConnection(buildImageEmbeddingConnectionRequest(config.value))

      if (response.data?.success) {
        const saved = await saveConfig({ silent: true })
        if (saved) {
          toast.success('Image embedding configuration looks good')
        }
      } else {
        toast.warning(response.data?.error || 'Image embedding provider not fully configured')
      }
    } catch (error) {
      toast.error(error.response?.data?.error || error.message)
    } finally {
      testing.value = false
    }
  }

  const reembedImages = async () => {
    if (imageDisabled.value) {
      toast.info('Image embeddings are disabled')
      return
    }
    if (!confirm('Re-embed all images? This will clear stored image embeddings and backfill will regenerate them.')) {
      return
    }

    reembeddingImages.value = true
    try {
      const response = await apiClient.reembedImages()
      toast.success(`Cleared ${response.data?.cleared ?? 0} image embeddings`)
    } catch (error) {
      console.error('Failed to re-embed images:', error)
      toast.error(error.response?.data?.error || 'Failed to re-embed images')
    } finally {
      reembeddingImages.value = false
    }
  }

  onMounted(async () => {
    await loadConfig()
    await loadStatus()
    await loadBackfillStatus()
    imageModelCatalog.hydrateCachedModels()
    await imageModelCatalog.loadServerModelsCache()
  })

  watch(
    () => [
      config.value.image_mode,
      config.value.image_local_host,
      config.value.image_local_port,
      config.value.image_cloud_provider,
      config.value.image_cloud_api_endpoint
    ],
    () => {
      imageModelCatalog.hydrateCachedModels()
      imageModelCatalog.loadServerModelsCache()
    }
  )

  return {
    config,
    originalConfig,
    status,
    backfillStatus,
    saving,
    testing,
    reembeddingImages,
    imageDisabled,
    canFetchImageModels,
    loadStatus,
    saveConfig,
    onImageModeChange,
    onImageCloudProviderChange,
    testImageConnection,
    reembedImages,
    ...imageModelCatalog,
  }
}
