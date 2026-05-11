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
          <span :class="['w-2 h-2 rounded-full', statusPresentation.dotClass]"></span>
          <span class="text-gray-400">Status:</span>
          <span :class="statusPresentation.textClass">{{ statusPresentation.label }}</span>
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
import { computed } from 'vue'
import api from '@/api'
import { useImageEmbeddingSettings } from '@/composables/useImageEmbeddingSettings'
import { useToast } from '@/stores/toast'
import {
  formatEmbeddingMode,
  getBackfillStatusLabel,
  getEmbeddingModeBadgeClass,
  getImageEmbeddingStatusPresentation,
  getLastFetchedLabel,
} from '@/utils/ragEmbeddingDisplay'
import {
  buildImageModelOptions,
  DEFAULT_IMAGE_MODEL_OPTIONS,
  getImageConfigSignature,
  getImageModelDimsLabel,
  getOriginalImageConfigSignature,
} from '@/utils/ragImageEmbeddingsUi'

const toast = useToast()
const {
  config,
  originalConfig,
  status,
  backfillStatus,
  saving,
  testing,
  reembeddingImages,
  imageDisabled,
  canFetchImageModels,
  imageCloudModels,
  imageLocalModels,
  loadingImageCloudModels,
  loadingImageModels,
  lastModelsFetchAt,
  modelsCacheSource,
  fetchImageCloudModels,
  fetchImageModels,
  saveConfig,
  onImageModeChange,
  onImageCloudProviderChange,
  testImageConnection,
  reembedImages,
} = useImageEmbeddingSettings({
  apiClient: api,
  toast
})

const imageModelOptions = computed(() => {
  return buildImageModelOptions(imageLocalModels.value, {
    currentModel: config.value.image_local_model,
    fallbackModels: DEFAULT_IMAGE_MODEL_OPTIONS,
  })
})

const statusPresentation = computed(() => {
  return getImageEmbeddingStatusPresentation(status.value)
})

const imageModelDimsLabel = computed(() => {
  return getImageModelDimsLabel({
    config: config.value,
    models: imageLocalModels.value,
    fallbackModels: DEFAULT_IMAGE_MODEL_OPTIONS,
  })
})

const idleBackfillLabel = computed(() => {
  return getBackfillStatusLabel(backfillStatus.value.idle, { disabled: imageDisabled.value })
})

const scheduledBackfillLabel = computed(() => {
  return getBackfillStatusLabel(backfillStatus.value.scheduled, { disabled: imageDisabled.value })
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
  return getLastFetchedLabel(lastModelsFetchAt.value)
})

const modelsCacheSourceLabel = computed(() => {
  if (modelsCacheSource.value === 'server') return 'Server cache'
  if (modelsCacheSource.value === 'browser') return 'Browser cache'
  if (modelsCacheSource.value === 'live') return 'Live'
  return ''
})

const formatMode = (mode) => formatEmbeddingMode(mode, { fallback: 'disabled' })
const modeBadgeClass = getEmbeddingModeBadgeClass

</script>


