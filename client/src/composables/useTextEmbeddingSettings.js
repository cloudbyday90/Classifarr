import { onMounted, ref, watch } from 'vue'

import {
  defaultBackfillModeStatus,
  normalizeBackfillModeStatus
} from '@/utils/backfillStatusUi'
import {
  buildTextConnectionRequest,
  buildTextEmbeddingPayload,
  buildTextModelRequest,
  getSelectedTextModelName,
  getTextProviderLabel,
  isTextProviderConfigured,
  mergeConfiguredTextModels,
  normalizeTextEmbeddingConfig,
  toRecommendedTextModelOption
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
  const cloudModels = ref([])
  const loadingCloudModels = ref(false)
  const lastModelsFetchAt = ref(null)
  const recommendedModels = ref([])

  const loadConfig = async () => {
    try {
      const configRes = await apiClient.getAIConfig()
      config.value = normalizeTextEmbeddingConfig(configRes.data || {})

      originalConfig.value = { ...config.value }

      if (config.value.cloud_model) {
        cloudModels.value = [{ id: config.value.cloud_model, name: config.value.cloud_model }]
      }
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

  const loadRecommendedModels = async () => {
    try {
      const response = await apiClient.getRagTextModels(buildTextModelRequest(config.value))
      const providerModels = response.data?.recommended || []
      recommendedModels.value = mergeConfiguredTextModels(
        providerModels
          .map(toRecommendedTextModelOption)
          .filter(model => model.id),
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
          .filter(model => model.id),
        config.value
      )
      if (config.value.cloud_model && !models.find(model => model.id === config.value.cloud_model)) {
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

  const clearCloudSelection = () => {
    config.value.cloud_provider = ''
    config.value.cloud_api_key = ''
    config.value.cloud_model = ''
    cloudModels.value = []
    lastModelsFetchAt.value = null
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
      clearCloudSelection()
    } else if (originalConfig.value.mode !== 'cloud') {
      config.value.cloud_api_key = ''
      config.value.cloud_model = ''
      cloudModels.value = []
      lastModelsFetchAt.value = null
    }
    await saveConfig()
  }

  const onCloudProviderChange = () => {
    config.value.cloud_api_key = ''
    config.value.cloud_model = ''
    cloudModels.value = []
    lastModelsFetchAt.value = null
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
    await loadRecommendedModels()
    await loadStatus()
    await loadBackfillStatus()
  })

  watch(
    () => [config.value.mode, config.value.primary_provider, config.value.cloud_provider].join('|'),
    async () => {
      await loadRecommendedModels()
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
    cloudModels,
    loadingCloudModels,
    lastModelsFetchAt,
    recommendedModels,
    fetchCloudModels,
    onModeChange,
    onCloudProviderChange,
    testConnection,
    saveConfig,
  }
}
