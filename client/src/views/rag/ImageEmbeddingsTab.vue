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
        <div class="flex items-center gap-2 px-2 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 text-xs uppercase tracking-wide">
          Image Embeddings
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
        <div class="flex items-center gap-2">
          <span class="text-gray-400">Model:</span>
          <span class="text-white">{{ status.modelLabel }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-gray-400">Dims:</span>
          <span class="text-white">{{ imageModelDimsLabel }}</span>
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
          @click="testImageConnection"
          :disabled="testing || imageDisabled"
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
          @click="fetchImageModels"
          :disabled="loadingImageModels || !canFetchImageModels || imageDisabled"
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loadingImageModels ? 'Fetching...' : 'Fetch Models' }}
        </button>
        <button
          @click="reembedImages"
          :disabled="reembeddingImages || imageDisabled"
          class="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ reembeddingImages ? 'Re-embedding...' : 'Re-embed Images' }}
        </button>
        <span class="text-xs text-gray-400">
          {{ lastModelsFetchLabel }}<span v-if="modelsCacheSourceLabel"> • {{ modelsCacheSourceLabel }}</span>
        </span>
      </div>
    </div>

    <!-- Provider Settings -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">🖼️ Image Embedding Provider</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Mode</label>
          <select
            v-model="config.image_mode"
            @change="onImageModeChange"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="disabled">Disabled (no image embeddings)</option>
            <option value="separate_local">Separate Local Instance</option>
            <option value="cloud">Cloud Provider</option>
          </select>
        </div>

        <div v-if="config.image_mode === 'disabled'" class="space-y-2">
          <div class="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <p class="text-sm text-gray-300">
              Image embeddings are disabled. No image vectors will be generated or used.
            </p>
          </div>
        </div>

        <div v-else-if="config.image_mode === 'separate_local'" class="space-y-4 p-4 bg-gray-700/30 rounded-lg">
          <h4 class="font-medium text-white">Local Configuration</h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Host</label>
              <input
                v-model="config.image_local_host"
                type="text"
                placeholder="image-embedder"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Port</label>
              <input
                v-model.number="config.image_local_port"
                type="number"
                placeholder="8000"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Model</label>
              <select
                v-model="config.image_local_model"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option v-for="model in imageModelOptions" :key="model.name" :value="model.name">
                  {{ model.name }} - {{ model.description }}
                </option>
              </select>
            </div>
          </div>
          <p class="text-xs text-gray-400">Local image model names depend on your service; list shows common defaults.</p>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">API Key <span class="text-gray-500 font-normal">(optional)</span></label>
            <input
              v-model="config.image_local_api_key"
              type="password"
              autocomplete="off"
              data-1p-ignore="true"
              data-lpignore="true"
              spellcheck="false"
              placeholder="Leave blank if your sidecar has no auth"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <p class="text-xs text-gray-400 mt-1">Set the <code class="text-gray-300">SERVICE_API_KEY</code> from your sidecar's <code class="text-gray-300">.env</code>. Leave blank for open access.</p>
          </div>
        </div>

        <div v-else-if="config.image_mode === 'cloud'" class="space-y-4 p-4 bg-gray-700/30 rounded-lg">
          <h4 class="font-medium text-white">Cloud Provider Configuration</h4>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Provider</label>
              <select
                v-model="config.image_cloud_provider"
                @change="onImageCloudProviderChange"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select provider</option>
                <option value="vertex">Vertex AI</option>
                <option value="voyage">Voyage AI</option>
                <option value="cohere">Cohere</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">API Key</label>
              <input
                v-model="config.image_cloud_api_key"
                type="password"
                placeholder="Enter API key"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Model</label>
              <div class="flex gap-2">
                <select
                  v-model="config.image_cloud_model"
                  class="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select model</option>
                  <option v-for="model in imageCloudModels" :key="model.id" :value="model.id">
                    {{ model.name || model.id }}
                  </option>
                </select>
                <button
                  @click="fetchImageCloudModels"
                  :disabled="loadingImageCloudModels || !config.image_cloud_provider"
                  class="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="loadingImageCloudModels">...</span>
                  <span v-else>Fetch</span>
                </button>
              </div>
              <div class="mt-1 flex items-center gap-3 text-xs text-gray-400">
                <span>{{ lastModelsFetchLabel }}</span>
                <span>Cache: 15 min</span>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">API Endpoint (optional)</label>
              <input
                v-model="config.image_cloud_api_endpoint"
                type="text"
                placeholder="https://LOCATION-aiplatform.googleapis.com/v1/projects/.../models"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <p class="text-xs text-gray-400 mt-1">Required for Vertex AI image embeddings.</p>
            </div>
          </div>
        </div>

        <div v-if="!imageDisabled" class="bg-gray-900/40 border border-gray-700 rounded-lg p-4 text-sm">
          <div class="flex flex-wrap items-center gap-4">
            <div class="text-gray-400">
              Dims: <span class="text-white font-medium">{{ imageModelDimsLabel }}</span>
            </div>
            <div class="text-gray-400">
              Expected size: <span class="text-white font-medium">{{ config.image_size }} px</span>
            </div>
          </div>
          <div v-if="modelChangedWarning" class="mt-2 text-yellow-400">
            ⚠️ {{ modelChangedWarning }}
          </div>
          <div v-if="sizeChangedWarning" class="mt-2 text-yellow-400">
            ⚠️ {{ sizeChangedWarning }}
          </div>
        </div>

        <!-- Advanced Options Stack -->
        <div v-if="!imageDisabled" class="bg-gray-700/20 rounded-lg p-4 space-y-3">
          <h4 class="font-medium text-white">Advanced Options</h4>
          <details class="bg-gray-900/40 rounded-lg p-3">
            <summary class="cursor-pointer text-sm text-gray-300">Performance</summary>
            <div class="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Image Size (px)</label>
                <input
                  v-model.number="config.image_size"
                  type="number"
                  min="128"
                  max="1024"
                  step="32"
                  class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                <p class="mt-1 text-xs text-gray-500">Square size used for embedding (default: 512).</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Requests/Sec</label>
                <input
                  v-model.number="config.image_rps"
                  type="number"
                  min="1"
                  max="20"
                  step="1"
                  class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Concurrency</label>
                <input
                  v-model.number="config.image_concurrency"
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                  class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Batch Size</label>
                <input
                  v-model.number="config.image_batch_size"
                  type="number"
                  min="1"
                  max="20"
                  step="1"
                  class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div v-if="config.image_mode === 'separate_local'">
                <label class="block text-sm font-medium text-gray-300 mb-2">Request Timeout (ms)</label>
                <input
                  v-model.number="config.image_local_timeout_ms"
                  type="number"
                  min="1000"
                  max="120000"
                  step="1000"
                  class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                <p class="mt-1 text-xs text-gray-500">Per-request HTTP timeout for embed &amp; model calls (default: 15000 ms).</p>
              </div>
            </div>
          </details>
          <details class="bg-gray-900/40 rounded-lg p-3">
            <summary class="cursor-pointer text-sm text-gray-300">Cache</summary>
            <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Cache TTL (hours)</label>
                <input
                  v-model.number="config.image_cache_ttl_hours"
                  type="number"
                  min="1"
                  max="168"
                  step="1"
                  class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Cache Max (MB)</label>
                <input
                  v-model.number="config.image_cache_max_mb"
                  type="number"
                  min="128"
                  max="10240"
                  step="128"
                  class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'
import { useImageEmbeddingModelCatalog } from '@/composables/useImageEmbeddingModelCatalog'
import {
  defaultBackfillModeStatus,
  normalizeBackfillModeStatus
} from '@/utils/backfillStatusUi'
import { normalizeRagImageRuntime } from '@/utils/ragStatusUi'
import {
  buildImageEmbeddingConnectionRequest,
  buildImageEmbeddingPayload,
  getImageConfigSignature,
  getOriginalImageConfigSignature,
  normalizeImageEmbeddingConfig
} from '@/utils/ragImageEmbeddingsUi'

const toast = useToast()

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

const {
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
  resetImageModelFetchState
} = useImageEmbeddingModelCatalog({
  config,
  imageDisabled,
  canFetchImageModels,
  apiClient: api,
  toast
})

const imageRecommendedModels = ref([
  { name: 'ViT-B-16', description: 'Default (CLIP ViT-B/16)', dims: 512 },
  { name: 'ViT-B-32', description: 'Faster (CLIP ViT-B/32)', dims: 512 },
  { name: 'ViT-L-14', description: 'Higher quality (CLIP ViT-L/14)', dims: 768 }
])

const imageModelOptions = computed(() => {
  const options = imageLocalModels.value.length > 0
    ? imageLocalModels.value.map((model) => ({
      name: model.id || model.name,
      description: model.name || 'Local model',
      dims: model.dims
    }))
    : [...imageRecommendedModels.value]
  const current = (config.value.image_local_model || '').trim()
  if (current && !options.find(option => option.name === current)) {
    options.unshift({ name: current, description: 'Current selection' })
  }
  return options
})

const statusLabel = computed(() => {
  switch (status.value.state) {
    case 'disabled':
      return 'Disabled'
    case 'configured':
      return 'Ready (Configured)'
    case 'not_configured':
      return 'Not configured'
    case 'online':
      return 'Online'
    default:
      return 'Offline'
  }
})

const statusDotClass = computed(() => {
  switch (status.value.state) {
    case 'disabled':
    case 'not_configured':
      return 'bg-gray-500'
    case 'configured':
      return 'bg-yellow-500'
    case 'online':
      return 'bg-green-500'
    default:
      return 'bg-red-500'
  }
})

const statusTextClass = computed(() => {
  switch (status.value.state) {
    case 'disabled':
    case 'not_configured':
      return 'text-gray-400'
    case 'configured':
      return 'text-yellow-400'
    case 'online':
      return 'text-green-400'
    default:
      return 'text-red-400'
  }
})

const imageModelDimsLabel = computed(() => {
  const selected = config.value.image_mode === 'cloud' ? config.value.image_cloud_model : config.value.image_local_model
  const local = imageLocalModels.value.find(model => (model.id || model.name) === selected)
  if (local?.dims) return `${local.dims}`
  const known = imageRecommendedModels.value.find(model => model.name === selected)
  if (known?.dims) return `${known.dims}`
  return 'n/a'
})

const idleBackfillLabel = computed(() => {
  if (imageDisabled.value) return 'Off'
  const idle = backfillStatus.value.idle
  if (!idle?.enabled) return 'Off'
  return idle.presentation?.statusLabel || 'On'
})
const scheduledBackfillLabel = computed(() => {
  if (imageDisabled.value) return 'Off'
  const scheduled = backfillStatus.value.scheduled
  if (!scheduled?.enabled) return 'Off'
  const label = scheduled.presentation?.statusLabel || 'On'
  return scheduled.time ? `${label} (${scheduled.time})` : label
})

const modelChangedWarning = computed(() => {
  if (!originalConfig.value?.image_mode) return ''
  if (getImageConfigSignature(config.value) !== getOriginalImageConfigSignature(originalConfig.value)) {
    return 'Model or mode changed — re-embed images to keep vectors consistent.'
  }
  return ''
})

const sizeChangedWarning = computed(() => {
  if (!originalConfig.value?.image_size) return ''
  if (config.value.image_size !== originalConfig.value.image_size) {
    return 'Image size changed — re-fetch and re-embed images to avoid mismatch.'
  }
  return ''
})

const lastModelsFetchLabel = computed(() => {
  if (!lastModelsFetchAt.value) return 'Models not fetched yet'
  return `Last fetched ${formatTimeAgo(lastModelsFetchAt.value)}`
})

const modelsCacheSourceLabel = computed(() => {
  if (modelsCacheSource.value === 'server') return 'Server cache'
  if (modelsCacheSource.value === 'browser') return 'Browser cache'
  if (modelsCacheSource.value === 'live') return 'Live'
  return ''
})

const loadConfig = async () => {
  try {
    const configRes = await api.getAIConfig()
    config.value = normalizeImageEmbeddingConfig(configRes.data || {})

    originalConfig.value = { ...config.value }

    if (config.value.image_cloud_model) {
      imageCloudModels.value = [{ id: config.value.image_cloud_model, name: config.value.image_cloud_model }]
    }
  } catch (error) {
    console.error('Failed to load image embedding config:', error)
  }
}

const loadStatus = async () => {
  try {
    const statusRes = await api.getRagStatus()
    const imageStatus = normalizeRagImageRuntime(statusRes.data?.image)

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

const clearImageCloudSelection = () => {
  config.value.image_cloud_provider = ''
  config.value.image_cloud_api_key = ''
  config.value.image_cloud_model = ''
  config.value.image_cloud_api_endpoint = ''
  imageCloudModels.value = []
}

const clearImageLocalSecret = () => {
  config.value.image_local_api_key = ''
}

const onImageModeChange = async () => {
  if (config.value.image_mode !== 'cloud') {
    clearImageCloudSelection()
  } else if (originalConfig.value.image_mode !== 'cloud') {
    config.value.image_cloud_api_key = ''
    config.value.image_cloud_model = ''
    config.value.image_cloud_api_endpoint = ''
    imageCloudModels.value = []
  }

  if (config.value.image_mode !== 'separate_local') {
    clearImageLocalSecret()
  }

  resetImageModelFetchState()
  hydrateCachedModels()
  await loadServerModelsCache()
  await saveConfig()
}

const onImageCloudProviderChange = () => {
  config.value.image_cloud_api_key = ''
  config.value.image_cloud_model = ''
  resetImageModelFetchState()
}

const testImageConnection = async () => {
  if (imageDisabled.value) {
    toast.info('Image embeddings are disabled')
    return
  }
  testing.value = true
  try {
    const response = await api.testImageEmbeddingConnection(buildImageEmbeddingConnectionRequest(config.value))

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
    const response = await api.reembedImages()
    toast.success(`Cleared ${response.data?.cleared ?? 0} image embeddings`)
  } catch (error) {
    console.error('Failed to re-embed images:', error)
    toast.error(error.response?.data?.error || 'Failed to re-embed images')
  } finally {
    reembeddingImages.value = false
  }
}

const saveConfig = async ({ silent = false } = {}) => {
  saving.value = true

  try {
    await api.updateAIConfig(buildImageEmbeddingPayload(config.value))
    if (!silent) {
      toast.success('Image embedding configuration saved successfully')
    }
    originalConfig.value = { ...config.value }
    loadStatus()
    return true
  } catch (error) {
    console.error('Failed to save image embedding config:', error)
    if (!silent) {
      toast.error(error.response?.data?.error || 'Failed to save configuration')
    }
    return false
  } finally {
    saving.value = false
  }
}

const formatMode = (mode) => {
  if (mode === 'separate_local') return 'separate'
  if (mode === 'disabled') return 'disabled'
  return mode || 'disabled'
}

const modeBadgeClass = (mode) => {
  switch (mode) {
    case 'disabled':
      return 'px-2 py-0.5 rounded-full text-xs bg-gray-600/30 text-gray-300 border border-gray-600/50'
    case 'cloud':
      return 'px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
    case 'separate_local':
      return 'px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/40'
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

onMounted(async () => {
  await loadConfig()
  await loadStatus()
  await loadBackfillStatus()
  hydrateCachedModels()
  await loadServerModelsCache()
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
    hydrateCachedModels()
    loadServerModelsCache()
  }
)
</script>


