<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- Heartbeat Configuration -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Heartbeat & Lock Settings</h3>
      <p class="text-sm text-gray-400 mb-4">
        Configure how the system manages resource contention between classification and embedding.
      </p>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Heartbeat Timeout (ms)
          </label>
          <input
            v-model.number="heartbeat.timeout"
            type="number"
            min="5000"
            max="120000"
            step="1000"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-500">Release lock if no heartbeat received (default: 30000)</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Heartbeat Interval (ms)
          </label>
          <input
            v-model.number="heartbeat.interval"
            type="number"
            min="1000"
            max="30000"
            step="1000"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-500">How often to send heartbeat (default: 5000)</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Max Wait Time (ms)
          </label>
          <input
            v-model.number="heartbeat.maxWait"
            type="number"
            min="10000"
            max="300000"
            step="5000"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-500">Maximum time to wait for lock (default: 60000)</p>
        </div>
      </div>

      <div class="bg-gray-700/30 rounded-lg p-4">
        <h4 class="font-medium text-white mb-2">Current Lock Status</h4>
        <div class="flex items-center gap-6 text-sm">
          <div>
            <span class="text-gray-400">Status:</span>
            <span :class="['ml-2 font-medium', lockStatus.isLocked ? 'text-yellow-400' : 'text-green-400']">
              {{ lockStatus.isLocked ? `Locked by ${lockStatus.lockedBy}` : 'Unlocked' }}
            </span>
          </div>
          <div v-if="lockStatus.isLocked">
            <span class="text-gray-400">Duration:</span>
            <span class="ml-2 text-white">{{ formatDuration(lockStatus.lockDuration) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Real-Time Embeddings -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-white mb-1">Real-Time Embeddings</h3>
          <p class="text-sm text-gray-400">Generate embeddings immediately during classification</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            v-model="backfill.realtime_enabled"
            type="checkbox"
            class="sr-only peer"
          />
          <div class="w-11 h-6 bg-gray-700 peer-focus:outline-hidden peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
    </div>

    <!-- Idle Backfill -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-lg font-semibold text-white mb-1">Idle Backfill</h3>
            <span
              class="text-xs text-gray-500 cursor-help"
              title="Image backfill runs only when image embeddings are enabled."
            >ⓘ</span>
          </div>
          <p class="text-sm text-gray-400">Process embeddings during idle periods</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            v-model="backfill.idle_enabled"
            type="checkbox"
            class="sr-only peer"
          />
          <div class="w-11 h-6 bg-gray-700 peer-focus:outline-hidden peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
      
      <div v-if="backfill.idle_enabled" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Idle Threshold (ms)</label>
          <input
            v-model.number="backfill.idle_threshold"
            type="number"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Batch Size</label>
          <input
            v-model.number="backfill.idle_batch_size"
            type="number"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>

    <!-- Scheduled Backfill -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-lg font-semibold text-white mb-1">Scheduled Backfill</h3>
            <span
              class="text-xs text-gray-500 cursor-help"
              title="Image backfill runs only when image embeddings are enabled."
            >ⓘ</span>
          </div>
          <p class="text-sm text-gray-400">Run large batch backfill on schedule</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            v-model="backfill.scheduled_enabled"
            type="checkbox"
            class="sr-only peer"
          />
          <div class="w-11 h-6 bg-gray-700 peer-focus:outline-hidden peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
      
      <div v-if="backfill.scheduled_enabled" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Time</label>
            <input
              v-model="backfill.scheduled_time"
              type="time"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Batch Size</label>
            <input
              v-model.number="backfill.scheduled_batch_size"
              type="number"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Max Duration (minutes)</label>
          <input
            v-model.number="backfill.scheduled_max_duration_min"
            type="number"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>

    <!-- Manual Backfill -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Manual Backfill</h3>
      
      <div class="flex items-center justify-between mb-4">
        <div>
          <span class="text-gray-400">Pending Embeddings:</span>
          <span class="ml-2 text-2xl font-bold text-white">{{ manualStatus.pending }}</span>
        </div>
        <div class="text-sm text-gray-400">
          <span>Text {{ manualStatus.pendingText }}</span>
          <span class="mx-2 text-gray-600">•</span>
          <span>Image {{ manualStatus.pendingImage }}</span>
        </div>
      </div>

      <div class="flex gap-3 mb-4">
        <button
          @click="startBackfill"
          :disabled="manualStatus.status === 'running'"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start
        </button>
        <button
          @click="pauseBackfill"
          :disabled="manualStatus.status !== 'running'"
          class="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Pause
        </button>
        <button
          @click="resumeBackfill"
          :disabled="manualStatus.status !== 'paused'"
          class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Resume
        </button>
        <button
          @click="clearBackfill"
          :disabled="manualStatus.status === 'running'"
          class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear
        </button>
      </div>

      <div v-if="manualStatus.status !== 'idle'" class="space-y-2">
        <div class="w-full bg-gray-700 rounded-full h-2">
          <div
            class="bg-blue-600 h-2 rounded-full transition-all"
            :style="{ width: manualStatus.progress + '%' }"
          ></div>
        </div>
        <div class="flex justify-between text-sm text-gray-400">
          <span>{{ manualStatus.processed }} / {{ manualStatus.total }}</span>
          <span v-if="manualStatus.eta">ETA: {{ formatETA(manualStatus.eta) }}</span>
        </div>
      </div>
    </div>

    <!-- Save Button -->
    <div class="flex items-center gap-3">
      <button
        @click="saveQueueConfig"
        :disabled="saving"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ saving ? 'Saving...' : 'Save Queue Settings' }}
      </button>
    </div>

    <div v-if="saveMessage" :class="[
      'p-4 rounded-lg',
      saveSuccess ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'
    ]">
      {{ saveMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import api from '@/api'

const heartbeat = ref({
  timeout: 30000,
  interval: 5000,
  maxWait: 60000
})

const backfill = ref({
  realtime_enabled: true,
  idle_enabled: true,
  idle_threshold: 30000,
  idle_batch_size: 10,
  scheduled_enabled: true,
  scheduled_time: '02:00',
  scheduled_batch_size: 100,
  scheduled_max_duration_min: 60
})

const lockStatus = ref({
  isLocked: false,
  lockedBy: '',
  lockDuration: 0
})

const manualStatus = ref({
  status: 'idle',
  processed: 0,
  total: 0,
  pending: 0,
  pendingText: 0,
  pendingImage: 0,
  progress: 0,
  eta: null
})

const saving = ref(false)
const saveMessage = ref('')
const saveSuccess = ref(false)

let statusInterval = null

const loadConfig = async () => {
  try {
    const [heartbeatRes, realtimeRes, idleRes, scheduleRes] = await Promise.all([
      api.get('/settings/heartbeat'),
      api.get('/rag/backfill/realtime'),
      api.get('/rag/backfill/idle'),
      api.get('/rag/backfill/schedule')
    ])

    heartbeat.value = {
      timeout: heartbeatRes.data.heartbeat_timeout || 30000,
      interval: heartbeatRes.data.heartbeat_interval || 5000,
      maxWait: heartbeatRes.data.max_wait_time || 60000
    }

    backfill.value = {
      realtime_enabled: realtimeRes.data.realtime_embedding_enabled ?? true,
      idle_enabled: idleRes.data.idle_backfill_enabled ?? true,
      idle_threshold: idleRes.data.idle_threshold || 30000,
      idle_batch_size: idleRes.data.idle_batch_size || 10,
      scheduled_enabled: scheduleRes.data.scheduled_backfill_enabled || false,
      scheduled_time: scheduleRes.data.scheduled_backfill_time || '02:00',
      scheduled_batch_size: scheduleRes.data.scheduled_backfill_batch_size || 100,
      scheduled_max_duration_min: Math.floor((scheduleRes.data.scheduled_backfill_max_duration || 3600000) / 60000)
    }
  } catch (error) {
    console.error('Failed to load config:', error)
  }
}

const loadManualStatus = async () => {
  try {
    const response = await api.get('/rag/backfill/status')
    const manual = response.data.manual
    const breakdown = response.data.pendingBreakdown || {}

    manualStatus.value = {
      status: manual.status || 'idle',
      processed: manual.processed || 0,
      total: manual.total || 0,
      pending: response.data.pending || 0,
      pendingText: breakdown.text ?? 0,
      pendingImage: breakdown.image ?? 0,
      progress: manual.total > 0 ? (manual.processed / manual.total) * 100 : 0,
      eta: manual.eta || null
    }
  } catch (error) {
    console.error('Failed to load manual status:', error)
  }
}

const startBackfill = async () => {
  try {
    await api.post('/rag/backfill/manual/start', {})
    await loadManualStatus()
  } catch (error) {
    console.error('Failed to start backfill:', error)
  }
}

const pauseBackfill = async () => {
  try {
    await api.post('/rag/backfill/manual/pause')
    await loadManualStatus()
  } catch (error) {
    console.error('Failed to pause backfill:', error)
  }
}

const resumeBackfill = async () => {
  try {
    await api.post('/rag/backfill/manual/resume')
    await loadManualStatus()
  } catch (error) {
    console.error('Failed to resume backfill:', error)
  }
}

const clearBackfill = async () => {
  try {
    await api.post('/rag/backfill/manual/clear')
    await loadManualStatus()
  } catch (error) {
    console.error('Failed to clear backfill:', error)
  }
}

const saveQueueConfig = async () => {
  saving.value = true
  saveMessage.value = ''

  try {
    await Promise.all([
      api.put('/settings/heartbeat', {
        heartbeat_timeout: heartbeat.value.timeout,
        heartbeat_interval: heartbeat.value.interval,
        max_wait_time: heartbeat.value.maxWait
      }),
      api.put('/rag/backfill/realtime', {
        enabled: backfill.value.realtime_enabled
      }),
      api.put('/rag/backfill/idle', {
        enabled: backfill.value.idle_enabled,
        threshold: backfill.value.idle_threshold,
        batchSize: backfill.value.idle_batch_size
      }),
      api.put('/rag/backfill/schedule', {
        enabled: backfill.value.scheduled_enabled,
        time: backfill.value.scheduled_time,
        days: '0,1,2,3,4,5,6',
        batchSize: backfill.value.scheduled_batch_size,
        maxDuration: backfill.value.scheduled_max_duration_min * 60000
      })
    ])

    saveSuccess.value = true
    saveMessage.value = 'Queue settings saved successfully'
  } catch (error) {
    saveSuccess.value = false
    saveMessage.value = error.response?.data?.error || error.message
  } finally {
    saving.value = false
    setTimeout(() => {
      saveMessage.value = ''
    }, 5000)
  }
}

const formatDuration = (ms) => {
  if (!ms) return '0s'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s`
}

const formatETA = (eta) => {
  if (!eta) return 'N/A'
  return formatDuration(eta * 1000)
}

onMounted(() => {
  loadConfig()
  loadManualStatus()
  statusInterval = setInterval(loadManualStatus, 2000)
})

onUnmounted(() => {
  if (statusInterval) {
    clearInterval(statusInterval)
  }
})
</script>
