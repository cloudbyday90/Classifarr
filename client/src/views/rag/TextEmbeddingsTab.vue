<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- Status Strip -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
      <div class="flex flex-wrap items-center gap-4 text-sm">
        <div class="flex items-center gap-2 px-2 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 text-xs uppercase tracking-wide">
          Text Embeddings
        </div>
        <div class="flex items-center gap-2">
          <span :class="['w-2 h-2 rounded-full', statusDotClass]"></span>
          <span class="text-gray-400">Status:</span>
          <span :class="statusTextClass">{{ statusLabel }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-gray-400">Provider:</span>
          <span class="text-white">{{ status.providerLabel }}</span>
          <span :class="modeBadgeClass(status.mode)">{{ formatMode(status.mode) }}</span>
        </div>
        <div v-if="textRuntimeLabel" class="flex items-center gap-2">
          <span class="text-gray-400">Runtime:</span>
          <span class="text-white">{{ textRuntimeLabel }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-gray-400">Model:</span>
          <span class="text-white">{{ status.modelLabel }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-gray-400">Dims:</span>
          <span class="text-white">{{ textModelDimsLabel }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-gray-400">Backfill:</span>
          <span class="text-white">Idle {{ idleBackfillLabel }}</span>
          <span class="text-gray-500">•</span>
          <span class="text-white">Scheduled {{ scheduledBackfillLabel }}</span>
        </div>
      </div>
    </div>

    <!-- Action Panel -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div class="flex flex-wrap items-center gap-3">
        <button
          @click="testConnection"
          :disabled="testing"
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ testing ? 'Testing...' : 'Test Connection' }}
        </button>
        <button
          @click="saveConfig"
          :disabled="saving"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ saving ? 'Saving...' : 'Save Configuration' }}
        </button>
        <button
          @click="fetchCloudModels"
          :disabled="loadingCloudModels || !config.cloud_provider"
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loadingCloudModels ? 'Fetching...' : 'Fetch Models' }}
        </button>
        <span class="text-xs text-gray-400">
          {{ lastModelsFetchLabel }}
        </span>
      </div>
    </div>

    <!-- Provider Settings -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">🔤 Text Embedding Provider</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Mode</label>
          <select
            v-model="config.mode"
            @change="onModeChange"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="same">Same as Classification</option>
            <option value="separate_ollama">Separate Ollama Instance</option>
            <option value="cloud">Cloud Provider</option>
          </select>
        </div>

        <div v-if="config.mode === 'same'" class="space-y-2">
          <label class="block text-sm font-medium text-gray-300 mb-2">Embedding Model</label>
          <select
            v-model="config.embedding_model"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option v-for="model in recommendedModels" :key="model.id" :value="model.id">
              {{ model.id }} - {{ model.description }}
            </option>
          </select>
          <p class="text-xs text-gray-400">Uses the same provider path as your AI classification setup.</p>
        </div>

        <div v-if="config.mode === 'separate_ollama'" class="space-y-4 p-4 bg-gray-700/30 rounded-lg">
          <h4 class="font-medium text-white">Ollama Configuration</h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Host</label>
              <input
                v-model="config.ollama_host"
                type="text"
                placeholder="192.168.1.100"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Port</label>
              <input
                v-model.number="config.ollama_port"
                type="number"
                placeholder="11434"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Model</label>
              <select
                v-model="config.ollama_model"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option v-for="model in recommendedModels" :key="model.id" :value="model.id">
                  {{ model.id }} - {{ model.description }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <div v-if="config.mode === 'cloud'" class="space-y-4 p-4 bg-gray-700/30 rounded-lg">
          <h4 class="font-medium text-white">Cloud Provider Configuration</h4>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Provider</label>
              <select
                v-model="config.cloud_provider"
                @change="onCloudProviderChange"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select provider</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
                <option value="voyage">Voyage AI</option>
                <option value="openrouter">OpenRouter</option>
                <option value="cohere">Cohere</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">API Key</label>
              <input
                v-model="config.cloud_api_key"
                type="password"
                placeholder="Enter API key"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Model</label>
              <div class="flex gap-2">
                <select
                  v-model="config.cloud_model"
                  class="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select model</option>
                  <option v-for="model in cloudModels" :key="model.id" :value="model.id">
                    {{ model.name || model.id }}
                  </option>
                </select>
                <button
                  @click="fetchCloudModels"
                  :disabled="loadingCloudModels || !config.cloud_provider"
                  class="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="loadingCloudModels">...</span>
                  <span v-else>Fetch</span>
                </button>
              </div>
              <div class="mt-1 flex items-center gap-3 text-xs text-gray-400">
                <span>{{ lastModelsFetchLabel }}</span>
                <span>Cache: 15 min</span>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-gray-900/40 border border-gray-700 rounded-lg p-4 text-sm">
          <div class="flex flex-wrap items-center gap-4">
            <div class="text-gray-400">
              Dims: <span class="text-white font-medium">{{ textModelDimsLabel }}</span>
            </div>
            <div class="text-gray-400">
              Mode: <span class="text-white font-medium">{{ formatMode(config.mode) }}</span>
            </div>
          </div>
          <div v-if="modelChangedWarning" class="mt-2 text-yellow-400">
            ⚠️ {{ modelChangedWarning }}
          </div>
        </div>

        <div v-if="testResult" :class="[
          'p-4 rounded-lg',
          testResult.success ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'
        ]">
          {{ testResult.success ? `Connected successfully (${testResult.dims} dimensions)` : `Error: ${testResult.error}` }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'
import {
  defaultBackfillModeStatus,
  normalizeBackfillModeStatus
} from '@/utils/backfillStatusUi'

const toast = useToast()

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

const statusLabel = computed(() => {
  if (status.value.providerOnline) return 'Online'
  if (status.value.providerConfigured) return 'Configured'
  return 'Offline'
})

const statusDotClass = computed(() => {
  if (status.value.providerOnline) return 'bg-green-500'
  if (status.value.providerConfigured) return 'bg-yellow-500'
  return 'bg-red-500'
})

const statusTextClass = computed(() => {
  if (status.value.providerOnline) return 'text-green-400'
  if (status.value.providerConfigured) return 'text-yellow-400'
  return 'text-red-400'
})

const textRuntimeLabel = computed(() => {
  if (config.value.mode === 'cloud') return 'Cloud'
  if (config.value.mode === 'separate_ollama') return 'Ollama'
  if (config.value.mode === 'same') {
    return status.value.providerLabel && status.value.providerLabel !== 'unknown'
      ? status.value.providerLabel
      : 'Same'
  }
  return ''
})

const textModelDimsLabel = computed(() => {
  const selected = getSelectedModelName()
  const known = recommendedModels.value.find(model => model.id === selected)
  if (known?.dims) return `${known.dims}`
  if (testResult.value?.success && testResult.value?.dims) return `${testResult.value.dims}`
  return 'n/a'
})

const modelChangedWarning = computed(() => {
  if (!originalConfig.value?.mode) return ''
  if (getConfigSignature() !== getOriginalSignature()) {
    return 'Model or mode changed — existing embeddings will be cleared and require re-embedding.'
  }
  return ''
})

const lastModelsFetchLabel = computed(() => {
  if (!lastModelsFetchAt.value) return 'Models not fetched yet'
  return `Last fetched ${formatTimeAgo(lastModelsFetchAt.value)}`
})

const loadConfig = async () => {
  try {
    const configRes = await api.getAIConfig()
    const data = configRes.data || {}

    config.value = {
      primary_provider: data.primary_provider || 'none',
      mode: data.embedding_provider_mode || 'same',
      embedding_model: data.embedding_model || 'nomic-embed-text',
      ollama_host: data.embedding_ollama_host || '',
      ollama_port: data.embedding_ollama_port || 11434,
      ollama_model: data.embedding_ollama_model || 'nomic-embed-text',
      cloud_provider: data.embedding_cloud_provider || '',
      cloud_api_key: data.embedding_cloud_api_key || '',
      cloud_model: data.embedding_cloud_model || ''
    }

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
    const statusRes = await api.getRagStatus()
    const data = statusRes.data || {}

    status.value = {
      providerOnline: data.providerOnline ?? false,
      providerConfigured: isProviderConfigured(),
      providerLabel: getProviderLabel(),
      modelLabel: getSelectedModelName() || 'unknown',
      mode: config.value.mode
    }
  } catch (error) {
    console.error('Failed to load text embedding status:', error)
  }
}

const fetchCloudModels = async () => {
  if (!config.value.cloud_provider) {
    toast.warning('Select a cloud provider first')
    return
  }

  loadingCloudModels.value = true
  try {
    const response = await api.getRagTextModels(getTextModelRequest({
      mode: 'cloud',
      provider: config.value.cloud_provider,
      api_key: config.value.cloud_api_key
    }))

    const models = response.data?.models || []
    recommendedModels.value = mergeConfiguredModels(
      (response.data?.recommended || [])
        .map(toRecommendedModelOption)
        .filter(model => model.id)
    )
    if (config.value.cloud_model && !models.find(m => m.id === config.value.cloud_model)) {
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
    const response = await api.testRagConnection({
      mode: config.value.mode,
      host: config.value.ollama_host,
      port: config.value.ollama_port,
      model: config.value.mode === 'same' ? config.value.embedding_model : config.value.ollama_model
    })

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

const buildTextEmbeddingPayload = () => {
  const payload = {
    rag_enabled: true,
    embedding_provider_mode: config.value.mode,
    embedding_model: config.value.embedding_model,
    embedding_ollama_host: config.value.ollama_host,
    embedding_ollama_port: config.value.ollama_port,
    embedding_ollama_model: config.value.ollama_model
  }

  if (config.value.mode === 'cloud') {
    payload.embedding_cloud_provider = config.value.cloud_provider
    payload.embedding_cloud_api_key = config.value.cloud_api_key
    payload.embedding_cloud_model = config.value.cloud_model
  } else {
    payload.embedding_cloud_provider = ''
    payload.embedding_cloud_api_key = ''
    payload.embedding_cloud_model = ''
  }

  return payload
}

const saveConfig = async () => {
  saving.value = true

  try {
    await api.updateAIConfig(buildTextEmbeddingPayload())
    toast.success('Text embedding configuration saved successfully')
    originalConfig.value = { ...config.value }
    loadStatus()
  } catch (error) {
    console.error('Failed to save text embedding config:', error)
    toast.error(error.response?.data?.error || 'Failed to save configuration')
  } finally {
    saving.value = false
  }
}

const getProviderLabel = () => {
  if (config.value.mode === 'cloud') return config.value.cloud_provider || 'cloud'
  if (config.value.mode === 'separate_ollama') return 'ollama'
  return config.value.primary_provider || 'classification'
}

const isProviderConfigured = () => {
  if (config.value.mode === 'same') {
    return !!config.value.primary_provider && config.value.primary_provider !== 'none'
  }
  if (config.value.mode === 'separate_ollama') {
    return !!config.value.ollama_host
  }
  if (config.value.mode === 'cloud') {
    return !!config.value.cloud_api_key
  }
  return false
}

const getSelectedModelName = () => {
  if (config.value.mode === 'cloud') return config.value.cloud_model
  if (config.value.mode === 'separate_ollama') return config.value.ollama_model
  return config.value.embedding_model
}

const getConfigSignature = () => {
  return [
    config.value.mode,
    config.value.cloud_provider,
    getSelectedModelName()
  ].join('|')
}

const getOriginalSignature = () => {
  if (!originalConfig.value?.mode) return ''
  const originalModel = originalConfig.value.mode === 'cloud'
    ? originalConfig.value.cloud_model
    : (originalConfig.value.mode === 'separate_ollama'
      ? originalConfig.value.ollama_model
      : originalConfig.value.embedding_model)

  return [
    originalConfig.value.mode,
    originalConfig.value.cloud_provider,
    originalModel
  ].join('|')
}

const formatMode = (mode) => {
  if (mode === 'separate_ollama') return 'separate'
  return mode || 'same'
}

const idleBackfillLabel = computed(() => {
  const idle = backfillStatus.value.idle
  if (!idle?.enabled) return 'Off'
  return idle.presentation?.statusLabel || 'On'
})
const scheduledBackfillLabel = computed(() => {
  const scheduled = backfillStatus.value.scheduled
  if (!scheduled?.enabled) return 'Off'
  const label = scheduled.presentation?.statusLabel || 'On'
  return scheduled.time ? `${label} (${scheduled.time})` : label
})

const modeBadgeClass = (mode) => {
  switch (mode) {
    case 'cloud':
      return 'px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
    case 'separate_ollama':
      return 'px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/40'
    case 'same':
      return 'px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/40'
    default:
      return 'px-2 py-0.5 rounded-full text-xs bg-gray-500/20 text-gray-300 border border-gray-500/40'
  }
}

const formatTimeAgo = (date) => {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = Math.max(0, now - then)
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const loadBackfillStatus = async () => {
  try {
    const response = await api.getBackfillStatus()
    backfillStatus.value = {
      idle: normalizeBackfillModeStatus('idle', response.data?.idle),
      scheduled: normalizeBackfillModeStatus('scheduled', response.data?.scheduled)
    }
  } catch (error) {
    console.error('Failed to load backfill status:', error)
  }
}

const getTextModelRequest = (overrides = {}) => {
  const nextMode = overrides.mode || config.value.mode
  return {
    mode: nextMode,
    provider: overrides.provider ?? (nextMode === 'cloud' ? config.value.cloud_provider : undefined),
    api_key: overrides.api_key ?? (nextMode === 'cloud' ? config.value.cloud_api_key : undefined)
  }
}

const toRecommendedModelOption = (model) => ({
  id: model?.id || model?.name || '',
  name: model?.name || model?.id || '',
  description: model?.desc || model?.description || model?.name || model?.id || 'Recommended embedding model',
  dims: model?.dims ?? null
})

const mergeConfiguredModels = (models) => {
  const merged = [...models]
  const selectedModels = [config.value.embedding_model, config.value.ollama_model].filter(Boolean)

  for (const selected of selectedModels) {
    if (!merged.find(model => model.id === selected)) {
      merged.unshift({
        id: selected,
        name: selected,
        description: 'Configured model',
        dims: null
      })
    }
  }

  return merged
}

const loadRecommendedModels = async () => {
  try {
    const response = await api.getRagTextModels(getTextModelRequest())
    const providerModels = response.data?.recommended || []
    recommendedModels.value = mergeConfiguredModels(
      providerModels
        .map(toRecommendedModelOption)
        .filter(model => model.id)
    )
  } catch (error) {
    console.error('Failed to load recommended embedding models:', error)
    recommendedModels.value = mergeConfiguredModels([])
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
</script>





