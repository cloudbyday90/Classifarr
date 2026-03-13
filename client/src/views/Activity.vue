<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
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
      <div class="bg-linear-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-xl p-4">
        <div class="text-3xl font-bold text-blue-400">{{ stats.classifiedToday }}</div>
        <div class="text-sm text-gray-400">Classified Today</div>
      </div>

      <!-- Average Confidence -->
      <div class="bg-linear-to-br from-green-600/20 to-green-800/20 border border-green-500/30 rounded-xl p-4">
        <div class="text-3xl font-bold text-green-400">{{ stats.avgConfidence }}%</div>
        <div class="text-sm text-gray-400">Avg Confidence</div>
      </div>

      <!-- Queue Pending -->
      <div class="bg-linear-to-br from-yellow-600/20 to-yellow-800/20 border border-yellow-500/30 rounded-xl p-4">
        <div class="text-3xl font-bold text-yellow-400">{{ stats.queuePending }}</div>
        <div class="text-sm text-gray-400">Queue Pending</div>
      </div>

      <!-- System Health -->
      <div class="bg-linear-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-xl p-4">
        <div class="flex items-center space-x-2">
          <span v-if="stats.health.ai && stats.health.worker" class="text-2xl">✅</span>
          <span v-else-if="stats.health.ai || stats.health.worker" class="text-2xl">⚠️</span>
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
            class="h-4 rounded-full bg-linear-to-r from-blue-500 to-purple-500 transition-all duration-500"
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

    <!-- Library Enrichment Progress -->
    <Card v-if="stats.enrichment?.totalItems > 0">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="text-xl">🎬</span>
            <h2 class="text-lg font-semibold">Library Enrichment Progress</h2>
          </div>
          <span class="text-sm text-gray-400">{{ stats.enrichment.enriched }} / {{ stats.enrichment.totalItems }} items</span>
        </div>
      </template>
      
      <div class="space-y-3">
        <!-- Progress Bar -->
        <div class="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
          <div 
            class="h-4 rounded-full bg-linear-to-r from-green-500 to-blue-500 transition-all duration-500"
            :style="{ width: `${stats.enrichment.progress}%` }"
          ></div>
        </div>
        
        <!-- Stats Row -->
        <div class="flex justify-between text-sm">
          <span class="text-gray-400">{{ stats.enrichment.progress }}% Complete</span>
          <div class="flex space-x-4">
            <span class="text-blue-400">🎬 OMDb: {{ stats.enrichment.omdbEnriched || 0 }}</span>
            <span class="text-purple-400">🔍 Tavily: {{ stats.enrichment.tavilyEnriched || 0 }}</span>
            <span class="text-yellow-400">⏳ Pending: {{ (stats.enrichment?.pending || 0) + (stats.enrichment?.retryQueue?.total?.pending || 0) }}</span>
          </div>
        </div>
        
        <!-- Retry Queue Status -->
        <div v-if="stats.enrichment?.retryQueue?.total?.pending > 0" 
             class="mt-3 p-3 bg-orange-900/20 border border-orange-500/30 rounded-lg">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="text-orange-400">🔄</span>
              <span class="text-sm text-orange-300">
                {{ stats.enrichment.retryQueue.total.pending }} items queued for Tavily retry
              </span>
            </div>
            <button 
              @click="processRetryQueue" 
              :disabled="retryProcessing"
              class="px-3 py-1 text-xs bg-orange-600 hover:bg-orange-500 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ retryProcessing ? 'Processing...' : 'Process Queue' }}
            </button>
          </div>
          <p class="text-xs text-gray-400 mt-1">
            Items where OMDb couldn't find data. Processing uses Tavily quota.
          </p>
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
      
      <div class="flex items-center justify-between p-3 bg-linear-to-r from-purple-900/30 to-blue-900/30 rounded-lg">
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

    <!-- Active Classifications -->
    <div v-if="activeClassifications.length > 0" class="space-y-4">
      <h2 class="text-xl font-bold flex items-center gap-2">
        <span class="relative flex h-3 w-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
        </span>
        Processing Now
      </h2>
      
      <!-- Primary Progress Bar (First Item) -->
      <GlobalProgressBar :task="activeClassifications[0]" />
      
      <!-- Other Active Items -->
      <Card v-if="activeClassifications.length > 1">
        <template #header>
          <h3 class="text-lg font-semibold">Other Active Tasks</h3>
        </template>
        <div class="space-y-4">
          <div v-for="task in activeClassifications.slice(1)" :key="task.taskId" class="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <ActivityItemProgress :task="task" />
          </div>
        </div>
      </Card>
    </div>

    <!-- Up Next Queue -->
    <Card v-if="upNextQueue.length > 0">
      <template #header>
        <h2 class="text-lg font-semibold">Up Next</h2>
      </template>
      
      <div class="space-y-2">
        <div 
          v-for="item in upNextQueue"
          :key="item.id"
          class="flex items-center justify-between p-3 bg-background-light rounded-lg opacity-75"
        >
          <div class="flex items-center space-x-3">
            <span class="text-gray-400 text-sm">#{{ item.id }}</span>
            <span>{{ getItemTitle(item) }}</span>
          </div>
          <span class="text-sm text-gray-400">Pending</span>
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
import { io } from 'socket.io-client'
import Card from '@/components/common/Card.vue'
import Badge from '@/components/common/Badge.vue'
import Button from '@/components/common/Button.vue'
import Spinner from '@/components/common/Spinner.vue'
import GlobalProgressBar from '@/components/activity/GlobalProgressBar.vue'
import ActivityItemProgress from '@/components/activity/ActivityItemProgress.vue'
import api from '@/api'

// Activity page polling interval in seconds (configurable in settings)
const refreshInterval = ref(30) // Default 30 seconds
const loading = ref(true)
const lastUpdated = ref('')
let refreshTimer = null
let socket = null

const activeClassifications = ref([])

const stats = ref({
  classifiedToday: 0,
  avgConfidence: 0,
  queuePending: 0,
  health: { ai: false, worker: false, database: true },
  gapAnalysis: null,
  enrichment: null
})

const ollamaStatus = ref({
  isActive: false,
  model: null,
  tokenCount: 0,
  elapsedSeconds: 0,
  itemTitle: null
})

const activityFeed = ref([])
const upNextQueue = ref([])
const retryProcessing = ref(false)

const healthStatus = computed(() => {
  if (stats.value.health.ai && stats.value.health.worker) return 'All Systems OK'
  if (stats.value.health.ai || stats.value.health.worker) return 'Partial'
  return 'Offline'
})

const healthColor = computed(() => {
  if (stats.value.health.ai && stats.value.health.worker) return 'text-green-400'
  if (stats.value.health.ai || stats.value.health.worker) return 'text-yellow-400'
  return 'text-red-400'
})

const refreshData = async () => {
  try {
    loading.value = true
    
    const [liveStats, liveFeed, pendingTasks, aiStatus, progressData] = await Promise.all([
      api.getLiveStats(),
      api.getLiveFeed(50),
      api.getPendingTasks(5),
      api.getOllamaStatus().catch(() => ({ data: { isActive: false } })),
      api.getClassificationProgress().catch(() => ({ data: [] }))
    ])

    // Update stats
    if (liveStats.data) {
      // Safeguard: merge with defaults to ensure expected fields exist
      const defaultHealth = { ai: false, worker: false, database: false }
      stats.value = {
        classifiedToday: liveStats.data.today?.allClassified || liveStats.data.today?.classified || 0,
        avgConfidence: liveStats.data.today?.allAvgConfidence || liveStats.data.today?.avgConfidence || 0,
        queuePending: liveStats.data.queue?.pending || 0,
        health: { ...defaultHealth, ...liveStats.data.health },
        gapAnalysis: liveStats.data.gapAnalysis,
        enrichment: liveStats.data.enrichment
      }
    }

    // Update activity feed
    if (liveFeed.data?.items) {
      activityFeed.value = liveFeed.data.items
    }

    // Update up next queue (only pending items, not ghost processing)
    if (pendingTasks.data) {
      upNextQueue.value = pendingTasks.data
        .filter(t => t.status === 'pending')
        .slice(0, 5)
    }

    // Update Ollama status
    if (aiStatus.data) {
      ollamaStatus.value = aiStatus.data
    }

    // Update active classifications (initial state, then WebSocket takes over)
    if (progressData.data) {
      // Merge with existing to preserve animation state if possible, or just replace
      // If we have socket updates, those are newer, so maybe only replace if empty?
      // Actually, HTTP is snapshot, Socket is delta. 
      // Ideally we trust Socket, but use HTTP for initial population.
      if (!socket || !socket.connected) {
         activeClassifications.value = progressData.data
      }
    }

    lastUpdated.value = new Date().toLocaleTimeString()
  } catch (error) {
    console.error('Failed to refresh live data:', error)
  } finally {
    loading.value = false
  }
}

const getItemTitle = (item) => {
  // Try to extract title from payload (which is a JSON object or string)
  if (item.payload) {
    const payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload
    return payload.title || 'Untitled'
  }
  return 'Untitled'
}

const formatNumber = (num) => {
  if (!num) return '0'
  return num.toLocaleString()
}

const formatTimeAgo = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = Math.abs(now - date) // Use absolute value to handle timezone/future issues
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffSecs < 60) return `${diffSecs}s ago`
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

const processRetryQueue = async () => {
  try {
    retryProcessing.value = true
    await api.processRetryQueue({ limit: 50, enrichmentType: 'tavily' })
    // Refresh stats after processing
    await refreshData()
  } catch (error) {
    console.error('Failed to process retry queue:', error)
    alert('Failed to process retry queue. Check if Tavily is configured and has quota.')
  } finally {
    retryProcessing.value = false
  }
}

const formatMethod = (method) => {
  const methods = {
    // New standardized names
    'ai_analysis': 'AI',
    'source_library': 'Source',
    'custom_rule': 'Rule',
    'exact_match': 'Exact',
    'manual_correction': 'Corrected',
    'learned_pattern': 'Learned',
    'existing_media': 'Exists',
    'reclassification': 'Reclassified',
    // Legacy names (backwards compatibility)
    'ai_fallback': 'AI',
    'rule_match': 'Rule',
    'library_rule': 'Rule',
    'learned_correction': 'Corrected'
  }
  return methods[method] || method
}

const getMethodIcon = (method, eventType = null) => {
  const icons = {
    // New standardized names
    'ai_analysis': '🤖',
    'source_library': '📚',
    'custom_rule': '📋',
    'exact_match': '🎯',
    'manual_correction': '✏️',
    'learned_pattern': '🧠',
    'existing_media': '✅',
    'reclassification': '🔄',
    // Legacy names (backwards compatibility)
    'ai_fallback': '🤖',
    'rule_match': '📋',
    'library_rule': '📖',
    'learned_correction': '✏️'
  }
  return icons[method] || '✓'
}

onMounted(async () => {
  // Load queue settings for polling interval
  try {
    const settingsRes = await api.getQueueSettings()
    if (settingsRes.data?.activityRefreshInterval) {
      refreshInterval.value = parseInt(settingsRes.data.activityRefreshInterval) || 30
    }
  } catch (e) {
    // Use default if settings not available
  }
  
  refreshData()
  
  // Setup WebSocket for real-time progress (server uses /ws path)
  socket = io({ path: '/ws' });
  
  socket.on('connect', () => {
    // Subscribe to activity feed for classification updates
    socket.emit('subscribe:activity');
  });

  // Listen for classification progress (server emits classification:progress, not task:progress)
  socket.on('classification:progress', (data) => {
    // Validate incoming data - reject ghost/invalid tasks
    if (!data.title || data.title === '' || data.title === 'Unknown') {
      console.debug('Ignoring ghost task with empty title:', data.taskId);
      return;
    }
    // Filter out source_library tasks on client side as additional safety
    if (data.method === 'source_library' || data.source_library_id) {
      console.debug('Ignoring source_library task:', data.taskId);
      return;
    }
    
    const existingIndex = activeClassifications.value.findIndex(t => t.taskId === data.taskId);
    if (existingIndex !== -1) {
      // Update existing
      activeClassifications.value[existingIndex] = { ...activeClassifications.value[existingIndex], ...data };
    } else {
      // Add new
      activeClassifications.value.push(data);
    }
  });

  // Listen for task completion (also uses classification: prefix)
  socket.on('classification:complete', (data) => {
    // Remove from active list
    activeClassifications.value = activeClassifications.value.filter(t => t.taskId !== data.taskId);
    // Refresh feed to show completed item
    refreshData();
  });

  // Auto-refresh based on configured interval
  refreshTimer = setInterval(() => {
    refreshData()
  }, refreshInterval.value * 1000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
  if (socket) {
    socket.disconnect();
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
