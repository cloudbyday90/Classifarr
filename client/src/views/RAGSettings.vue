<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">RAG Settings</h1>
    </div>

    <!-- Tab Navigation -->
    <div class="border-b border-gray-700">
      <nav class="-mb-px flex space-x-8">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="[
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === tab.id
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
          ]"
        >
          <span class="mr-2">{{ tab.icon }}</span>
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Status Bar -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
      <div class="flex items-center justify-between text-sm">
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-2">
            <span :class="['w-2 h-2 rounded-full', statusBar.providerOnline ? 'bg-green-500' : 'bg-red-500']"></span>
            <span class="text-gray-400">Provider:</span>
            <span :class="statusBar.providerOnline ? 'text-green-400' : 'text-red-400'">
              {{ statusBar.providerOnline ? 'Online' : 'Offline' }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span :class="['w-2 h-2 rounded-full', statusBar.heartbeatActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500']"></span>
            <span class="text-gray-400">Heartbeat:</span>
            <span :class="statusBar.heartbeatActive ? 'text-green-400' : 'text-gray-400'">
              {{ statusBar.heartbeatActive ? 'Active' : 'Inactive' }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-gray-400">📊 Queue:</span>
            <span class="text-white">{{ statusBar.queueLength }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-gray-400">📁 Total:</span>
            <span class="text-white">{{ formatNumber(statusBar.totalEmbeddings) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab Content -->
    <component :is="currentTabComponent" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '@/api'
import OverviewTab from './rag/OverviewTab.vue'
import BackfillTab from './rag/BackfillTab.vue'
import AdvancedTab from './rag/AdvancedTab.vue'

const activeTab = ref('overview')

const tabs = [
  { id: 'overview', label: 'Overview', icon: '📊', component: OverviewTab },
  { id: 'backfill', label: 'Backfill', icon: '⏱️', component: BackfillTab },
  { id: 'advanced', label: 'Advanced', icon: '⚙️', component: AdvancedTab }
]

const currentTabComponent = computed(() => {
  return tabs.find(t => t.id === activeTab.value)?.component
})

const statusBar = ref({
  providerOnline: false,
  heartbeatActive: false,
  queueLength: 0,
  totalEmbeddings: 0
})

let statusInterval = null

const loadStatusBar = async () => {
  try {
    const [statusRes, backfillRes] = await Promise.all([
      api.get('/api/rag/status'),
      api.get('/api/rag/backfill/status')
    ])

    statusBar.value = {
      providerOnline: statusRes.data.circuitBreaker?.state !== 'OPEN',
      heartbeatActive: true, // TODO: Get from heartbeat service
      queueLength: backfillRes.data.pending || 0,
      totalEmbeddings: statusRes.data.stats?.total || 0
    }
  } catch (error) {
    console.error('Failed to load status bar:', error)
  }
}

const formatNumber = (num) => {
  if (!num) return '0'
  return num.toLocaleString()
}

onMounted(() => {
  loadStatusBar()
  // Refresh status every 5 seconds
  statusInterval = setInterval(loadStatusBar, 5000)
})

onUnmounted(() => {
  if (statusInterval) {
    clearInterval(statusInterval)
  }
})
</script>
