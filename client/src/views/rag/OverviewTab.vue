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
            <p :class="['text-2xl font-bold mt-1', providerAvailabilityTextClass]">
              {{ providerAvailabilityLabel }}
            </p>
            <p v-if="providerAvailability.retryAt" class="text-xs text-gray-500 mt-1">
              Retry after {{ formatTimestamp(providerAvailability.retryAt) }}
            </p>
            <p v-else-if="providerAvailability.status === 'probe_due'" class="text-xs text-gray-500 mt-1">
              Waiting for next recovery probe
            </p>
            <p v-if="providerAvailability.lastError" class="text-xs text-gray-500 mt-1 line-clamp-2">
              {{ providerAvailability.lastError }}
            </p>
          </div>
          <span :class="['text-sm font-semibold', providerAvailabilityTextClass]">
            {{ providerAvailabilityFlag }}
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
              imageStatusPresentation.textClass
            ]">
              {{ imageStatusPresentation.label }}
            </p>
            <p v-if="stats.imageEnabled" class="text-xs text-gray-500 mt-1">
              {{ stats.imageProvider }} {{ stats.imageModel ? `(${stats.imageModel})` : '' }}
            </p>
          </div>
          <span :class="[
            'text-sm font-semibold',
            imageStatusFlagClass
          ]">
            {{ stats.imageStatus === 'configured' ? 'CFG' : (stats.imageStatus === 'online' ? 'ON' : 'OFF') }}
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
      <div
        v-if="providerAvailability.status !== 'available'"
        class="rounded-lg border px-4 py-3 text-sm"
        :class="availabilityToneClasses.bannerClass"
      >
        <p class="font-medium">
          {{ providerAvailability.presentation.headline }}
        </p>
        <p class="mt-1 text-gray-300">
          {{ providerAvailability.presentation.detail }}
        </p>
      </div>
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

    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
      <h3 class="text-lg font-semibold text-white">Backfill Diagnostics</h3>
      <div
        v-if="backfillDiagnostics.startupRecoveryEligible"
        class="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200"
      >
        <p class="font-medium">Pending embeddings detected while the system is already idle</p>
        <p class="mt-1 text-yellow-100/90">
          Classifarr will now attempt startup/watchdog recovery automatically instead of waiting for a fresh idle transition.
        </p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Idle Detector</p>
          <p :class="['font-medium', idleDetectorStatusClass]">{{ idleDetectorStatusLabel }}</p>
          <p class="text-xs text-gray-500 mt-1">
            Threshold {{ formatDurationFromMs(backfillDiagnostics.idleDetector.threshold) }}
          </p>
        </div>
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Time Since Activity</p>
          <p class="text-white font-medium">
            {{ formatDurationFromMs(backfillDiagnostics.idleDetector.timeSinceActivity) }}
          </p>
          <p v-if="backfillDiagnostics.idleDetector.lastActivity" class="text-xs text-gray-500 mt-1">
            Last activity {{ formatTimestamp(backfillDiagnostics.idleDetector.lastActivity) }}
          </p>
        </div>
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Pending Breakdown</p>
          <p class="text-white font-medium">
            Text {{ formatNumber(backfillDiagnostics.pendingBreakdown.text) }} / Image {{ formatNumber(backfillDiagnostics.pendingBreakdown.image) }}
          </p>
          <p class="text-xs text-gray-500 mt-1">
            Total {{ formatNumber(backfillDiagnostics.pendingBreakdown.total) }}
          </p>
        </div>
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Startup Recovery</p>
          <p :class="['font-medium', startupRecoveryToneClass]">
            {{ backfillDiagnostics.startupRecoveryEligible ? 'Eligible' : 'Not needed' }}
          </p>
          <p class="text-xs text-gray-500 mt-1">
            {{ backfillDiagnostics.startupRecoveryEligible ? 'Pending work can be resumed immediately.' : 'No idle-start recovery required right now.' }}
          </p>
        </div>
      </div>
      <div class="bg-gray-700/30 rounded-lg p-3 text-sm">
        <p class="text-gray-400">Latest Backfill Run</p>
        <p :class="['font-medium mt-1', latestRunStatusClass]">
          {{ latestRunLabel }}
        </p>
        <p v-if="backfillDiagnostics.latestRun?.completed_at" class="text-xs text-gray-500 mt-1">
          Completed {{ formatTimestamp(backfillDiagnostics.latestRun.completed_at) }}
        </p>
        <p v-else-if="backfillDiagnostics.latestRun?.created_at" class="text-xs text-gray-500 mt-1">
          Started {{ formatTimestamp(backfillDiagnostics.latestRun.created_at) }}
        </p>
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
          <p class="text-white font-medium">{{ backfillStatus.manual.presentation.statusLabel }}</p>
        </div>
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Idle Backfill</p>
          <p class="text-white font-medium">{{ backfillStatus.idle.presentation.statusLabel }}</p>
        </div>
        <div class="bg-gray-700/30 rounded-lg p-3">
          <p class="text-gray-400">Scheduled Backfill</p>
          <p class="text-white font-medium">{{ backfillStatus.scheduled.presentation.statusLabel }}</p>
          <p v-if="backfillStatus.scheduled.enabled" class="text-xs text-gray-500 mt-1">
            {{ backfillStatus.scheduled.time }}
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
import {
  buildEmbeddingProviderIndicator,
  defaultEmbeddingAvailability,
  getEmbeddingAvailabilityToneClasses,
  normalizeEmbeddingAvailability
} from '@/utils/embeddingAvailabilityUi'
import {
  getOverviewTextModelLabel,
  getOverviewTextProviderLabel,
  normalizeOverviewRagConfig,
} from '@/utils/ragConfigUi'
import {
  formatEmbeddingMode,
  getEmbeddingModeBadgeClass,
  getImageEmbeddingStatusPresentation,
} from '@/utils/ragEmbeddingDisplay'
import { normalizeRagBackfillDiagnostics, normalizeRagOverviewStats } from '@/utils/ragStatusUi'
import {
  defaultBackfillModeStatus,
  normalizeBackfillModeStatus
} from '@/utils/backfillStatusUi'

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
  imageStatus: 'disabled',
  imageProviderOnline: false,
  imageTotalEmbeddings: 0,
  imagePendingCount: 0,
  imageProvider: 'unknown',
  imageModel: null,
  heartbeatActive: false,
  queueSize: 0,
  lastEmbeddingTime: null,
  embeddingAvailability: defaultEmbeddingAvailability()
})

const imageStatusPresentation = computed(() => {
  return getImageEmbeddingStatusPresentation(
    { state: stats.value.imageStatus },
    { configuredLabel: 'Configured' }
  )
})

const imageStatusFlagClass = computed(() => imageStatusPresentation.value.textClass)
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
  manual: defaultBackfillModeStatus('manual'),
  idle: defaultBackfillModeStatus('idle'),
  scheduled: defaultBackfillModeStatus('scheduled'),
  pending: 0,
  idleDetector: {
    isIdle: false,
    timeSinceActivity: null,
    threshold: null,
    lastActivity: null,
  },
  latestRun: null,
  startupRecoveryEligible: false,
  pendingBreakdown: { total: 0, text: 0, image: 0 },
})

const backfillDiagnostics = computed(() => normalizeRagBackfillDiagnostics(backfillStatus.value))
const idleDetectorStatusLabel = computed(() => backfillDiagnostics.value.idleDetector.isIdle ? 'Idle' : 'Active')
const idleDetectorStatusClass = computed(() => backfillDiagnostics.value.idleDetector.isIdle ? 'text-green-400' : 'text-yellow-400')
const startupRecoveryToneClass = computed(() => backfillDiagnostics.value.startupRecoveryEligible ? 'text-yellow-300' : 'text-gray-300')
const latestRunStatusClass = computed(() => {
  const status = backfillDiagnostics.value.latestRun?.status
  if (status === 'completed') return 'text-green-400'
  if (status === 'failed') return 'text-red-400'
  if (status === 'running') return 'text-blue-400'
  return 'text-gray-300'
})
const latestRunLabel = computed(() => {
  const latestRun = backfillDiagnostics.value.latestRun
  if (!latestRun) return 'No backfill run recorded yet'

  const mode = latestRun.type ? `${latestRun.type} ` : ''
  const status = latestRun.status || 'unknown'
  const processed = Number(latestRun.processed || 0)
  const total = Number(latestRun.total || 0)
  return `${mode}${status} (${formatNumber(processed)} / ${formatNumber(total)})`
})

function formatDurationFromMs(ms) {
  const numeric = Number(ms)
  if (!Number.isFinite(numeric) || numeric < 0) return 'unknown'
  const seconds = Math.floor(numeric / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  if (minutes > 0) return `${minutes}m ${remainder}s`
  return `${seconds}s`
}

const textProviderLabel = computed(() => getOverviewTextProviderLabel(config.value))

const textModelLabel = computed(() => getOverviewTextModelLabel(config.value))

const providerAvailability = computed(() => normalizeEmbeddingAvailability(stats.value.embeddingAvailability))
const providerIndicator = computed(() => buildEmbeddingProviderIndicator(providerAvailability.value, {
  providerOnline: stats.value.providerOnline,
  providerConfigured: stats.value.providerConfigured ?? true
}))
const providerAvailabilityLabel = computed(() => providerIndicator.value.label)
const providerAvailabilityFlag = computed(() => providerIndicator.value.flag)
const providerAvailabilityTextClass = computed(() => providerIndicator.value.textClass)
const availabilityToneClasses = computed(() => getEmbeddingAvailabilityToneClasses(providerAvailability.value))

const loadStats = async () => {
  try {
    loading.value = true

    const handleApiError = () => ({})

    const [overviewRes, configRes, backfillRes] = await Promise.all([
      api.getRagStatus().catch(handleApiError),
      api.getAIConfig().catch(handleApiError),
      api.getBackfillStatus().catch(handleApiError)
    ])

    const embeddingAvailability = normalizeEmbeddingAvailability(
      overviewRes?.embeddingAvailability || backfillRes?.embeddingAvailability
    )
    stats.value = normalizeRagOverviewStats({
      overviewData: overviewRes,
      embeddingAvailability,
    })

    recentActivity.value = overviewRes?.recentActivity || []
    backfillStatus.value = {
      manual: normalizeBackfillModeStatus('manual', backfillRes?.manual),
      idle: normalizeBackfillModeStatus('idle', backfillRes?.idle),
      scheduled: normalizeBackfillModeStatus('scheduled', backfillRes?.scheduled),
      embeddingAvailability,
      pending: backfillRes?.pending || 0,
      pendingBreakdown: backfillRes?.pendingBreakdown || { text: 0, image: 0, total: 0 },
      idleDetector: backfillRes?.idleDetector || {},
      latestRun: backfillRes?.latestRun || null,
      startupRecoveryEligible: backfillRes?.startupRecoveryEligible === true,
    }

    const data = configRes || {}
    config.value = normalizeOverviewRagConfig(data)
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

const formatMode = formatEmbeddingMode
const modeBadgeClass = getEmbeddingModeBadgeClass

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
