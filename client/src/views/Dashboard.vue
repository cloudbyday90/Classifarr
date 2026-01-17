<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- Setup Banner (disabled for v0.30.0 - will enable after bugs fixed) -->
    <!-- <SetupBanner /> -->
    
    <!-- Arr Config Warning -->
    <ArrConfigWarning />

    <!-- Header with Refresh and Timestamp -->
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold">Dashboard</h1>
      
      <div class="flex items-center gap-3">
        <span v-if="lastUpdated" class="text-sm text-gray-400">
          Updated {{ formatRelativeTime(lastUpdated) }}
        </span>
        <Button @click="loadDashboard" :disabled="loading" size="sm">
          <span v-if="loading">🔄</span>
          <span v-else>↻</span>
          Refresh
        </Button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div v-for="i in 5" :key="i" class="bg-gray-800 p-4 rounded-lg border border-gray-700 animate-pulse">
        <div class="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
        <div class="h-8 bg-gray-600 rounded w-1/2"></div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-900/30 border border-red-700 rounded-lg p-6">
      <div class="flex items-start gap-3">
        <span class="text-red-400 text-2xl">⚠️</span>
        <div>
          <h3 class="font-semibold text-red-300">Failed to Load Dashboard</h3>
          <p class="text-sm text-red-400/80 mt-1">{{ error }}</p>
          <Button @click="loadDashboard" variant="secondary" size="sm" class="mt-3">
            🔄 Retry
          </Button>
        </div>
      </div>
    </div>

    <!-- Empty State - No Libraries -->
    <div v-else-if="!loading && librariesStore.libraries.length === 0" class="bg-blue-900/20 border border-blue-700 rounded-lg p-8 text-center">
      <div class="text-6xl mb-4">📚</div>
      <h2 class="text-2xl font-bold text-blue-300 mb-2">Welcome to Classifarr!</h2>
      <p class="text-blue-400/80 mb-6 max-w-2xl mx-auto">
        To get started, you'll need to connect your media server (Plex, Emby, or Jellyfin) and sync your libraries.
      </p>
      
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <Button @click="$router.push('/settings')" class="px-6 py-3">
          📺 Connect Media Server
        </Button>
        <a :href="GITHUB_WIKI_URL" target="_blank" rel="noopener noreferrer">
          <Button variant="secondary" class="px-6 py-3 w-full">
            📖 View Documentation
          </Button>
        </a>
      </div>
      
      <div class="mt-8 text-sm text-gray-400">
        <p><strong>Next Steps:</strong></p>
        <ol class="mt-2 text-left inline-block">
          <li>1. Connect your media server</li>
          <li>2. Sync your libraries</li>
          <li>3. Configure Radarr/Sonarr connections</li>
          <li>4. Set up classification policies</li>
        </ol>
      </div>
    </div>
    
    <template v-else>
    <!-- System Status Row -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div class="flex items-center gap-2">
          <span class="text-2xl">{{ queueStats.aiAvailable ? '🟢' : '🔴' }}</span>
          <div>
            <div class="text-sm font-medium">AI Provider</div>
            <div class="text-xs text-gray-400">{{ queueStats.aiAvailable ? 'Online' : 'Offline' }}</div>
          </div>
        </div>
      </div>
      <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div class="text-2xl font-bold text-blue-400">{{ queueStats.pending }}</div>
        <div class="text-xs text-gray-400">Queue Pending</div>
      </div>
      <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div class="text-2xl font-bold text-primary">{{ stats.total || 0 }}</div>
        <div class="text-xs text-gray-400">Total Classifications</div>
      </div>
      <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div class="text-2xl font-bold text-success">{{ librariesStore.libraries.length }}</div>
        <div class="text-xs text-gray-400">Active Libraries</div>
      </div>
      <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div class="text-2xl font-bold text-warning">{{ computedAvgConfidence }}%</div>
        <div class="text-xs text-gray-400">Avg Confidence</div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Recent Classifications (2/3 width) -->
      <div class="lg:col-span-2">
        <Card title="Recent Classifications">
          <div v-if="recentHistory.length === 0" class="text-center py-8 text-gray-500">
            No classifications yet
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="item in recentHistory"
              :key="item.id"
              @click="viewDetails(item)"
              class="p-3 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded-lg cursor-pointer transition-colors"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-lg">{{ item.media_type === 'movie' ? '🎬' : '📺' }}</span>
                    <span class="font-semibold">{{ item.title }}</span>
                    <span v-if="item.year" class="text-gray-500">({{ item.year }})</span>
                  </div>
                  
                  <div class="flex items-center gap-3 mt-1 text-sm text-gray-400">
                    <span class="flex items-center gap-1">
                      {{ getMethodIcon(item.method) }}
                      {{ formatMethodName(item.method) }}
                    </span>
                    <span>→</span>
                    <span class="text-primary">{{ item.library_name }}</span>
                    <span>•</span>
                    <span>{{ formatRelativeTime(new Date(item.created_at)) }}</span>
                  </div>
                </div>
                
                <div class="flex items-center gap-2">
                  <Badge :variant="getConfidenceVariant(item.confidence)">
                    {{ item.confidence }}%
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          <div v-if="recentHistory.length > 0" class="mt-4 text-center">
            <Button @click="$router.push('/history')" variant="ghost" size="sm">
              View All History →
            </Button>
          </div>
        </Card>
      </div>

      <!-- Sidebar (1/3 width) -->
      <div class="space-y-6">
        <!-- Quick Actions -->
        <Card title="Quick Actions">
          <div class="grid grid-cols-2 gap-3">
            <router-link to="/request" class="p-4 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-center transition-colors">
              <div class="text-2xl mb-2">🎬</div>
              <div class="text-sm font-semibold">Classify Media</div>
            </router-link>
            
            <router-link to="/libraries" class="p-4 bg-green-900/20 hover:bg-green-900/30 border border-green-700/30 rounded-lg text-center transition-colors">
              <div class="text-2xl mb-2">📚</div>
              <div class="text-sm font-semibold">Manage Libraries</div>
            </router-link>
            
            <router-link to="/settings" class="p-4 bg-gray-700/50 hover:bg-gray-700/70 border border-gray-600 rounded-lg text-center transition-colors">
              <div class="text-2xl mb-2">⚙️</div>
              <div class="text-sm font-semibold">Settings</div>
            </router-link>
            
            <router-link to="/statistics" class="p-4 bg-gray-700/50 hover:bg-gray-700/70 border border-gray-600 rounded-lg text-center transition-colors">
              <div class="text-2xl mb-2">📊</div>
              <div class="text-sm font-semibold">Statistics</div>
            </router-link>
            
            <a :href="GITHUB_WIKI_URL" target="_blank" rel="noopener noreferrer" class="p-4 bg-gray-700/50 hover:bg-gray-700/70 border border-gray-600 rounded-lg text-center transition-colors">
              <div class="text-2xl mb-2">📖</div>
              <div class="text-sm font-semibold">Documentation</div>
            </a>
            
            <a :href="DISCORD_INVITE_URL" target="_blank" rel="noopener noreferrer" class="p-4 bg-indigo-900/20 hover:bg-indigo-900/30 border border-indigo-700/30 rounded-lg text-center transition-colors">
              <div class="text-2xl mb-2">💬</div>
              <div class="text-sm font-semibold">Discord</div>
            </a>
          </div>
        </Card>

        <!-- Awaiting Decision (Policy Questions) -->
        <Card title="❓ Awaiting Decision" class="awaiting-card">
          <div class="space-y-3">
            <div class="text-center">
              <span class="text-3xl font-bold text-purple-400">{{ awaitingDecisionCount }}</span>
              <p class="text-sm text-gray-400 mt-1">{{ awaitingDecisionCount > 0 ? 'items need your input' : 'no items pending' }}</p>
            </div>
            <Button @click="$router.push('/queue')" class="w-full" variant="secondary">
              {{ awaitingDecisionCount > 0 ? 'Review Pending Items →' : 'View Queue →' }}
            </Button>
          </div>
        </Card>


        <!-- Queue Summary -->
        <Card title="Processing Queue">
          <div class="space-y-3">
            <div class="flex justify-between text-sm">
              <span class="text-gray-400">Pending</span>
              <span>{{ queueStats.pending }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-400">Processing</span>
              <span class="text-yellow-400">{{ queueStats.processing }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-400">Completed</span>
              <span class="text-green-400">{{ queueStats.completed }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-400">Failed</span>
              <span class="text-red-400">{{ queueStats.failed }}</span>
            </div>
          </div>
        </Card>

        <!-- Classification Methods -->
        <Card title="Classification Methods">
          <div v-if="sortedMethods.length === 0" class="text-center py-4 text-gray-400 text-sm">
            No classifications yet
          </div>
          <div v-else class="space-y-2 text-sm">
            <div 
              v-for="method in sortedMethods" 
              :key="method.method" 
              class="flex justify-between items-center"
              :title="getMethodTooltip(method.method)"
            >
              <span class="flex items-center gap-2">
                <span>{{ getMethodIcon(method.method) }}</span>
                <span class="text-gray-400">{{ formatMethodName(method.method) }}</span>
              </span>
              <span :class="getMethodColor(method.method)">{{ method.count }}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDocumentVisibility } from '@vueuse/core'
import { useLibrariesStore } from '@/stores/libraries'
import api from '@/api'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Badge from '@/components/common/Badge.vue'
import SetupBanner from '@/components/SetupBanner.vue'
import ArrConfigWarning from '@/components/settings/ArrConfigWarning.vue'

const router = useRouter()
const librariesStore = useLibrariesStore()
const visibility = useDocumentVisibility()

// Constants
const POLL_INTERVAL_MS = 5000
const GITHUB_WIKI_URL = 'https://github.com/cloudbyday90/Classifarr/wiki'
const DISCORD_INVITE_URL = 'https://discord.gg/classifarr'

const stats = ref({})
const loading = ref(false)
const error = ref(null)
const lastUpdated = ref(null)

// Compute average confidence from backend all-time data
const computedAvgConfidence = computed(() => {
  // Use backend avg_confidence if available (all-time average)
  if (stats.value.avg_confidence !== undefined && stats.value.avg_confidence !== null) {
    return stats.value.avg_confidence
  }
  return 0
})

// Get methods from backend (already sorted by count descending)
const sortedMethods = computed(() => {
  if (!stats.value.byMethod || !Array.isArray(stats.value.byMethod)) {
    return []
  }
  return stats.value.byMethod
})
const recentHistory = ref([])
const queueStats = ref({ pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true })
const enrichmentStats = ref({ totalItems: 0, enriched: 0, tavilyEnriched: 0, progress: 0 })
const awaitingDecisionCount = ref(0)
let pollInterval = null

// Format relative time helper
const formatRelativeTime = (date) => {
  const seconds = Math.floor((new Date() - date) / 1000)
  
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

onMounted(async () => {
  await loadDashboard()
  startPolling()
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

const loadDashboard = async () => {
  try {
    loading.value = true
    error.value = null
    
    await librariesStore.fetchLibraries()
    
    // Parallel fetch all required data including awaiting decision count
    const [statsRes, historyRes, queueRes, pendingRes] = await Promise.all([
      api.getStats(),
      api.getHistory({ page: 1, limit: 8, excludeMethod: 'source_library' }),
      api.getQueueStats(),
      api.get('/classification/pending/count')
    ])
    
    stats.value = statsRes.data
    recentHistory.value = historyRes.data.data || []
    queueStats.value = queueRes // getQueueStats already extracts .data
    awaitingDecisionCount.value = pendingRes.data.count || 0
    
    lastUpdated.value = new Date()
  } catch (err) {
    console.error('Failed to load dashboard data:', err)
    error.value = err.response?.data?.error || err.message || 'Unknown error'
  } finally {
    loading.value = false
  }
}

const startPolling = () => {
  if (pollInterval) clearInterval(pollInterval)
  
  pollInterval = setInterval(() => {
    if (visibility.value === 'visible') {
      loadQueueStats() // Only poll when tab is visible
    }
  }, POLL_INTERVAL_MS)
}

const loadQueueStats = async () => {
  try {
    const liveRes = await api.getLiveStats()
    if (liveRes?.data) {
      queueStats.value = liveRes.data.queue || queueStats.value
      if (liveRes.data.enrichment) {
        enrichmentStats.value = liveRes.data.enrichment
      }
    } else {
      // Fallback to basic queue stats
      const res = await api.getQueueStats()
      queueStats.value = res
    }
  } catch (error) {
    console.error('Failed to load queue stats:', error)
  }
}

const getConfidenceVariant = (confidence) => {
  if (confidence >= 90) return 'success'
  if (confidence >= 70) return 'info'
  if (confidence >= 50) return 'warning'
  return 'error'
}

const viewDetails = (item) => {
  // Navigate to history with selected item
  try {
    router.push({ name: 'History', query: { id: item.id } })
  } catch (err) {
    console.error('Failed to navigate to history:', err)
  }
}

// Method display helpers
const getMethodIcon = (method) => {
  const icons = {
    'policy_engine': '⚙️',
    'source_library': '📚',
    'manual_classification': '✋',
    'learned_pattern': '🧠',
    'exact_match': '🎯',
    'ai_fallback': '🤖',
    'rule_match': '📋',
    'library_rule': '📋',
    'existing_media': '🎬',
    'holiday_detection': '🎄'
  }
  return icons[method] || '❓'
}

const formatMethodName = (method) => {
  const names = {
    'policy_engine': 'Policy Engine',
    'source_library': 'Source Library',
    'manual_classification': 'Manual',
    'learned_pattern': 'Learned Pattern',
    'exact_match': 'Exact Match',
    'ai_fallback': 'AI Analysis',
    'rule_match': 'Rule Match',
    'library_rule': 'Rule Match',
    'existing_media': 'Existing Media',
    'holiday_detection': 'Holiday Detection'
  }
  return names[method] || method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const getMethodColor = (method) => {
  const colors = {
    'policy_engine': 'text-purple-400',
    'source_library': 'text-blue-400',
    'manual_classification': 'text-yellow-400',
    'learned_pattern': 'text-cyan-400',
    'exact_match': 'text-green-400',
    'ai_fallback': 'text-orange-400',
    'rule_match': 'text-indigo-400',
    'library_rule': 'text-indigo-400',
    'existing_media': 'text-pink-400',
    'holiday_detection': 'text-red-400'
  }
  return colors[method] || 'text-gray-400'
}

const getMethodTooltip = (method) => {
  const tooltips = {
    'policy_engine': 'Classification via learned library policy patterns',
    'source_library': 'Direct mapping from source library configuration',
    'manual_classification': 'Manually classified by user',
    'learned_pattern': 'Classification based on learned patterns',
    'exact_match': 'Exact match found in database',
    'ai_fallback': 'AI-powered classification when other methods fail',
    'rule_match': 'Matched against defined rules',
    'library_rule': 'Matched against library-specific rules',
    'existing_media': 'Based on existing media in libraries',
    'holiday_detection': 'Special holiday/seasonal content detected'
  }
  return tooltips[method] || 'Classification method'
}
</script>
