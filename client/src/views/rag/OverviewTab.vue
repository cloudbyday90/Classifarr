<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- Status Cards Row -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400">Provider Status</p>
            <p :class="['text-2xl font-bold mt-1', stats.providerOnline ? 'text-green-400' : 'text-red-400']">
              {{ stats.providerOnline ? 'Online' : 'Offline' }}
            </p>
          </div>
          <span :class="['text-sm font-semibold', stats.providerOnline ? 'text-green-400' : 'text-red-400']">
            {{ stats.providerOnline ? 'ON' : 'OFF' }}
          </span>
        </div>
      </div>

      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400">Total Embeddings</p>
            <p class="text-2xl font-bold text-white mt-1">
              {{ formatNumber(stats?.totalEmbeddings) }}
            </p>
          </div>
          <span class="text-sm font-semibold text-blue-400">TOTAL</span>
        </div>
      </div>

      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400">Pending</p>
            <p :class="['text-2xl font-bold mt-1', (stats?.pendingCount || 0) > 0 ? 'text-yellow-400' : 'text-green-400']">
              {{ formatNumber(stats?.pendingCount) }}
            </p>
          </div>
          <span :class="['text-sm font-semibold', (stats?.pendingCount || 0) > 0 ? 'text-yellow-400' : 'text-green-400']">
            PEND
          </span>
        </div>
      </div>

      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400">Failed (24h)</p>
            <p :class="['text-2xl font-bold mt-1', (stats?.failedCount || 0) > 0 ? 'text-red-400' : 'text-green-400']">
              {{ formatNumber(stats?.failedCount) }}
            </p>
          </div>
          <span :class="['text-sm font-semibold', (stats?.failedCount || 0) > 0 ? 'text-red-400' : 'text-green-400']">
            {{ (stats?.failedCount || 0) > 0 ? 'ERR' : 'OK' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Image Embedding Status -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400">Image Provider</p>
            <p :class="[
              'text-2xl font-bold mt-1',
              !stats.imageEnabled ? 'text-gray-400' : (stats.imageProviderOnline ? 'text-green-400' : 'text-red-400')
            ]">
              {{ stats.imageEnabled ? (stats.imageProviderOnline ? 'Online' : 'Offline') : 'Disabled' }}
            </p>
            <p v-if="stats.imageEnabled" class="text-xs text-gray-500 mt-1">
              {{ stats.imageProvider }} {{ stats.imageModel ? `(${stats.imageModel})` : '' }}
            </p>
          </div>
          <span :class="[
            'text-sm font-semibold',
            !stats.imageEnabled ? 'text-gray-400' : (stats.imageProviderOnline ? 'text-green-400' : 'text-red-400')
          ]">
            {{ stats.imageEnabled ? (stats.imageProviderOnline ? 'ON' : 'OFF') : 'OFF' }}
          </span>
        </div>
      </div>

      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400">Image Embeddings</p>
            <p class="text-2xl font-bold text-white mt-1">
              {{ formatNumber(stats?.imageTotalEmbeddings) }}
            </p>
          </div>
          <span class="text-sm font-semibold text-blue-400">IMG</span>
        </div>
      </div>

      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400">Image Pending</p>
            <p :class="['text-2xl font-bold mt-1', (stats?.imagePendingCount || 0) > 0 ? 'text-yellow-400' : 'text-green-400']">
              {{ formatNumber(stats?.imagePendingCount) }}
            </p>
          </div>
          <span :class="['text-sm font-semibold', (stats?.imagePendingCount || 0) > 0 ? 'text-yellow-400' : 'text-green-400']">
            PEND
          </span>
        </div>
      </div>
    </div>

    <!-- Text Embedding Summary -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
      <h3 class="text-lg font-semibold text-white">Text Embedding Summary</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Provider</p>
          <div class="flex items-center gap-2">
            <p class="text-white font-medium">{{ textProviderLabel }}</p>
            <span :class="modeBadgeClass(config.mode)">{{ formatMode(config.mode) }}</span>
          </div>
        </div>
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Model</p>
          <p class="text-white font-medium">{{ textModelLabel }}</p>
        </div>
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Similarity</p>
          <p class="text-white font-medium">{{ formatPercent(config.rag_similarity_threshold) }}</p>
        </div>
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Text Weight</p>
          <p class="text-white font-medium">{{ formatPercent(config.rag_text_weight) }}</p>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Mode</p>
          <p class="text-white font-medium">{{ formatMode(config.mode) }}</p>
        </div>
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Min History</p>
          <p class="text-white font-medium">{{ config.rag_min_history_count }}</p>
        </div>
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Weight Split</p>
          <p class="text-white font-medium">{{ formatPercent(config.rag_text_weight) }} / {{ formatPercent(config.rag_image_weight) }}</p>
        </div>
      </div>
    </div>

    <!-- Image Embedding Summary -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
      <h3 class="text-lg font-semibold text-white">Image Embedding Summary</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Provider</p>
          <div class="flex items-center gap-2">
            <p class="text-white font-medium">{{ stats.imageProvider || 'unknown' }}</p>
            <span :class="modeBadgeClass(config.image_mode)">{{ formatMode(config.image_mode) }}</span>
          </div>
        </div>
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Model</p>
          <p class="text-white font-medium">{{ stats.imageModel || 'default' }}</p>
        </div>
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Image Size</p>
          <p class="text-white font-medium">{{ config.image_size }} px</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Rate Limit</p>
          <p class="text-white font-medium">{{ config.image_rps }} rps / {{ config.image_concurrency }} conc</p>
        </div>
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Manual Backfill</p>
          <p class="text-white font-medium">{{ backfillStatus.manual.status || 'idle' }}</p>
        </div>
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Idle Backfill</p>
          <p class="text-white font-medium">
            {{ backfillStatus.idle.isRunning ? 'running' : (backfillStatus.idle.config?.idle_backfill_enabled ? 'enabled' : 'disabled') }}
          </p>
        </div>
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Scheduled Backfill</p>
          <p class="text-white font-medium">
            {{ backfillStatus.scheduled.enabled ? `enabled (${backfillStatus.scheduled.time})` : 'disabled' }}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button
          @click="reembedImages"
          :disabled="reembeddingImages"
          class="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ reembeddingImages ? 'Re-embedding...' : 'Re-embed Images' }}
        </button>
        <button
          @click="emit('navigate', 'backfill')"
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Open Backfill Tab
        </button>
        <button
          @click="loadStats"
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Refresh Stats
        </button>
        <p class="text-xs text-gray-400">Re-embedding clears image vectors so backfill regenerates them.</p>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Recent Activity</h3>
      <div v-if="loading" class="text-center py-8 text-gray-400">
        Loading...
      </div>
      <div v-else-if="recentActivity.length === 0" class="text-center py-8 text-gray-400">
        No recent activity
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="item in recentActivity"
          :key="item.id"
          class="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg"
        >
          <span :class="[
            'w-2 h-2 rounded-full shrink-0',
            item.level === 'error' ? 'bg-red-500' : item.level === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
          ]"></span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-400">{{ formatTimestamp(item.created_at) }}</span>
              <span class="text-xs px-2 py-0.5 bg-gray-600 rounded-sm">{{ item.type }}</span>
            </div>
            <p class="text-sm text-white truncate">{{ item.message }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'

const emit = defineEmits(['navigate'])
const toast = useToast()

const loading = ref(true)
const stats = ref({
  providerStatus: 'unknown',
  totalEmbeddings: 0,
  pendingEmbeddings: 0,
  failed24h: 0,
  providerOnline: false,
  imageEnabled: false,
  imageProviderOnline: false,
  imageTotalEmbeddings: 0,
  imagePendingCount: 0,
  imageProvider: 'unknown',
  imageModel: null,
  heartbeatActive: false,
  queueSize: 0,
  lastEmbeddingTime: null
})
const config = ref({
  primary_provider: 'none',
  mode: 'same',
  embedding_model: 'nomic-embed-text',
  ollama_model: 'nomic-embed-text',
  cloud_provider: '',
  cloud_model: '',
  rag_similarity_threshold: 0.7,
  rag_text_weight: 0.7,
  rag_image_weight: 0.3,
  rag_min_history_count: 50,
  image_mode: 'disabled',
  image_size: 512,
  image_rps: 2,
  image_concurrency: 2
})
const recentActivity = ref([])
const reembeddingImages = ref(false)
const backfillStatus = ref({
  manual: { status: 'idle' },
  idle: { isRunning: false, config: null },
  scheduled: { enabled: false, time: '02:00' },
  pending: 0
})

const textProviderLabel = computed(() => {
  const mode = config.value.mode
  if (mode === 'cloud') {
    return config.value.cloud_provider || 'cloud'
  }
  if (mode === 'separate_ollama') {
    return 'ollama'
  }
  return config.value.primary_provider || 'classification'
})

const textModelLabel = computed(() => {
  const mode = config.value.mode
  if (mode === 'cloud') {
    return config.value.cloud_model || 'default'
  }
  if (mode === 'separate_ollama') {
    return config.value.ollama_model || 'default'
  }
  return config.value.embedding_model || 'default'
})

const loadStats = async () => {
  try {
    loading.value = true

    const handleApiError = () => ({ data: {} })

    const [overviewRes, configRes, backfillRes] = await Promise.all([
      api.get('/rag/status').catch(handleApiError),
      api.get('/settings/ai').catch(handleApiError),
      api.get('/rag/backfill/status').catch(handleApiError)
    ])

    const imageData = overviewRes.data?.image || {}
    stats.value = {
      ...overviewRes.data?.stats,
      providerOnline: overviewRes.data?.providerOnline ?? false,
      totalEmbeddings: overviewRes.data?.stats?.totalEmbeddings ?? overviewRes.data?.stats?.total ?? 0,
      pendingCount: overviewRes.data?.stats?.pendingCount ?? overviewRes.data?.stats?.pendingRetries ?? 0,
      failedCount: 0,
      avgGenerationTime: 0,
      lastEmbeddingTime: null,
      imageEnabled: imageData.enabled ?? false,
      imageProviderOnline: imageData.providerOnline ?? false,
      imageTotalEmbeddings: imageData.stats?.total ?? 0,
      imagePendingCount: imageData.stats?.pending ?? 0,
      imageProvider: imageData.provider || 'unknown',
      imageModel: imageData.model || null
    }

    recentActivity.value = overviewRes.data?.recentActivity || []
    backfillStatus.value = {
      manual: backfillRes.data?.manual || { status: 'idle' },
      idle: backfillRes.data?.idle || { isRunning: false, config: null },
      scheduled: backfillRes.data?.scheduled || { enabled: false, time: '02:00' },
      pending: backfillRes.data?.pending || 0
    }

    const data = configRes.data || {}
    const rawImageMode = data.image_embedding_provider_mode || 'disabled'
    const normalizedImageMode = rawImageMode === 'local'
      ? 'separate_local'
      : (['disabled', 'separate_local', 'cloud'].includes(rawImageMode) ? rawImageMode : 'disabled')
    config.value = {
      primary_provider: data.primary_provider || 'none',
      mode: data.embedding_provider_mode || 'same',
      embedding_model: data.embedding_model || 'nomic-embed-text',
      ollama_model: data.embedding_ollama_model || 'nomic-embed-text',
      cloud_provider: data.embedding_cloud_provider || '',
      cloud_model: data.embedding_cloud_model || '',
      rag_similarity_threshold: Number(data.rag_similarity_threshold ?? 0.7),
      rag_text_weight: Number(data.rag_text_weight ?? 0.7),
      rag_image_weight: Number(data.rag_image_weight ?? 0.3),
      rag_min_history_count: Number(data.rag_min_history_count ?? 50),
      image_mode: normalizedImageMode,
      image_local_host: data.image_embedding_local_host || '',
      image_size: Number(data.image_embedding_image_size ?? 512),
      image_rps: Number(data.image_embedding_rps ?? 2),
      image_concurrency: Number(data.image_embedding_concurrency ?? 2)
    }
  } catch (error) {
    console.error('Failed to load overview:', error)
  } finally {
    loading.value = false
  }
}

const reembedImages = async () => {
  if (!confirm('Re-embed all images? This will clear stored image embeddings and backfill will regenerate them.')) {
    return
  }

  reembeddingImages.value = true
  try {
    const response = await api.reembedImages()
    toast.success(`Cleared ${response.data?.cleared ?? 0} image embeddings`)
    await loadStats()
  } catch (error) {
    console.error('Failed to re-embed images:', error)
    toast.error(error.response?.data?.error || 'Failed to re-embed images')
  } finally {
    reembeddingImages.value = false
  }
}

const formatNumber = (num) => {
  if (num == null) return '0'
  return num.toLocaleString()
}

const formatPercent = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 'n/a'
  if (num > 1) return `${Math.round(num)}%`
  return `${Math.round(num * 100)}%`
}

const formatMode = (mode) => {
  if (mode === 'separate_ollama' || mode === 'separate_local') return 'separate'
  if (mode === 'disabled') return 'disabled'
  return mode || 'same'
}

const modeBadgeClass = (mode) => {
  switch (mode) {
    case 'disabled':
      return 'px-2 py-0.5 rounded-full text-xs bg-gray-600/30 text-gray-300 border border-gray-600/50'
    case 'cloud':
      return 'px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
    case 'separate_ollama':
    case 'separate_local':
      return 'px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/40'
    case 'same':
      return 'px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/40'
    default:
      return 'px-2 py-0.5 rounded-full text-xs bg-gray-500/20 text-gray-300 border border-gray-500/40'
  }
}

const formatTimestamp = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  })
}

onMounted(() => {
  loadStats()
})
</script>


