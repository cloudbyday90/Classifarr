<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
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

    <!-- Global Progress Bar -->
    <GlobalProgressBar :active-classifications="activeClassifications" />

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
            class="h-4 rounded-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-500"
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
              class="px-3 py-1 text-xs bg-orange-600 hover:bg-orange-500 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            
            <!-- Activity Item Progress (for active classifications) -->
            <ActivityItemProgress
              v-if="getItemProgress(item.id)"
              :progress="getItemProgress(item.id)?.progress || 0"
              :current-phase="getItemProgress(item.id)?.current_phase || 'queued'"
              :show-phase-details="true"
            />
          </div>
        </TransitionGroup>
      </div>
    </Card>

    <!-- Up Next Queue (shows next pending items, not stuck processing ghosts) -->
    <Card v-if="upNextQueue.length > 0">
      <template #header>
        <h2 class="text-lg font-semibold">Up Next</h2>
      </template>
      
      <div class="space-y-2">
        <div 
          v-for="item in upNextQueue"
          :key="item.id"
          class="flex items-center justify-between p-3 bg-background-light rounded-lg"
        >
          <div class="flex items-center space-x-3">
            <span class="text-gray-400 text-sm">#{{ item.id }}</span>
            <span>{{ getItemTitle(item) }}</span>
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
import GlobalProgressBar from '@/components/GlobalProgressBar.vue'
import ActivityItemProgress from '@/components/ActivityItemProgress.vue'
import api from '@/api'
import { useWebSocket } from '@/composables/useWebSocket'

// Activity page polling interval in seconds (configurable in settings)
const refreshInterval = ref(30) // Default 30 seconds
const loading = ref(true)
const lastUpdated = ref('')
let refreshTimer = null

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
const activeClassifications = ref([])

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
    
    const [liveStats, liveFeed, pendingTasks, aiStatus] = await Promise.all([
      api.getLiveStats(),
      api.getLiveFeed(50),
      api.getPendingTasks(5),
      api.getOllamaStatus().catch(() => ({ data: { isActive: false } }))
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

const getItemProgress = (itemId) => {
  // Find active classification for this item
  return activeClassifications.value.find(ac => ac.media_item_id === itemId)
}

const formatMethod = (method) => {
  const methods = {
    // New standardized names
    'ai_analysis': 'AI',
    'source_library': 'Source',
    'custom_rule': 'Rule',
    'exact_match': 'Exact',
    'event_detection': 'Event',
    'manual_correction': 'Corrected',
    'learned_pattern': 'Learned',
    'existing_media': 'Exists',
    'reclassification': 'Reclassified',
    // Legacy names (backwards compatibility)
    'ai_fallback': 'AI',
    'rule_match': 'Rule',
    'library_rule': 'Rule',
    'holiday_detection': 'Event',
    'learned_correction': 'Corrected'
  }
  return methods[method] || method
}

const getMethodIcon = (method, eventType = null) => {
  // Event-specific icons
  const eventIcons = {
    'holiday': '🎄',
    'sports': '🏈',
    'ppv': '🥊',
    'concert': '🎵',
    'standup': '🎤',
    'awards': '🏆'
  }
  
  // If event type is provided, use it
  if (method === 'event_detection' && eventType && eventIcons[eventType]) {
    return eventIcons[eventType]
  }

  const icons = {
    // New standardized names
    'ai_analysis': '🤖',
    'source_library': '📚',
    'custom_rule': '📋',
    'exact_match': '🎯',
    'event_detection': '🎄', // Default event icon
    'manual_correction': '✏️',
    'learned_pattern': '🧠',
    'existing_media': '✅',
    'reclassification': '🔄',
    // Legacy names (backwards compatibility)
    'ai_fallback': '🤖',
    'rule_match': '📋',
    'library_rule': '📖',
    'holiday_detection': '🎄',
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
  
  // Initialize WebSocket for real-time progress updates
  const { onProgress, onComplete } = useWebSocket({
    onProgress: (data) => {
      // Update active classifications on progress updates
      const index = activeClassifications.value.findIndex(ac => ac.id === data.taskId)
      if (index !== -1) {
        activeClassifications.value[index] = { ...activeClassifications.value[index], ...data }
      } else {
        activeClassifications.value.push(data)
      }
    },
    onComplete: (data) => {
      // Remove completed classification from active list
      activeClassifications.value = activeClassifications.value.filter(ac => ac.id !== data.taskId)
    },
    onError: (error) => {
      console.error('WebSocket error:', error)
    }
  })
  
  // Load initial active classifications
  try {
    const progressRes = await api.getProgress()
    if (progressRes.data?.data) {
      activeClassifications.value = progressRes.data.data
    }
  } catch (e) {
    console.error('Failed to load progress data:', e)
  }
  
  refreshData()
  
  // Auto-refresh based on configured interval
  refreshTimer = setInterval(() => {
    refreshData()
  }, refreshInterval.value * 1000)
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
