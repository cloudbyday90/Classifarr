<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- Loading State (only when no cached data) -->
    <div v-if="loading && !ragData" class="flex items-center justify-center py-12">
      <div class="flex flex-col items-center gap-4">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p class="text-gray-400">Loading RAG statistics...</p>
      </div>
    </div>
    
    <!-- Updating indicator when showing stale data -->
    <div v-else-if="isStale" class="text-center py-2">
      <span class="text-xs text-gray-400 animate-pulse">⏳ Updating...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-900/20 border border-red-700 rounded-lg p-4">
      <div class="flex items-start gap-3">
        <span class="text-2xl">⚠️</span>
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-red-400 mb-1">Error Loading Statistics</h3>
          <p class="text-sm text-gray-300">{{ error }}</p>
          <button
            @click="refresh"
            class="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content (only shown when not loading and no error) -->
    <template v-else>
    <!-- Summary Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400">Total Embeddings</p>
            <p class="text-2xl font-bold text-white mt-1">
              {{ formatNumber(stats.totalEmbeddings) }}
            </p>
          </div>
          <span class="text-3xl text-blue-400">💾</span>
        </div>
      </div>

      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400">Pending</p>
            <p :class="['text-2xl font-bold mt-1', stats.pendingCount > 0 ? 'text-yellow-400' : 'text-green-400']">
              {{ formatNumber(stats.pendingCount) }}
            </p>
          </div>
          <span :class="['text-3xl', stats.pendingCount > 0 ? 'text-yellow-400' : 'text-green-400']">
            ⏱️
          </span>
        </div>
      </div>

      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400">Failed (24h)</p>
            <p :class="['text-2xl font-bold mt-1', stats.failed24h > 0 ? 'text-red-400' : 'text-green-400']">
              {{ formatNumber(stats.failed24h) }}
            </p>
          </div>
          <span :class="['text-3xl', stats.failed24h > 0 ? 'text-red-400' : 'text-green-400']">
            ⚠️
          </span>
        </div>
      </div>

      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400">Avg Latency</p>
            <p class="text-2xl font-bold text-white mt-1">
              {{ providerMetrics.avgLatency || 0 }}ms
            </p>
          </div>
          <span class="text-3xl text-purple-400">⚡</span>
        </div>
      </div>
    </div>

    <!-- Circuit Breaker Status -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div
        v-if="embeddingAvailability.status !== 'available'"
        class="mb-4 rounded-lg border px-4 py-3 text-sm"
        :class="availabilityToneClasses.bannerClass"
      >
        <p class="font-medium">
          {{ embeddingAvailability.presentation.headline }}
        </p>
        <p class="mt-1 text-gray-300">{{ embeddingAvailability.presentation.detail }}</p>
        <p v-if="embeddingAvailability.retryAt" class="mt-1 text-gray-300">
          Retry after {{ formatTimestamp(embeddingAvailability.retryAt) }}
        </p>
      </div>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-white">Circuit Breaker</h3>
        <button
          v-if="circuitBreaker.state !== 'CLOSED'"
          @click="resetCircuitBreaker"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
        >
          Reset
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div class="bg-gray-700/30 rounded-lg p-4">
          <p class="text-sm text-gray-400 mb-2">Availability</p>
          <p :class="['text-xl font-bold', availabilityToneClasses.textClass]">{{ embeddingAvailability.presentation.statusLabel }}</p>
        </div>

        <div class="bg-gray-700/30 rounded-lg p-4">
          <p class="text-sm text-gray-400 mb-2">Retry / Probe</p>
          <p class="text-sm text-white">
            {{ embeddingAvailability.retryAt ? formatTimestamp(embeddingAvailability.retryAt) : 'Immediate' }}
          </p>
        </div>

        <div class="bg-gray-700/30 rounded-lg p-4">
          <p class="text-sm text-gray-400 mb-2">Failure Count</p>
          <p class="text-xl font-bold text-white">{{ embeddingAvailability.failureCount || 0 }}</p>
        </div>

        <div class="bg-gray-700/30 rounded-lg p-4">
          <p class="text-sm text-gray-400 mb-2">Last Error</p>
          <p class="text-sm text-white break-words">{{ embeddingAvailability.presentation.detail || 'None' }}</p>
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div class="bg-gray-700/30 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <span :class="[
              'w-3 h-3 rounded-full',
              circuitBreaker.state === 'CLOSED' ? 'bg-green-500' :
              circuitBreaker.state === 'HALF_OPEN' ? 'bg-yellow-500' :
              'bg-red-500'
            ]"></span>
            <span class="text-sm text-gray-400">State</span>
          </div>
          <p class="text-xl font-bold text-white">{{ circuitBreaker.state }}</p>
        </div>

        <div class="bg-gray-700/30 rounded-lg p-4">
          <p class="text-sm text-gray-400 mb-2">Failures</p>
          <p class="text-xl font-bold text-white">{{ circuitBreaker.failureCount }} / {{ circuitBreaker.config?.failureThreshold || 5 }}</p>
        </div>

        <div class="bg-gray-700/30 rounded-lg p-4">
          <p class="text-sm text-gray-400 mb-2">Last Failure</p>
          <p class="text-sm text-white">{{ circuitBreaker.lastFailureTime ? formatTimestamp(circuitBreaker.lastFailureTime) : 'Never' }}</p>
        </div>
      </div>

      <div class="bg-gray-900 rounded-lg p-3 text-sm">
        <p class="text-gray-400 mb-1">State History (Recent)</p>
        <div class="space-y-1">
          <div v-if="circuitBreaker.stateHistory?.length === 0" class="text-gray-500 py-2">
            No state changes
          </div>
          <div v-for="(change, i) in (circuitBreaker.stateHistory || []).slice(-5)" :key="i" class="text-gray-300 font-mono text-xs">
            {{ formatTimestamp(change.timestamp) }} - {{ change.from }} → {{ change.to }} ({{ change.reason }})
          </div>
        </div>
      </div>
    </div>

    <!-- Request Metrics -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-white">Request Metrics</h3>
        <div class="flex gap-2">
          <button
            v-if="providerMetrics.isModelCold"
            @click="warmupModel"
            :disabled="warmingUp"
            class="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
          >
            {{ warmingUp ? 'Warming up...' : '🔥 Warmup Model' }}
          </button>
        </div>
      </div>
      
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div class="bg-gray-700/30 rounded-lg p-4">
          <p class="text-xs text-gray-400 mb-1">Total</p>
          <p class="text-2xl font-bold text-white">{{ providerMetrics.totalRequests || 0 }}</p>
        </div>

        <div class="bg-gray-700/30 rounded-lg p-4">
          <p class="text-xs text-gray-400 mb-1">Success</p>
          <p class="text-2xl font-bold text-green-400">{{ providerMetrics.successfulRequests || 0 }}</p>
        </div>

        <div class="bg-gray-700/30 rounded-lg p-4">
          <p class="text-xs text-gray-400 mb-1">Failed</p>
          <p class="text-2xl font-bold text-red-400">{{ providerMetrics.failedRequests || 0 }}</p>
        </div>

        <div class="bg-gray-700/30 rounded-lg p-4">
          <p class="text-xs text-gray-400 mb-1">Retries</p>
          <p class="text-2xl font-bold text-yellow-400">{{ providerMetrics.retryAttempts || 0 }}</p>
        </div>

        <div class="bg-gray-700/30 rounded-lg p-4">
          <p class="text-xs text-gray-400 mb-1">Avg Latency</p>
          <p class="text-2xl font-bold text-white">{{ providerMetrics.avgLatency || 0 }}ms</p>
        </div>

        <div class="bg-gray-700/30 rounded-lg p-4">
          <p class="text-xs text-gray-400 mb-1">Model Status</p>
          <p class="text-sm font-bold" :class="providerMetrics.isModelCold ? 'text-blue-400' : 'text-green-400'">
            {{ providerMetrics.isModelCold ? '🧊 Cold' : '🔥 Warm' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Error History Table -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Error History</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-xs text-gray-400 uppercase bg-gray-700/30">
            <tr>
              <th class="px-4 py-2 text-left">Time</th>
              <th class="px-4 py-2 text-left">Error</th>
              <th class="px-4 py-2 text-left">Code</th>
              <th class="px-4 py-2 text-left">Latency</th>
              <th class="px-4 py-2 text-left">Retryable</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            <tr v-if="(providerMetrics.errorHistory || []).length === 0">
              <td colspan="5" class="px-4 py-8 text-center text-gray-400">
                No errors recorded
              </td>
            </tr>
            <tr v-for="(err, i) in (providerMetrics.errorHistory || [])" :key="i" class="hover:bg-gray-700/30">
              <td class="px-4 py-2 text-gray-300">{{ formatTimestamp(err.timestamp) }}</td>
              <td class="px-4 py-2 text-white max-w-xs truncate">{{ err.message }}</td>
              <td class="px-4 py-2 text-gray-300">{{ err.code || 'N/A' }}</td>
              <td class="px-4 py-2 text-gray-300">{{ err.latency }}ms</td>
              <td class="px-4 py-2">
                <span :class="[
                  'px-2 py-1 rounded-sm text-xs',
                  err.retryable ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                ]">
                  {{ err.retryable ? 'Yes' : 'No' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Retry History Table -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Retry History</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-xs text-gray-400 uppercase bg-gray-700/30">
            <tr>
              <th class="px-4 py-2 text-left">Time</th>
              <th class="px-4 py-2 text-left">Attempt</th>
              <th class="px-4 py-2 text-left">Error</th>
              <th class="px-4 py-2 text-left">Backoff Delay</th>
              <th class="px-4 py-2 text-left">Retry-After</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            <tr v-if="(providerMetrics.retryHistory || []).length === 0">
              <td colspan="5" class="px-4 py-8 text-center text-gray-400">
                No retries recorded
              </td>
            </tr>
            <tr v-for="(retry, i) in (providerMetrics.retryHistory || [])" :key="i" class="hover:bg-gray-700/30">
              <td class="px-4 py-2 text-gray-300">{{ formatTimestamp(retry.timestamp) }}</td>
              <td class="px-4 py-2 text-white">{{ retry.attempt }}</td>
              <td class="px-4 py-2 text-white max-w-xs truncate">{{ retry.error }}</td>
              <td class="px-4 py-2 text-gray-300">{{ retry.backoffDelay }}ms</td>
              <td class="px-4 py-2 text-gray-300">{{ retry.retryAfter || 'N/A' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Backfill History Table -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Backfill History</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-xs text-gray-400 uppercase bg-gray-700/30">
            <tr>
              <th class="px-4 py-2 text-left">Type</th>
              <th class="px-4 py-2 text-left">Status</th>
              <th class="px-4 py-2 text-left">Started</th>
              <th class="px-4 py-2 text-left">Duration</th>
              <th class="px-4 py-2 text-left">Processed</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            <tr v-if="backfillHistory.length === 0">
              <td colspan="5" class="px-4 py-8 text-center text-gray-400">
                No backfill history
              </td>
            </tr>
            <tr v-for="run in backfillHistory" :key="run.id" class="hover:bg-gray-700/30">
              <td class="px-4 py-2 text-white">{{ run.type }}</td>
              <td class="px-4 py-2">
                <span :class="[
                  'px-2 py-1 rounded-sm text-xs',
                  run.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  run.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                  run.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-yellow-500/20 text-yellow-400'
                ]">
                  {{ run.status }}
                </span>
              </td>
              <td class="px-4 py-2 text-gray-300">{{ formatTimestamp(run.started_at) }}</td>
              <td class="px-4 py-2 text-gray-300">{{ formatDuration(run.started_at, run.completed_at) }}</td>
              <td class="px-4 py-2 text-gray-300">{{ run.processed }} / {{ run.total }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Export Options -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Export</h3>
      <div class="flex gap-3">
        <button
          @click="exportConfig"
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Export Configuration
        </button>
        <button
          @click="exportLogs"
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Export Logs
        </button>
        <button
          @click="exportMetrics"
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Export Metrics
        </button>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSWR } from '@/composables/useSWR'
import { CACHE_KEYS, CACHE_TTL, POLL_INTERVALS } from '@/constants/cacheKeys'
import api from '@/api'
import {
  getEmbeddingAvailabilityToneClasses,
  normalizeEmbeddingAvailability
} from '@/utils/embeddingAvailabilityUi'

// ============================================
// SWR: RAG stats with 5s polling
// ============================================
const {
  data: ragData,
  isLoading,
  isStale,
  error: swrError,
  refresh
} = useSWR(
  CACHE_KEYS.STATS_RAG,
  async () => {
    const response = await api.getRagDetailed({ hours: 24 })
    
    if (response.error) {
      throw new Error(response.error)
    }
    
    if (!response.stats) {
      throw new Error('Invalid response structure from server')
    }
    
    return {
      stats: {
        totalEmbeddings: response.data.stats.totalEmbeddings || 0,
        pendingCount: response.data.stats.pendingCount || 0,
        failed24h: response.data.stats.totalFailedCount ?? response.data.stats.failedCount ?? 0,
        avgGenerationTime: response.data.stats.avgGenerationTime || 0
      },
      providerOnline: response.data.providerOnline || false,
      embeddingAvailability: normalizeEmbeddingAvailability(response.data.embeddingAvailability),
      providerMetrics: response.data.providerMetrics || {},
      circuitBreaker: response.data.circuitBreaker || {
        state: 'CLOSED',
        failureCount: 0,
        config: { failureThreshold: 5 },
        lastFailureTime: null,
        stateHistory: []
      },
      backfillHistory: response.data.backfillHistory || []
    }
  },
  { ttl: CACHE_TTL.SHORT, pollInterval: POLL_INTERVALS.FAST, pollOnlyWhenVisible: true }
)

// ============================================
// Computed: Template compatibility
// ============================================
const loading = computed(() => isLoading.value && !ragData.value)
const error = computed(() => swrError.value?.message || null)
const stats = computed(() => ragData.value?.stats || {
  totalEmbeddings: 0,
  pendingCount: 0,
  failed24h: 0,
  avgGenerationTime: 0
})
const embeddingAvailability = computed(() => normalizeEmbeddingAvailability(ragData.value?.embeddingAvailability))
const providerMetrics = computed(() => ragData.value?.providerMetrics || {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  retryAttempts: 0,
  avgLatency: 0,
  isModelCold: false,
  errorHistory: [],
  retryHistory: []
})
const circuitBreaker = computed(() => ragData.value?.circuitBreaker || {
  state: 'CLOSED',
  failureCount: 0,
  config: { failureThreshold: 5 },
  lastFailureTime: null,
  stateHistory: []
})
const backfillHistory = computed(() => ragData.value?.backfillHistory || [])
const availabilityToneClasses = computed(() => getEmbeddingAvailabilityToneClasses(embeddingAvailability.value))

// ============================================
// Local state for actions
// ============================================
const warmingUp = ref(false)

const resetCircuitBreaker = async () => {
  if (!confirm('Are you sure you want to reset the circuit breaker?')) {
    return
  }

  try {
    await api.resetRagCircuitBreaker()
    await refresh()
  } catch (err) {
    console.error('Failed to reset circuit breaker:', err)
  }
}

const warmupModel = async () => {
  warmingUp.value = true
  try {
    const response = await api.warmupRagModel()
    if (response.data.success) {
      alert(`Model warmed up successfully in ${response.data.duration}ms`)
      await refresh()
    }
  } catch (err) {
    console.error('Failed to warmup model:', err)
    alert('Failed to warmup model: ' + (err.response?.data?.error || err.message))
  } finally {
    warmingUp.value = false
  }
}

const exportConfig = async () => {
  try {
    const response = await api.exportRagConfig()
    downloadJSON(response.data, 'rag-config.json')
  } catch (error) {
    console.error('Failed to export config:', error)
  }
}

const exportLogs = async () => {
  try {
    const response = await api.exportRagLogs()
    downloadJSON(response.data, 'rag-logs.json')
  } catch (error) {
    console.error('Failed to export logs:', error)
  }
}

const exportMetrics = async () => {
  try {
    const response = await api.exportRagMetrics()
    downloadJSON(response.data, 'rag-metrics.json')
  } catch (error) {
    console.error('Failed to export metrics:', error)
  }
}

const downloadJSON = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const formatNumber = (num) => {
  if (!num) return '0'
  return num.toLocaleString()
}

const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A'
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  })
}

const formatDuration = (start, end) => {
  if (!start) return 'N/A'
  if (!end) return 'In progress'
  
  const diff = new Date(end) - new Date(start)
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}
</script>
