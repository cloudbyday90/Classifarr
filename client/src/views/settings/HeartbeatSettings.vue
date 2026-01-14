<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <Card title="⏱️ Heartbeat & Queue Configuration">
      <div class="space-y-6">
        <p class="text-gray-300">
          Configure the heartbeat-based locking system that prevents Ollama resource contention between classification and embedding operations.
        </p>

        <div class="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <span class="text-2xl">ℹ️</span>
            <div class="flex-1">
              <h4 class="font-semibold text-blue-400 mb-1">How It Works</h4>
              <ul class="text-sm text-gray-300 list-disc list-inside space-y-1">
                <li>Classification requests always have <strong>priority</strong> over embedding generation</li>
                <li>When using the same Ollama instance, embedding jobs wait for classifications to complete</li>
                <li>Heartbeat timeout prevents deadlocks by releasing stale locks</li>
                <li>Separate Ollama instances or cloud providers can run in parallel</li>
              </ul>
            </div>
          </div>
        </div>

        <form @submit.prevent="saveSettings" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Heartbeat Timeout (ms)
            </label>
            <input
              v-model.number="config.heartbeat_timeout"
              type="number"
              min="5000"
              max="120000"
              step="1000"
              class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="30000"
            />
            <p class="mt-1 text-sm text-gray-400">
              Release lock if no heartbeat received (default: 30000ms / 30 seconds)
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Heartbeat Interval (ms)
            </label>
            <input
              v-model.number="config.heartbeat_interval"
              type="number"
              min="1000"
              max="30000"
              step="1000"
              class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="5000"
            />
            <p class="mt-1 text-sm text-gray-400">
              How often to send heartbeat signals (default: 5000ms / 5 seconds)
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Max Wait Time (ms)
            </label>
            <input
              v-model.number="config.max_wait_time"
              type="number"
              min="10000"
              max="300000"
              step="5000"
              class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="60000"
            />
            <p class="mt-1 text-sm text-gray-400">
              Maximum time to wait for lock before timing out (default: 60000ms / 60 seconds)
            </p>
          </div>

          <div class="flex gap-3">
            <Button type="submit" variant="primary" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save Configuration' }}
            </Button>
            <Button type="button" variant="secondary" @click="loadSettings">
              Reset
            </Button>
          </div>

          <div v-if="saveMessage" :class="[
            'p-3 rounded-lg',
            saveSuccess ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          ]">
            {{ saveMessage }}
          </div>
        </form>
      </div>
    </Card>

    <Card title="🔒 Current Lock Status">
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-gray-800/50 p-4 rounded-lg">
            <div class="text-sm text-gray-400 mb-1">Lock Status</div>
            <div class="text-lg font-semibold" :class="lockStatus.isLocked ? 'text-yellow-400' : 'text-green-400'">
              {{ lockStatus.isLocked ? '🔒 Locked' : '🔓 Unlocked' }}
            </div>
          </div>

          <div class="bg-gray-800/50 p-4 rounded-lg">
            <div class="text-sm text-gray-400 mb-1">Locked By</div>
            <div class="text-lg font-semibold text-white">
              {{ lockStatus.lockedBy || 'N/A' }}
            </div>
          </div>

          <div class="bg-gray-800/50 p-4 rounded-lg">
            <div class="text-sm text-gray-400 mb-1">Lock Duration</div>
            <div class="text-lg font-semibold text-white">
              {{ formatDuration(lockStatus.lockDuration) }}
            </div>
          </div>

          <div class="bg-gray-800/50 p-4 rounded-lg">
            <div class="text-sm text-gray-400 mb-1">Last Heartbeat</div>
            <div class="text-lg font-semibold text-white">
              {{ lockStatus.lastHeartbeat ? formatTime(lockStatus.lastHeartbeat) : 'N/A' }}
            </div>
          </div>
        </div>

        <Button @click="refreshStatus" variant="secondary" size="sm">
          🔄 Refresh Status
        </Button>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'

const config = ref({
  heartbeat_timeout: 30000,
  heartbeat_interval: 5000,
  max_wait_time: 60000
})

const lockStatus = ref({
  isLocked: false,
  lockedBy: null,
  lastHeartbeat: null,
  lockDuration: 0
})

const saving = ref(false)
const saveMessage = ref('')
const saveSuccess = ref(false)

let statusInterval = null

async function loadSettings() {
  try {
    const response = await axios.get('/api/settings/heartbeat')
    if (response.data) {
      config.value = {
        heartbeat_timeout: response.data.heartbeat_timeout || 30000,
        heartbeat_interval: response.data.heartbeat_interval || 5000,
        max_wait_time: response.data.max_wait_time || 60000
      }
    }
  } catch (error) {
    console.error('Failed to load heartbeat settings:', error)
  }
}

async function saveSettings() {
  saving.value = true
  saveMessage.value = ''

  try {
    await axios.put('/api/settings/heartbeat', config.value)
    saveMessage.value = 'Settings saved successfully!'
    saveSuccess.value = true
    
    setTimeout(() => {
      saveMessage.value = ''
    }, 3000)
  } catch (error) {
    saveMessage.value = error.response?.data?.error || 'Failed to save settings'
    saveSuccess.value = false
  } finally {
    saving.value = false
  }
}

async function refreshStatus() {
  try {
    const response = await axios.get('/api/settings/provider-lock/status')
    lockStatus.value = response.data
  } catch (error) {
    console.error('Failed to get lock status:', error)
  }
}

function formatDuration(ms) {
  if (!ms || ms === 0) return '0s'
  
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

function formatTime(timestamp) {
  if (!timestamp) return 'N/A'
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  
  if (seconds < 60) {
    return `${seconds}s ago`
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`
  } else {
    return new Date(timestamp).toLocaleTimeString()
  }
}

onMounted(() => {
  loadSettings()
  refreshStatus()
  
  // Auto-refresh lock status every 5 seconds
  statusInterval = setInterval(refreshStatus, 5000)
})

onUnmounted(() => {
  if (statusInterval) {
    clearInterval(statusInterval)
  }
})
</script>
