<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">Rating Normalization</h2>
      <p class="text-gray-400 text-sm">Standardize age-based and international ratings to MPAA/TV standards</p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-gray-400 text-sm">Needs Normalization</span>
          <span class="text-2xl">🔄</span>
        </div>
        <div class="text-3xl font-bold text-yellow-400">{{ stats.needsNormalization }}</div>
        <div class="text-xs text-gray-500 mt-1">Items with age-based ratings</div>
      </div>

      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-gray-400 text-sm">Already Normalized</span>
          <span class="text-2xl">✅</span>
        </div>
        <div class="text-3xl font-bold text-green-400">{{ stats.alreadyNormalized }}</div>
        <div class="text-xs text-gray-500 mt-1">Ratings preserved</div>
      </div>

      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-gray-400 text-sm">In Queue</span>
          <span class="text-2xl">⏳</span>
        </div>
        <div class="text-3xl font-bold text-blue-400">{{ stats.queuedTasks }}</div>
        <div class="text-xs text-gray-500 mt-1">Processing now</div>
      </div>

      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-gray-400 text-sm">Failed</span>
          <span class="text-2xl">❌</span>
        </div>
        <div class="text-3xl font-bold text-red-400">{{ stats.failedTasks }}</div>
        <div class="text-xs text-gray-500 mt-1">Errors</div>
      </div>
    </div>

    <!-- Progress Bar (shown when processing) -->
    <div v-if="stats.queuedTasks > 0" class="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <div class="animate-pulse text-blue-400">🔄</div>
          <span class="font-medium text-blue-300">Normalization in Progress</span>
        </div>
        <span class="text-sm text-blue-200">
          {{ stats.alreadyNormalized }} / {{ totalItems }} items ({{ progressPercent }}%)
        </span>
      </div>
      <div class="w-full bg-gray-700 rounded-full h-2 mb-2">
        <div 
          class="bg-blue-500 h-2 rounded-full transition-all duration-500"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
      <div class="text-xs text-blue-200/70">
        {{ stats.queuedTasks }} tasks in queue • Auto-refreshing every 5 seconds
      </div>
    </div>

    <!-- Actions -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-medium mb-4">Actions</h3>
      
      <div class="space-y-4">
        <!-- Normalize All Button -->
        <div class="flex items-center justify-between">
          <div>
            <label class="font-medium">Normalize All Ratings</label>
            <p class="text-sm text-gray-400">Queue all items with age-based or non-standard ratings for normalization</p>
          </div>
          <button
            @click="startBackfill"
            :disabled="isProcessing || stats.needsNormalization === 0"
            :class="[
              'px-4 py-2 rounded-sm font-medium transition-colors',
              isProcessing || stats.needsNormalization === 0
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            ]"
          >
            {{ isProcessing ? 'Processing...' : `Normalize ${stats.needsNormalization} Ratings` }}
          </button>
        </div>

        <!-- Refresh Stats Button -->
        <div class="flex items-center justify-between">
          <div>
            <label class="font-medium">Refresh Status</label>
            <p class="text-sm text-gray-400">Manually refresh normalization statistics</p>
          </div>
          <button
            @click="fetchStats"
            :disabled="isRefreshing"
            :class="[
              'px-4 py-2 rounded-sm font-medium transition-colors',
              isRefreshing
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            ]"
          >
            {{ isRefreshing ? 'Refreshing...' : 'Refresh Status' }}
          </button>
        </div>

        <!-- Finalize Button (shown after processing completes) -->
        <div v-if="stats.alreadyNormalized > 0 && stats.queuedTasks === 0 && stats.needsNormalization === 0" class="flex items-center justify-between">
          <div>
            <label class="font-medium">Regenerate Library Profiles</label>
            <p class="text-sm text-gray-400">Update library profiles with normalized ratings for better classification</p>
          </div>
          <button
            @click="finalize"
            :disabled="isFinalizing"
            :class="[
              'px-4 py-2 rounded-sm font-medium transition-colors',
              isFinalizing
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            ]"
          >
            {{ isFinalizing ? 'Regenerating...' : 'Regenerate Profiles' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Rating Mapping Examples -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-medium mb-4">Rating Mappings</h3>
      <p class="text-sm text-gray-400 mb-4">Examples of how ratings are normalized:</p>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="bg-gray-700/50 rounded-sm p-3">
          <div class="text-xs text-gray-400 mb-1">Age-based (Movies)</div>
          <div class="flex items-center gap-2">
            <span class="text-yellow-400 font-mono">13</span>
            <span class="text-gray-500">→</span>
            <span class="text-green-400 font-mono">PG-13</span>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-yellow-400 font-mono">16</span>
            <span class="text-gray-500">→</span>
            <span class="text-green-400 font-mono">R</span>
          </div>
        </div>

        <div class="bg-gray-700/50 rounded-sm p-3">
          <div class="text-xs text-gray-400 mb-1">UK Ratings</div>
          <div class="flex items-center gap-2">
            <span class="text-yellow-400 font-mono">U</span>
            <span class="text-gray-500">→</span>
            <span class="text-green-400 font-mono">G</span>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-yellow-400 font-mono">12A</span>
            <span class="text-gray-500">→</span>
            <span class="text-green-400 font-mono">PG-13</span>
          </div>
        </div>

        <div class="bg-gray-700/50 rounded-sm p-3">
          <div class="text-xs text-gray-400 mb-1">German (FSK)</div>
          <div class="flex items-center gap-2">
            <span class="text-yellow-400 font-mono">FSK 12</span>
            <span class="text-gray-500">→</span>
            <span class="text-green-400 font-mono">PG-13</span>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-yellow-400 font-mono">FSK 16</span>
            <span class="text-gray-500">→</span>
            <span class="text-green-400 font-mono">R</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Success/Error Messages -->
    <div v-if="successMessage" class="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
      <div class="flex items-center gap-2 text-green-300">
        <span>✅</span>
        <span>{{ successMessage }}</span>
      </div>
    </div>

    <div v-if="errorMessage" class="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
      <div class="flex items-center gap-2 text-red-300">
        <span>❌</span>
        <span>{{ errorMessage }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '@/api'

const stats = ref({
  needsNormalization: 0,
  alreadyNormalized: 0,
  queuedTasks: 0,
  failedTasks: 0
})

const isProcessing = ref(false)
const isRefreshing = ref(false)
const isFinalizing = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
let pollInterval = null

const totalItems = computed(() => {
  return stats.value.needsNormalization + stats.value.alreadyNormalized
})

const progressPercent = computed(() => {
  if (totalItems.value === 0) return 0
  return Math.round((stats.value.alreadyNormalized / totalItems.value) * 100)
})

async function fetchStats() {
  isRefreshing.value = true
  try {
    const response = await api.get('/rating-normalization/stats')
    stats.value = response.data
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    errorMessage.value = 'Failed to fetch statistics'
    setTimeout(() => { errorMessage.value = '' }, 5000)
  } finally {
    isRefreshing.value = false
  }
}

async function startBackfill() {
  if (stats.value.needsNormalization === 0) return
  
  isProcessing.value = true
  successMessage.value = ''
  errorMessage.value = ''
  
  try {
    const response = await api.post('/rating-normalization/backfill')
    if (response.data.success) {
      successMessage.value = `Successfully queued ${response.data.queued} items for normalization`
      setTimeout(() => { successMessage.value = '' }, 5000)
      
      // Start polling for progress
      startPolling()
      
      // Refresh stats
      await fetchStats()
    }
  } catch (error) {
    console.error('Failed to start backfill:', error)
    errorMessage.value = 'Failed to start normalization'
    setTimeout(() => { errorMessage.value = '' }, 5000)
  } finally {
    isProcessing.value = false
  }
}

async function finalize() {
  isFinalizing.value = true
  successMessage.value = ''
  errorMessage.value = ''
  
  try {
    const response = await api.post('/rating-normalization/finalize')
    if (response.data.success) {
      successMessage.value = 'Library profiles successfully regenerated'
      setTimeout(() => { successMessage.value = '' }, 5000)
    } else {
      errorMessage.value = response.data.message || 'Normalization not complete yet'
      setTimeout(() => { errorMessage.value = '' }, 5000)
    }
  } catch (error) {
    console.error('Failed to finalize:', error)
    errorMessage.value = 'Failed to regenerate profiles'
    setTimeout(() => { errorMessage.value = '' }, 5000)
  } finally {
    isFinalizing.value = false
  }
}

function startPolling() {
  if (pollInterval) return
  
  pollInterval = setInterval(async () => {
    await fetchStats()
    
    // Stop polling if no tasks in queue
    if (stats.value.queuedTasks === 0) {
      stopPolling()
    }
  }, 5000) // Poll every 5 seconds
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

onMounted(async () => {
  await fetchStats()
  
  // Start polling if tasks are already in queue
  if (stats.value.queuedTasks > 0) {
    startPolling()
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>
