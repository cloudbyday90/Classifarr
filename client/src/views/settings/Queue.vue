<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">Queue Settings</h2>
      <p class="text-gray-400 text-sm">Configure task queue processing behavior</p>
    </div>

    <!-- Quick Stats Banner -->
    <div class="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-2">
            <span :class="stats.workerRunning ? 'text-green-400' : 'text-red-400'">●</span>
            <span class="text-sm">Worker {{ stats.workerRunning ? 'Active' : 'Stopped' }}</span>
          </div>
          <div class="text-sm text-gray-400">
            <span class="text-blue-400">{{ stats.pending }}</span> pending · 
            <span class="text-yellow-400">{{ stats.processing }}</span> processing · 
            <span class="text-red-400">{{ stats.failed }}</span> failed
          </div>
        </div>
        <router-link to="/queue" class="text-blue-400 hover:text-blue-300 text-sm">
          View Queue →
        </router-link>
      </div>
    </div>

    <!-- Gap Analysis Progress -->
    <div v-if="gapStats && gapStats.unprocessedCount > 0" class="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <div class="animate-pulse text-blue-400">📊</div>
          <span class="font-medium text-blue-300">Classification Progress</span>
        </div>
        <span class="text-sm text-blue-200">
          {{ gapStats.processedCount }} / {{ gapStats.totalCount }} items ({{ gapStats.percentComplete }}%)
        </span>
      </div>
      <div class="w-full bg-gray-700 rounded-full h-2 mb-2">
        <div 
          class="bg-blue-500 h-2 rounded-full transition-all duration-500"
          :style="{ width: `${gapStats.percentComplete}%` }"
        />
      </div>
      <div class="flex justify-between text-xs text-blue-200/70">
        <span>{{ gapStats.unprocessedCount }} items remaining</span>
        <span>{{ gapStats.estimatedCompletion }} • Batch every {{ gapStats.intervalMinutes }} min ({{ gapStats.batchSize }}/batch)</span>
      </div>
    </div>

    <!-- Worker Settings -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-medium mb-4">Worker Configuration</h3>
      
      <div class="space-y-4">
        <!-- Worker Enabled -->
        <div class="flex items-center justify-between">
          <div>
            <label class="font-medium">Worker Enabled</label>
            <p class="text-sm text-gray-400">Enable or disable the background task worker</p>
          </div>
          <button
            @click="toggleWorker"
            :class="[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              settings.workerEnabled ? 'bg-blue-600' : 'bg-gray-600'
            ]"
          >
            <span
              :class="[
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                settings.workerEnabled ? 'translate-x-6' : 'translate-x-1'
              ]"
            />
          </button>
        </div>

        <!-- Concurrent Workers -->
        <div>
          <label class="block font-medium mb-1">Concurrent Workers</label>
          <p class="text-sm text-gray-400 mb-2">Number of tasks to process simultaneously</p>
          <select
            v-model="settings.concurrentWorkers"
            class="bg-gray-700 border border-gray-600 rounded px-3 py-2 w-32"
          >
            <option :value="1">1</option>
            <option :value="2">2</option>
            <option :value="3">3</option>
            <option :value="5">5</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Retry Settings -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-medium mb-4">Retry Configuration</h3>
      
      <div class="space-y-4">
        <!-- Max Retry Attempts -->
        <div>
          <label class="block font-medium mb-1">Max Retry Attempts</label>
          <p class="text-sm text-gray-400 mb-2">How many times to retry failed tasks before giving up</p>
          <select
            v-model="settings.maxRetryAttempts"
            class="bg-gray-700 border border-gray-600 rounded px-3 py-2 w-32"
          >
            <option :value="3">3</option>
            <option :value="5">5 (default)</option>
            <option :value="10">10</option>
            <option :value="15">15</option>
          </select>
        </div>

        <!-- Retry Strategy -->
        <div>
          <label class="block font-medium mb-1">Retry Strategy</label>
          <p class="text-sm text-gray-400 mb-2">How to space out retry attempts</p>
          <select
            v-model="settings.retryStrategy"
            class="bg-gray-700 border border-gray-600 rounded px-3 py-2 w-48"
          >
            <option value="exponential">Exponential Backoff</option>
            <option value="linear">Linear (fixed delay)</option>
            <option value="aggressive">Aggressive (short delays)</option>
          </select>
          <p class="text-xs text-gray-500 mt-1">
            <template v-if="settings.retryStrategy === 'exponential'">
              Delays: 30s → 1m → 2m → 5m → 10m
            </template>
            <template v-else-if="settings.retryStrategy === 'linear'">
              Fixed 60 second delay between retries
            </template>
            <template v-else>
              Delays: 10s → 20s → 30s → 45s → 60s
            </template>
          </p>
        </div>
      </div>
    </div>

    <!-- Cleanup Settings -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-medium mb-4">Auto-Cleanup</h3>
      
      <div class="space-y-4">
        <!-- Auto-delete completed -->
        <div class="flex items-center justify-between">
          <div>
            <label class="font-medium">Auto-delete Completed Tasks</label>
            <p class="text-sm text-gray-400">Automatically remove tasks after completion</p>
          </div>
          <select
            v-model="settings.autoDeleteCompleted"
            class="bg-gray-700 border border-gray-600 rounded px-3 py-2 w-40"
          >
            <option value="never">Never</option>
            <option value="1d">After 1 day</option>
            <option value="7d">After 7 days</option>
            <option value="30d">After 30 days</option>
            <option value="immediate">Immediately</option>
          </select>
        </div>

        <!-- Auto-delete failed -->
        <div class="flex items-center justify-between">
          <div>
            <label class="font-medium">Auto-delete Failed Tasks</label>
            <p class="text-sm text-gray-400">Automatically remove permanently failed tasks</p>
          </div>
          <select
            v-model="settings.autoDeleteFailed"
            class="bg-gray-700 border border-gray-600 rounded px-3 py-2 w-40"
          >
            <option value="never">Never (default)</option>
            <option value="7d">After 7 days</option>
            <option value="30d">After 30 days</option>
            <option value="90d">After 90 days</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Maintenance Actions -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-medium mb-4">Queue Maintenance</h3>
      
      <div class="flex flex-wrap gap-3">
        <button
          @click="clearCompleted"
          :disabled="actionLoading"
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors disabled:opacity-50"
        >
          🧹 Clear Completed Tasks
        </button>
        <button
          @click="clearFailed"
          :disabled="actionLoading"
          class="px-4 py-2 bg-red-900/50 hover:bg-red-800/50 text-red-300 rounded transition-colors disabled:opacity-50"
        >
          ❌ Clear Failed Tasks
        </button>
        <button
          @click="retryAllFailed"
          :disabled="actionLoading || stats.failed === 0"
          class="px-4 py-2 bg-blue-900/50 hover:bg-blue-800/50 text-blue-300 rounded transition-colors disabled:opacity-50"
        >
          🔄 Retry All Failed ({{ stats.failed }})
        </button>
        <button
          @click="cancelAllPending"
          :disabled="actionLoading || stats.pending === 0"
          class="px-4 py-2 bg-yellow-900/50 hover:bg-yellow-800/50 text-yellow-300 rounded transition-colors disabled:opacity-50"
        >
          ⏹ Cancel All Pending ({{ stats.pending }})
        </button>
      </div>
      
      <p v-if="actionMessage" class="mt-3 text-sm" :class="actionSuccess ? 'text-green-400' : 'text-red-400'">
        {{ actionMessage }}
      </p>
    </div>

    <!-- Advanced Operations -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-medium mb-2">Advanced Operations</h3>
      <p class="text-sm text-gray-400 mb-4">These operations affect classification history and may take a while</p>
      
      <div class="flex flex-wrap gap-3">
        <button
          @click="reprocessCompleted"
          :disabled="actionLoading"
          class="px-4 py-2 bg-purple-900/50 hover:bg-purple-800/50 text-purple-300 rounded transition-colors disabled:opacity-50"
        >
          🔄 Reprocess All Completed
        </button>
        <button
          @click="clearAndResync"
          :disabled="actionLoading"
          class="px-4 py-2 bg-orange-900/50 hover:bg-orange-800/50 text-orange-300 rounded transition-colors disabled:opacity-50"
        >
          🗑️ Clear & Re-sync All
        </button>
      </div>
      
      <div class="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded text-sm">
        <p class="text-yellow-300 font-medium">⚠️ About these actions:</p>
        <ul class="text-yellow-200/80 mt-1 ml-4 list-disc space-y-1">
          <li><strong>Reprocess Completed</strong>: Re-queues all completed classifications using updated rules</li>
          <li><strong>Clear & Re-sync</strong>: Clears all queue data and triggers a fresh library sync</li>
        </ul>
      </div>
    </div>

    <!-- Save Button -->
    <div class="flex justify-end">
      <button
        @click="saveSettings"
        :disabled="saving"
        class="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium transition-colors disabled:opacity-50"
      >
        {{ saving ? 'Saving...' : 'Save Settings' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import api from '@/api'

const loading = ref(true)
const saving = ref(false)
const actionLoading = ref(false)
const actionMessage = ref('')
const actionSuccess = ref(false)

const stats = ref({
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  workerRunning: true
})

const gapStats = ref(null)

const settings = ref({
  workerEnabled: true,
  concurrentWorkers: 1,
  maxRetryAttempts: 5,
  retryStrategy: 'exponential',
  autoDeleteCompleted: '7d',
  autoDeleteFailed: 'never'
})

let pollInterval = null

onMounted(async () => {
  await loadData()
  loading.value = false
  pollInterval = setInterval(loadStats, 5000)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

const loadData = async () => {
  await Promise.all([loadStats(), loadSettings()])
}

const loadStats = async () => {
  try {
    const [queueData, gapData] = await Promise.all([
      api.getQueueStats(),
      api.get('/queue/gap-analysis-stats').then(res => res.data).catch(() => null)
    ])
    stats.value = queueData
    gapStats.value = gapData
  } catch (error) {
    console.error('Failed to load queue stats:', error)
  }
}

const loadSettings = async () => {
  try {
    const response = await api.getSettings('queue')
    if (response.data) {
      settings.value = { ...settings.value, ...response.data }
    }
  } catch (error) {
    console.error('Failed to load queue settings:', error)
  }
}

const saveSettings = async () => {
  saving.value = true
  try {
    await api.updateSettings('queue', settings.value)
    showAction('Settings saved successfully', true)
  } catch (error) {
    showAction('Failed to save settings', false)
    console.error('Failed to save settings:', error)
  } finally {
    saving.value = false
  }
}

const toggleWorker = () => {
  settings.value.workerEnabled = !settings.value.workerEnabled
}

const clearCompleted = async () => {
  actionLoading.value = true
  try {
    const response = await api.clearCompletedTasks()
    showAction(`Cleared ${response.data?.count || 0} completed tasks`, true)
    await loadStats()
  } catch (error) {
    showAction('Failed to clear completed tasks', false)
  } finally {
    actionLoading.value = false
  }
}

const clearFailed = async () => {
  actionLoading.value = true
  try {
    const response = await api.clearFailedTasks()
    showAction(`Cleared ${response.data?.count || 0} failed tasks`, true)
    await loadStats()
  } catch (error) {
    showAction('Failed to clear failed tasks', false)
  } finally {
    actionLoading.value = false
  }
}

const retryAllFailed = async () => {
  actionLoading.value = true
  try {
    const response = await api.retryAllFailedTasks()
    showAction(`Queued ${response.data?.count || 0} tasks for retry`, true)
    await loadStats()
  } catch (error) {
    showAction('Failed to retry tasks', false)
  } finally {
    actionLoading.value = false
  }
}

const cancelAllPending = async () => {
  actionLoading.value = true
  try {
    const response = await api.cancelAllPendingTasks()
    showAction(`Cancelled ${response.data?.count || 0} pending tasks`, true)
    await loadStats()
  } catch (error) {
    showAction('Failed to cancel tasks', false)
  } finally {
    actionLoading.value = false
  }
}

const reprocessCompleted = async () => {
  if (!confirm('This will re-queue all completed classifications for reprocessing with updated rules. Continue?')) {
    return
  }
  actionLoading.value = true
  try {
    const response = await api.reprocessCompleted()
    showAction(`Queued ${response.data?.count || 0} items for reprocessing`, true)
    await loadStats()
  } catch (error) {
    showAction('Failed to reprocess: ' + (error.message || 'Unknown error'), false)
  } finally {
    actionLoading.value = false
  }
}

const clearAndResync = async () => {
  if (!confirm('This will CLEAR ALL queue data and classification history, then trigger a fresh library sync. This action cannot be undone! Continue?')) {
    return
  }
  actionLoading.value = true
  try {
    const response = await api.clearAndResync()
    showAction(`Queue cleared. ${response.data?.itemsReset || 0} items reset for resync.`, true)
    await loadStats()
  } catch (error) {
    showAction('Failed to resync: ' + (error.message || 'Unknown error'), false)
  } finally {
    actionLoading.value = false
  }
}

const showAction = (message, success) => {
  actionMessage.value = message
  actionSuccess.value = success
  setTimeout(() => { actionMessage.value = '' }, 3000)
}
</script>
