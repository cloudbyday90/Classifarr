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
import { computed } from 'vue'
import api from '@/api'
import { useTextEmbeddingSettings } from '@/composables/useTextEmbeddingSettings'
import { useToast } from '@/stores/toast'
import {
  getOriginalTextConfigSignature,
  getSelectedTextModelName,
  getTextConfigSignature,
} from '@/utils/ragTextEmbeddingsUi'

const toast = useToast()

const {
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
} = useTextEmbeddingSettings({
  apiClient: api,
  toast,
})

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
  const selected = getSelectedTextModelName(config.value)
  const known = recommendedModels.value.find(model => model.id === selected)
  if (known?.dims) return `${known.dims}`
  if (testResult.value?.success && testResult.value?.dims) return `${testResult.value.dims}`
  return 'n/a'
})

const modelChangedWarning = computed(() => {
  if (!originalConfig.value?.mode) return ''
  if (getTextConfigSignature(config.value) !== getOriginalTextConfigSignature(originalConfig.value)) {
    return 'Model or mode changed — existing embeddings will be cleared and require re-embedding.'
  }
  return ''
})

const lastModelsFetchLabel = computed(() => {
  if (!lastModelsFetchAt.value) return 'Models not fetched yet'
  return `Last fetched ${formatTimeAgo(lastModelsFetchAt.value)}`
})

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
</script>





