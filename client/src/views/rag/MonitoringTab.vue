<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- Live Status Bar -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="flex items-center gap-3">
          <span :class="['w-3 h-3 rounded-full', providerStatus.online ? 'bg-green-500' : 'bg-red-500']"></span>
          <div>
            <p class="text-xs text-gray-400">Provider</p>
            <p :class="['font-medium', providerStatus.online ? 'text-green-400' : 'text-red-400']">
              {{ providerStatus.online ? 'Online' : 'Offline' }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span :class="['w-3 h-3 rounded-full', heartbeatStatus.active ? 'bg-green-500 animate-pulse' : 'bg-gray-500']"></span>
          <div>
            <p class="text-xs text-gray-400">Heartbeat</p>
            <p :class="['font-medium', heartbeatStatus.active ? 'text-green-400' : 'text-gray-400']">
              {{ heartbeatStatus.active ? 'Active' : 'Inactive' }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-xl">📊</span>
          <div>
            <p class="text-xs text-gray-400">Queue</p>
            <p class="font-medium text-white">{{ queueStatus.length }} items</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-xl">🔒</span>
          <div>
            <p class="text-xs text-gray-400">Lock</p>
            <p class="font-medium text-white">{{ lockStatus.isLocked ? lockStatus.lockedBy : 'None' }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Circuit Breaker Status -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
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

    <!-- Enhanced Metrics Grid -->
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
                  'px-2 py-1 rounded text-xs',
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

    <!-- Metrics Grid (Legacy - Keep for backward compat) -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Metrics (Last 24 Hours)</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="bg-gray-700/30 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-2xl">➕</span>
            <span class="text-2xl font-bold text-white">{{ formatNumber(metrics.generated) }}</span>
          </div>
          <p class="text-sm text-gray-400">Embeddings Generated</p>
        </div>

        <div class="bg-gray-700/30 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-2xl">⏱️</span>
            <span class="text-2xl font-bold text-white">{{ metrics.avgTime }}ms</span>
          </div>
          <p class="text-sm text-gray-400">Avg Generation Time</p>
        </div>

        <div class="bg-gray-700/30 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-2xl">✓</span>
            <span class="text-2xl font-bold text-green-400">{{ metrics.successRate }}%</span>
          </div>
          <p class="text-sm text-gray-400">Success Rate</p>
        </div>

        <div class="bg-gray-700/30 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-2xl">⚠️</span>
            <span :class="['text-2xl font-bold', metrics.errors > 0 ? 'text-red-400' : 'text-green-400']">
              {{ formatNumber(metrics.errors) }}
            </span>
          </div>
          <p class="text-sm text-gray-400">Errors</p>
        </div>

        <div class="bg-gray-700/30 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-2xl">⚡</span>
            <span class="text-2xl font-bold text-yellow-400">{{ formatNumber(metrics.cacheHits) }}</span>
          </div>
          <p class="text-sm text-gray-400">Cache Hits</p>
        </div>

        <div class="bg-gray-700/30 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-2xl">📈</span>
            <span class="text-2xl font-bold text-white">{{ formatNumber(metrics.totalRequests) }}</span>
          </div>
          <p class="text-sm text-gray-400">Total Requests</p>
        </div>
      </div>
    </div>

    <!-- Log Viewer -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-white">Activity Log</h3>
        <div class="flex gap-2">
          <select
            v-model="logFilter.level"
            class="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
          <select
            v-model="logFilter.type"
            class="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="embedding">Embedding</option>
            <option value="backfill">Backfill</option>
            <option value="provider">Provider</option>
          </select>
          <button
            @click="refreshLogs"
            class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors"
          >
            Refresh
          </button>
          <button
            @click="clearLogs"
            class="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm text-white transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      <div class="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
        <div v-if="loading" class="text-center py-8 text-gray-400">
          Loading logs...
        </div>
        <div v-else-if="filteredLogs.length === 0" class="text-center py-8 text-gray-400">
          No logs found
        </div>
        <div v-else class="space-y-1 font-mono text-xs">
          <div
            v-for="log in filteredLogs"
            :key="log.id"
            :class="[
              'p-2 rounded flex items-start gap-2',
              log.level === 'error' ? 'bg-red-900/20 text-red-400' :
              log.level === 'warning' ? 'bg-yellow-900/20 text-yellow-400' :
              'bg-gray-800 text-gray-300'
            ]"
          >
            <span class="text-gray-500 flex-shrink-0">{{ formatTimestamp(log.created_at) }}</span>
            <span :class="[
              'px-1.5 py-0.5 rounded flex-shrink-0',
              log.level === 'error' ? 'bg-red-500/20' :
              log.level === 'warning' ? 'bg-yellow-500/20' :
              'bg-blue-500/20'
            ]">
              {{ log.level.toUpperCase() }}
            </span>
            <span class="px-1.5 py-0.5 bg-gray-700 rounded flex-shrink-0">{{ log.type }}</span>
            <span class="flex-1">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Backfill History -->
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
                  'px-2 py-1 rounded text-xs',
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import api from '@/api'

const loading = ref(false)

const providerStatus = ref({ online: false })
const heartbeatStatus = ref({ active: false })
const queueStatus = ref({ length: 0 })
const lockStatus = ref({ isLocked: false, lockedBy: '' })

const metrics = ref({
  generated: 0,
  avgTime: 0,
  successRate: 0,
  errors: 0,
  cacheHits: 0,
  totalRequests: 0
})

const logFilter = ref({
  level: 'all',
  type: 'all'
})

const logs = ref([])
const backfillHistory = ref([])
const circuitBreaker = ref({
  state: 'CLOSED',
  failureCount: 0,
  config: { failureThreshold: 5 },
  lastFailureTime: null,
  stateHistory: []
})
const providerMetrics = ref({
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  retryAttempts: 0,
  avgLatency: 0,
  isModelCold: false,
  errorHistory: [],
  retryHistory: []
})
const warmingUp = ref(false)

let statusInterval = null

const filteredLogs = computed(() => {
  return logs.value.filter(log => {
    if (logFilter.value.level !== 'all' && log.level !== logFilter.value.level) {
      return false
    }
    if (logFilter.value.type !== 'all' && log.type !== logFilter.value.type) {
      return false
    }
    return true
  })
})

const loadStatus = async () => {
  try {
    const [statusRes, backfillRes] = await Promise.all([
      api.get('/api/rag/status'),
      api.get('/api/rag/backfill/status')
    ])

    providerStatus.value = {
      online: statusRes.data.circuitBreaker?.state !== 'OPEN'
    }

    heartbeatStatus.value = { active: true }
    queueStatus.value = { length: backfillRes.data.pending || 0 }
    lockStatus.value = { isLocked: false, lockedBy: 'None' }
  } catch (error) {
    console.error('Failed to load status:', error)
  }
}

const loadMetrics = async () => {
  try {
    const [metricsRes, circuitRes] = await Promise.all([
      api.get('/api/rag/metrics', { params: { hours: 24 } }),
      api.get('/api/rag/circuit-breaker')
    ])
    
    // Calculate aggregated metrics
    const embedding = metricsRes.data.embedding_generation || {}
    metrics.value = {
      generated: embedding.total_count || 0,
      avgTime: Math.round(embedding.avg_duration_ms || 0),
      successRate: embedding.success_rate ? Math.round(embedding.success_rate * 100) : 100,
      errors: embedding.error_count || 0,
      cacheHits: 0,
      totalRequests: embedding.total_count || 0
    }

    // Provider metrics
    if (metricsRes.data && metricsRes.data.provider) {
      providerMetrics.value = metricsRes.data.provider
    } else {
      console.error('Metrics response missing provider metrics:', metricsRes.data)
      providerMetrics.value = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        retryAttempts: 0,
        avgLatency: 0,
        isModelCold: false,
        errorHistory: [],
        retryHistory: []
      }
    }

    // Circuit breaker status
    circuitBreaker.value = circuitRes.data
  } catch (error) {
    console.error('Failed to load metrics:', error)
  }
}

const loadLogs = async () => {
  try {
    loading.value = true
    const response = await api.get('/api/rag/logs', {
      params: {
        limit: 100,
        level: logFilter.value.level === 'all' ? undefined : logFilter.value.level,
        type: logFilter.value.type === 'all' ? undefined : logFilter.value.type
      }
    })
    logs.value = response.data.logs || []
  } catch (error) {
    console.error('Failed to load logs:', error)
  } finally {
    loading.value = false
  }
}

const loadBackfillHistory = async () => {
  try {
    const response = await api.get('/api/rag/backfill/history')
    backfillHistory.value = response.data.history || []
  } catch (error) {
    console.error('Failed to load backfill history:', error)
  }
}

const refreshLogs = () => {
  loadLogs()
}

const clearLogs = async () => {
  if (!confirm('Are you sure you want to clear all logs?')) {
    return
  }

  try {
    await api.delete('/api/rag/logs')
    await loadLogs()
  } catch (error) {
    console.error('Failed to clear logs:', error)
    alert('Failed to clear logs: ' + (error.response?.data?.error || error.message))
  }
}

const exportConfig = async () => {
  try {
    const response = await api.post('/api/rag/export/config')
    downloadJSON(response.data, 'rag-config.json')
  } catch (error) {
    console.error('Failed to export config:', error)
  }
}

const exportLogs = async () => {
  try {
    const response = await api.post('/api/rag/export/logs')
    downloadJSON(response.data, 'rag-logs.json')
  } catch (error) {
    console.error('Failed to export logs:', error)
  }
}

const exportMetrics = async () => {
  try {
    const response = await api.post('/api/rag/export/metrics')
    downloadJSON(response.data, 'rag-metrics.json')
  } catch (error) {
    console.error('Failed to export metrics:', error)
  }
}

const resetCircuitBreaker = async () => {
  if (!confirm('Are you sure you want to reset the circuit breaker?')) {
    return
  }

  try {
    await api.post('/api/rag/circuit-breaker/reset')
    await loadMetrics()
    // Show success message in UI instead of alert
    console.log('Circuit breaker reset successfully')
  } catch (error) {
    console.error('Failed to reset circuit breaker:', error)
    // Error will be visible in the UI through the metrics reload failure
  }
}

const warmupModel = async () => {
  warmingUp.value = true
  try {
    const response = await api.post('/api/rag/warmup')
    if (response.data.success) {
      alert(`Model warmed up successfully in ${response.data.duration}ms`)
      await loadMetrics()
    }
  } catch (error) {
    console.error('Failed to warmup model:', error)
    alert('Failed to warmup model: ' + (error.response?.data?.error || error.message))
  } finally {
    warmingUp.value = false
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
  // Use toLocaleString with options to show timezone
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

watch(() => logFilter.value.level, loadLogs)
watch(() => logFilter.value.type, loadLogs)

onMounted(() => {
  loadStatus()
  loadMetrics()
  loadLogs()
  loadBackfillHistory()
  
  statusInterval = setInterval(() => {
    loadStatus()
    loadMetrics()
  }, 5000)
})

onUnmounted(() => {
  if (statusInterval) {
    clearInterval(statusInterval)
  }
})
</script>
