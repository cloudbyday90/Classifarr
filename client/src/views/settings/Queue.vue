<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">Task Queue</h2>
      <p class="text-gray-400 text-sm">Monitor and manage background classification tasks</p>
    </div>

    <!-- Queue Stats -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div class="bg-gray-800 p-4 rounded-lg text-center border border-gray-700">
        <div class="text-2xl font-bold" :class="stats.ollamaAvailable ? 'text-green-400' : 'text-red-400'">
          {{ stats.ollamaAvailable ? '🟢' : '🔴' }}
        </div>
        <div class="text-sm text-gray-400">Ollama</div>
      </div>
      <div class="bg-gray-800 p-4 rounded-lg text-center border border-gray-700">
        <div class="text-2xl font-bold text-blue-400">{{ stats.pending }}</div>
        <div class="text-sm text-gray-400">Pending</div>
      </div>
      <div class="bg-gray-800 p-4 rounded-lg text-center border border-gray-700">
        <div class="text-2xl font-bold text-yellow-400">{{ stats.processing }}</div>
        <div class="text-sm text-gray-400">Processing</div>
      </div>
      <div class="bg-gray-800 p-4 rounded-lg text-center border border-gray-700">
        <div class="text-2xl font-bold text-green-400">{{ stats.completed }}</div>
        <div class="text-sm text-gray-400">Completed</div>
      </div>
      <div class="bg-gray-800 p-4 rounded-lg text-center border border-gray-700">
        <div class="text-2xl font-bold text-red-400">{{ stats.failed }}</div>
        <div class="text-sm text-gray-400">Failed</div>
      </div>
    </div>

    <!-- Ollama Status Alert -->
    <div v-if="!stats.ollamaAvailable" class="bg-red-900/20 border border-red-700 rounded-lg p-4">
      <div class="flex items-center gap-2 text-red-400">
        <span>⚠️</span>
        <span class="font-medium">Ollama is offline</span>
      </div>
      <p class="text-sm text-gray-400 mt-1">
        Tasks are queued and will process automatically when Ollama comes back online.
        Worker polls every 5 seconds.
      </p>
    </div>

    <!-- Pending Tasks -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      <div class="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 class="text-lg font-medium">Pending Tasks</h3>
        <button 
          @click="loadTasks" 
          class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      <div v-if="loading" class="p-8 text-center text-gray-500">
        Loading...
      </div>

      <div v-else-if="tasks.length === 0" class="p-8 text-center text-gray-500">
        No pending tasks
      </div>

      <div v-else class="divide-y divide-gray-700">
        <div 
          v-for="task in tasks" 
          :key="task.id"
          class="p-4 hover:bg-gray-750 transition-colors"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="font-medium">{{ task.title || 'Unknown Title' }}</span>
                <span 
                  :class="[
                    'px-2 py-0.5 text-xs rounded',
                    task.status === 'processing' ? 'bg-yellow-900/30 text-yellow-400' :
                    task.status === 'failed' ? 'bg-red-900/30 text-red-400' :
                    'bg-blue-900/30 text-blue-400'
                  ]"
                >
                  {{ task.status }}
                </span>
              </div>
              <div class="text-sm text-gray-400 mt-1">
                {{ task.task_type }} • Attempt {{ task.attempts }}/{{ task.max_attempts }}
                <span v-if="task.error_message" class="text-red-400">
                  • {{ task.error_message }}
                </span>
              </div>
              <div class="text-xs text-gray-500 mt-1">
                Created: {{ formatDate(task.created_at) }}
                <span v-if="task.next_retry_at && task.status === 'pending'">
                  • Next retry: {{ formatDate(task.next_retry_at) }}
                </span>
              </div>
            </div>
            <div class="flex gap-2">
              <button
                v-if="task.status === 'failed'"
                @click="retryTask(task.id)"
                class="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm transition-colors"
                :disabled="retrying === task.id"
              >
                {{ retrying === task.id ? '...' : '🔄 Retry' }}
              </button>
              <button
                v-if="task.status === 'pending'"
                @click="cancelTask(task.id)"
                class="px-3 py-1 bg-gray-700 hover:bg-red-600 rounded text-sm transition-colors"
                :disabled="cancelling === task.id"
              >
                {{ cancelling === task.id ? '...' : '✕ Cancel' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Queue Info -->
    <div class="text-xs text-gray-500">
      <p>• Worker polls every 5 seconds when Ollama is available</p>
      <p>• Failed tasks retry with exponential backoff: 30s → 1m → 2m → 5m → 10m</p>
      <p>• Tasks are persisted in the database and survive container restarts</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import api from '@/api'

const loading = ref(true)
const stats = ref({
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  ollamaAvailable: true,
  workerRunning: true
})
const tasks = ref([])
const retrying = ref(null)
const cancelling = ref(null)
let pollInterval = null

onMounted(async () => {
  await loadData()
  loading.value = false
  // Poll every 5 seconds
  pollInterval = setInterval(loadData, 5000)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

const loadData = async () => {
  await Promise.all([loadStats(), loadTasks()])
}

const loadStats = async () => {
  try {
    const response = await api.getQueueStats()
    stats.value = response.data
  } catch (error) {
    console.error('Failed to load queue stats:', error)
  }
}

const loadTasks = async () => {
  try {
    const response = await api.getPendingTasks(20)
    tasks.value = response.data
  } catch (error) {
    console.error('Failed to load tasks:', error)
  }
}

const retryTask = async (taskId) => {
  retrying.value = taskId
  try {
    await api.retryTask(taskId)
    await loadTasks()
  } catch (error) {
    console.error('Failed to retry task:', error)
  } finally {
    retrying.value = null
  }
}

const cancelTask = async (taskId) => {
  cancelling.value = taskId
  try {
    await api.cancelTask(taskId)
    await loadTasks()
  } catch (error) {
    console.error('Failed to cancel task:', error)
  } finally {
    cancelling.value = null
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleString()
}
</script>
