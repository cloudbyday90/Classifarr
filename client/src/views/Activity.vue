<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold mb-2">📊 Live Activity</h1>
        <p class="text-gray-400">Real-time monitoring dashboard</p>
      </div>
      <div class="flex items-center space-x-2">
        <span class="relative flex h-3 w-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
        </span>
        <span class="text-sm text-gray-400">Live • {{ refreshInterval }}s refresh</span>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <!-- Classified Today -->
      <div class="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-xl p-4">
        <div class="text-3xl font-bold text-blue-400">{{ stats.classifiedToday }}</div>
        <div class="text-sm text-gray-400">Classified Today</div>
      </div>

      <!-- Average Confidence -->
      <div class="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 rounded-xl p-4">
        <div class="text-3xl font-bold text-green-400">{{ stats.avgConfidence }}%</div>
        <div class="text-sm text-gray-400">Avg Confidence</div>
      </div>

      <!-- Queue Pending -->
      <div class="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 border border-yellow-500/30 rounded-xl p-4">
        <div class="text-3xl font-bold text-yellow-400">{{ stats.queuePending }}</div>
        <div class="text-sm text-gray-400">Queue Pending</div>
      </div>

      <!-- System Health -->
      <div class="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-xl p-4">
        <div class="flex items-center space-x-2">
          <span v-if="stats.health.ollama && stats.health.worker" class="text-2xl">✅</span>
          <span v-else-if="stats.health.ollama || stats.health.worker" class="text-2xl">⚠️</span>
          <span v-else class="text-2xl">❌</span>
          <span class="text-lg font-bold" :class="healthColor">{{ healthStatus }}</span>
        </div>
        <div class="text-sm text-gray-400">System Health</div>
      </div>
    </div>

    <!-- Gap Analysis Progress -->
    <Card v-if="stats.gapAnalysis?.unprocessedItems > 0">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Classification Progress</h2>
          <span class="text-sm text-gray-400">{{ stats.gapAnalysis.progressPercent }}%</span>
        </div>
      </template>
      
      <div class="space-y-3">
        <!-- Progress Bar -->
        <div class="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
          <div 
            class="h-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            :style="{ width: `${stats.gapAnalysis.progressPercent}%` }"
          ></div>
        </div>
        
        <!-- Stats -->
        <div class="flex justify-between text-sm text-gray-400">
          <span>{{ formatNumber(stats.gapAnalysis.processedItems) }} / {{ formatNumber(stats.gapAnalysis.totalItems) }} items</span>
          <span>{{ stats.gapAnalysis.unprocessedItems }} remaining</span>
        </div>
        
        <div class="flex justify-between text-sm text-gray-400">
          <span>Batch size: {{ stats.gapAnalysis.batchSize }} • Every {{ stats.gapAnalysis.batchIntervalMinutes }} min</span>
          <span v-if="stats.gapAnalysis.estimatedMinutes">~{{ stats.gapAnalysis.estimatedMinutes }} min remaining</span>
        </div>
      </div>
    </Card>

    <!-- Ollama AI Status -->
    <Card v-if="ollamaStatus.isActive">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="text-xl">🤖</span>
            <h2 class="text-lg font-semibold">AI Generation in Progress</h2>
          </div>
          <span class="relative flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
          </span>
        </div>
      </template>
      
      <div class="flex items-center justify-between p-3 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg">
        <div class="space-y-1">
          <div class="font-medium text-purple-300">{{ ollamaStatus.itemTitle }}</div>
          <div class="text-sm text-gray-400">
            Model: <span class="text-blue-300">{{ ollamaStatus.model }}</span>
          </div>
        </div>
        <div class="text-right">
          <div class="text-2xl font-bold text-purple-400">{{ ollamaStatus.tokenCount }}</div>
          <div class="text-sm text-gray-400">tokens • {{ ollamaStatus.elapsedSeconds }}s</div>
        </div>
      </div>
    </Card>

    <!-- Live Activity Stream -->
    <Card>
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <h2 class="text-xl font-semibold">Live Activity Stream</h2>
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </div>
          <Button variant="secondary" size="sm" @click="refreshData">
            <ArrowPathIcon class="w-4 h-4 mr-1" :class="{ 'animate-spin': loading }" />
            Refresh
          </Button>
        </div>
      </template>

      <div v-if="loading && !activityFeed.length" class="text-center py-8">
        <Spinner />
        <p class="text-gray-400 mt-2">Loading activity...</p>
      </div>

      <div v-else-if="activityFeed.length === 0" class="text-center py-8 text-gray-400">
        <DocumentTextIcon class="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No recent activity in the last 24 hours</p>
      </div>

      <div v-else class="space-y-2 max-h-[500px] overflow-y-auto">
        <TransitionGroup name="feed">
          <div 
            v-for="item in activityFeed"
            :key="item.id"
            class="p-3 bg-background-light rounded-lg border border-gray-700/50 hover:border-gray-600 transition-all"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <!-- Method Icon -->
                <span class="text-lg">{{ getMethodIcon(item.method) }}</span>
                
                <!-- Content -->
                <div>
                  <div class="flex items-center space-x-2">
                    <span class="font-medium">{{ item.title }}</span>
                    <Badge :variant="item.confidence >= 80 ? 'success' : item.confidence >= 60 ? 'warning' : 'error'" size="sm">
                      {{ item.confidence }}%
                    </Badge>
                  </div>
                  <div class="text-sm text-gray-400">
                    {{ item.mediaType }} → {{ item.library || 'Unknown' }}
                    <span class="text-gray-500"> • {{ formatMethod(item.method) }}</span>
                  </div>
                </div>
              </div>
              
              <span class="text-sm text-gray-500">{{ formatTimeAgo(item.timestamp) }}</span>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </Card>

    <!-- Processing Queue -->
    <Card v-if="processingQueue.length > 0">
      <template #header>
        <h2 class="text-lg font-semibold">Currently Processing</h2>
      </template>
      
      <div class="space-y-2">
        <div 
          v-for="item in processingQueue"
          :key="item.id"
          class="flex items-center justify-between p-3 bg-background-light rounded-lg"
        >
          <div class="flex items-center space-x-3">
            <Spinner class="w-4 h-4" />
            <span>{{ item.title || 'Processing...' }}</span>
          </div>
          <span class="text-sm text-gray-400">{{ formatTimeAgo(item.created_at) }}</span>
        </div>
      </div>
    </Card>

    <!-- Last Updated -->
    <div class="text-center text-xs text-gray-500">
      Last updated: {{ lastUpdated }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { DocumentTextIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'
import Card from '@/components/common/Card.vue'
import Badge from '@/components/common/Badge.vue'
import Button from '@/components/common/Button.vue'
import Spinner from '@/components/common/Spinner.vue'
import api from '@/api'

const refreshInterval = 2 // seconds
const loading = ref(true)
const lastUpdated = ref('')
let refreshTimer = null

const stats = ref({
  classifiedToday: 0,
  avgConfidence: 0,
  queuePending: 0,
  health: { ollama: false, worker: false, database: true },
  gapAnalysis: null
})

const ollamaStatus = ref({
  isActive: false,
  model: null,
  tokenCount: 0,
  elapsedSeconds: 0,
  itemTitle: null
})

const activityFeed = ref([])
const processingQueue = ref([])

const healthStatus = computed(() => {
  if (stats.value.health.ollama && stats.value.health.worker) return 'All Systems OK'
  if (stats.value.health.ollama || stats.value.health.worker) return 'Partial'
  return 'Offline'
})

const healthColor = computed(() => {
  if (stats.value.health.ollama && stats.value.health.worker) return 'text-green-400'
  if (stats.value.health.ollama || stats.value.health.worker) return 'text-yellow-400'
  return 'text-red-400'
})

const refreshData = async () => {
  try {
    loading.value = true
    
    const [liveStats, liveFeed, pendingTasks, aiStatus] = await Promise.all([
      api.getLiveStats(),
      api.getLiveFeed(50),
      api.getPendingTasks(5),
      api.getOllamaStatus().catch(() => ({ data: { isActive: false } }))
    ])

    // Update stats
    if (liveStats.data) {
      stats.value = {
        classifiedToday: liveStats.data.today?.classified || 0,
        avgConfidence: liveStats.data.today?.avgConfidence || 0,
        queuePending: liveStats.data.queue?.pending || 0,
        health: liveStats.data.health || { ollama: false, worker: false, database: true },
        gapAnalysis: liveStats.data.gapAnalysis
      }
    }

    // Update activity feed
    if (liveFeed.data?.items) {
      activityFeed.value = liveFeed.data.items
    }

    // Update processing queue
    if (pendingTasks.data) {
      processingQueue.value = pendingTasks.data.slice(0, 5)
    }

    // Update Ollama status
    if (aiStatus.data) {
      ollamaStatus.value = aiStatus.data
    }

    lastUpdated.value = new Date().toLocaleTimeString()
  } catch (error) {
    console.error('Failed to refresh live data:', error)
  } finally {
    loading.value = false
  }
}

const formatNumber = (num) => {
  if (!num) return '0'
  return num.toLocaleString()
}

const formatTimeAgo = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  
  if (diffSecs < 60) return `${diffSecs}s ago`
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString()
}

const formatMethod = (method) => {
  const methods = {
    'ai_fallback': 'AI',
    'source_library': 'Source',
    'rule_match': 'Rule',
    'exact_match': 'Exact',
    'library_rule': 'Library Rule',
    'holiday_detection': 'Holiday'
  }
  return methods[method] || method
}

const getMethodIcon = (method) => {
  const icons = {
    'ai_fallback': '🤖',
    'source_library': '📚',
    'rule_match': '📋',
    'exact_match': '🎯',
    'library_rule': '📖',
    'holiday_detection': '🎄'
  }
  return icons[method] || '✓'
}

onMounted(() => {
  refreshData()
  
  // Auto-refresh every 2 seconds
  refreshTimer = setInterval(() => {
    refreshData()
  }, refreshInterval * 1000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})
</script>

<style scoped>
.feed-enter-active {
  transition: all 0.3s ease;
}

.feed-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.feed-leave-active {
  transition: all 0.3s ease;
}

.feed-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.feed-move {
  transition: transform 0.3s ease;
}
</style>
