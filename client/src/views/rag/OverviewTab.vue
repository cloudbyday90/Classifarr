<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
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
            <p :class="['text-2xl font-bold mt-1', providerOnline ? 'text-green-400' : 'text-red-400']">
              {{ providerOnline ? 'Online' : 'Offline' }}
            </p>
          </div>
          <span :class="['text-3xl', providerOnline ? 'text-green-400' : 'text-red-400']">
            {{ providerOnline ? '✓' : '✗' }}
          </span>
        </div>
      </div>

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
            <p :class="['text-2xl font-bold mt-1', stats.failedCount > 0 ? 'text-red-400' : 'text-green-400']">
              {{ formatNumber(stats.failedCount) }}
            </p>
          </div>
          <span :class="['text-3xl', stats.failedCount > 0 ? 'text-red-400' : 'text-green-400']">
            {{ stats.failedCount > 0 ? '⚠️' : '✓' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Quick Stats</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <p class="text-sm text-gray-400">Provider Mode</p>
          <p class="text-white font-medium mt-1">{{ config.embedding_provider_mode || 'same' }}</p>
        </div>
        <div>
          <p class="text-sm text-gray-400">Current Model</p>
          <p class="text-white font-medium mt-1">{{ currentModel || 'N/A' }}</p>
        </div>
        <div>
          <p class="text-sm text-gray-400">Avg Generation Time</p>
          <p class="text-white font-medium mt-1">{{ stats.avgGenerationTime }}ms</p>
        </div>
        <div>
          <p class="text-sm text-gray-400">Last Embedding</p>
          <p class="text-white font-medium mt-1">{{ formatTime(stats.lastEmbeddingTime) }}</p>
        </div>
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
            'w-2 h-2 rounded-full flex-shrink-0',
            item.level === 'error' ? 'bg-red-500' : item.level === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
          ]"></span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-400">{{ formatTimestamp(item.created_at) }}</span>
              <span class="text-xs px-2 py-0.5 bg-gray-600 rounded">{{ item.type }}</span>
            </div>
            <p class="text-sm text-white truncate">{{ item.message }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/api'

const loading = ref(true)
const providerOnline = ref(false)
const stats = ref({
  totalEmbeddings: 0,
  pendingCount: 0,
  failedCount: 0,
  avgGenerationTime: 0,
  lastEmbeddingTime: null
})
const config = ref({})
const currentModel = ref('')
const recentActivity = ref([])

const loadOverview = async () => {
  try {
    loading.value = true
    const response = await api.get('/api/rag/overview')
    
    providerOnline.value = response.data.providerOnline
    stats.value = response.data.stats
    config.value = response.data.config
    currentModel.value = response.data.currentModel
    recentActivity.value = response.data.recentActivity || []
  } catch (error) {
    console.error('Failed to load overview:', error)
  } finally {
    loading.value = false
  }
}

const formatNumber = (num) => {
  if (!num) return '0'
  return num.toLocaleString()
}

const formatTime = (time) => {
  if (!time) return 'Never'
  const date = new Date(time)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const formatTimestamp = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

onMounted(() => {
  loadOverview()
})
</script>
