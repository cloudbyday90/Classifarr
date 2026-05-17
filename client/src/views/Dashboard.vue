<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- Skip to main content -->
    <a href="#main-content" class="skip-to-main">Skip to main content</a>
    
    <!-- Setup Banner (disabled for v0.30.0 - will enable after bugs fixed) -->
    <!-- <SetupBanner /> -->
    
    <!-- Arr Config Warning -->
    <ArrConfigWarning />

    <!-- pgvector Variant Banner -->
    <PgvectorVariantBanner />

    <!-- Main content with ID for skip link -->
    <main id="main-content" tabindex="-1">

    <!-- Header with Refresh and Timestamp -->
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold">Dashboard</h1>
      
      <div class="flex items-center gap-3">
        <!-- Status indicators - only one aria-live region for mutually exclusive states -->
        <span v-if="isOffline" class="text-xs text-yellow-500 flex items-center gap-1" role="status" aria-live="polite">
          📡 Offline
        </span>
        
        <span v-else-if="isStale" class="text-xs text-gray-400 animate-pulse" role="status" aria-live="polite">
          ⏳ Updating...
        </span>
        
        <!-- Timestamp without aria-live since status is covered by offline/updating indicators -->
        <span 
          v-if="lastUpdated" 
          class="text-sm text-gray-400"
          :aria-label="`Dashboard last updated ${formatRelativeTime(lastUpdated)}`"
        >
          Updated {{ formatRelativeTime(lastUpdated) }}
        </span>
      </div>
    </div>

    <!-- Loading State -->
    <div 
      v-if="loading" 
      class="grid grid-cols-2 md:grid-cols-5 gap-4"
      role="status"
      aria-live="polite"
      aria-label="Loading dashboard statistics"
    >
      <div 
        v-for="i in 5" 
        :key="i" 
        class="bg-gray-800 p-4 rounded-lg border border-gray-700 animate-pulse"
        aria-hidden="true"
      >
        <div class="h-4 bg-gray-700 rounded-sm w-3/4 mb-2"></div>
        <div class="h-8 bg-gray-600 rounded-sm w-1/2"></div>
      </div>
      <span class="sr-only">Loading dashboard data, please wait...</span>
    </div>

    <!-- Error State -->
    <div 
      v-else-if="error" 
      class="bg-red-900/30 border border-red-700 rounded-lg p-6"
      role="alert"
      aria-live="assertive"
    >
      <div class="flex items-start gap-3">
        <span class="text-red-400 text-2xl" aria-hidden="true">⚠️</span>
        <div>
          <h3 class="font-semibold text-red-300" id="error-heading" tabindex="-1">Failed to Load Dashboard</h3>
          <p class="text-sm text-red-400/80 mt-1" id="error-description">{{ error }}</p>
          <Button 
            @click="loadDashboard" 
            variant="secondary" 
            size="sm" 
            class="mt-3"
            aria-describedby="error-description"
          >
            🔄 Retry
          </Button>
        </div>
      </div>
    </div>

    <!-- Empty State - No Libraries -->
    <div 
      v-else-if="!loading && librariesStore.libraries.length === 0" 
      class="bg-blue-900/20 border border-blue-700 rounded-lg p-8 text-center"
      role="region"
      aria-labelledby="welcome-heading"
    >
      <div class="text-6xl mb-4" aria-hidden="true">📚</div>
      <h2 class="text-2xl font-bold text-blue-300 mb-2" id="welcome-heading">Welcome to Classifarr!</h2>
      <p class="text-blue-400/80 mb-6 max-w-2xl mx-auto">
        To get started, you'll need to connect your media server (Plex, Emby, or Jellyfin) and sync your libraries.
      </p>
      
      <div class="flex flex-col sm:flex-row gap-4 justify-center" role="group" aria-label="Getting started actions">
        <Button 
          @click="$router.push({ path: '/settings', query: { tab: 'mediaserver' } })" 
          class="px-6 py-3"
          aria-label="Connect your media server to begin"
        >
          📺 Connect Media Server
        </Button>
        <a :href="GITHUB_WIKI_URL" target="_blank" rel="noopener noreferrer">
          <Button 
            variant="secondary" 
            class="px-6 py-3 w-full"
            aria-label="View documentation to learn more"
          >
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
            <router-link 
              :to="canClassifyMedia ? '/request' : '#'"
              :class="[
                'p-4 border rounded-lg text-center transition-colors touch-manipulation',
                canClassifyMedia 
                  ? 'bg-primary/10 hover:bg-primary/20 border-primary/30' 
                  : 'bg-gray-700/30 border-gray-600 opacity-50 pointer-events-none'
              ]"
              :aria-label="canClassifyMedia ? 'Classify media content' : 'Classify media (AI Provider required)'"
              :title="!canClassifyMedia ? 'Configure AI Provider to enable this feature' : undefined"
            >
              <div class="text-2xl mb-2" aria-hidden="true">
                <span v-if="!canClassifyMedia">🔒 </span>🎬
              </div>
              <div class="text-sm font-semibold">Classify Media</div>
            </router-link>
            
            <router-link 
              :to="canManageLibraries ? '/libraries' : '#'"
              :class="[
                'p-4 border rounded-lg text-center transition-colors touch-manipulation',
                canManageLibraries
                  ? 'bg-green-900/20 hover:bg-green-900/30 border-green-700/30'
                  : 'bg-gray-700/30 border-gray-600 opacity-50 pointer-events-none'
              ]"
              :aria-label="canManageLibraries ? 'Manage your media libraries' : 'Manage Libraries (Media Server required)'"
              :title="!canManageLibraries ? 'Configure Media Server to enable this feature' : undefined"
            >
              <div class="text-2xl mb-2" aria-hidden="true">
                <span v-if="!canManageLibraries">🔒 </span>📚
              </div>
              <div class="text-sm font-semibold">Manage Libraries</div>
            </router-link>
            
            <router-link 
              to="/settings" 
              class="p-4 bg-gray-700/50 hover:bg-gray-700/70 border border-gray-600 rounded-lg text-center transition-colors touch-manipulation"
              aria-label="Configure settings"
            >
              <div class="text-2xl mb-2" aria-hidden="true">⚙️</div>
              <div class="text-sm font-semibold">Settings</div>
            </router-link>
            
            <router-link 
              to="/statistics" 
              class="p-4 bg-gray-700/50 hover:bg-gray-700/70 border border-gray-600 rounded-lg text-center transition-colors touch-manipulation"
              aria-label="View statistics"
            >
              <div class="text-2xl mb-2" aria-hidden="true">📊</div>
              <div class="text-sm font-semibold">Statistics</div>
            </router-link>
            
            <a 
              :href="GITHUB_WIKI_URL" 
              target="_blank" 
              rel="noopener noreferrer" 
              class="p-4 bg-gray-700/50 hover:bg-gray-700/70 border border-gray-600 rounded-lg text-center transition-colors touch-manipulation"
              aria-label="View documentation on GitHub wiki"
            >
              <div class="text-2xl mb-2" aria-hidden="true">📖</div>
              <div class="text-sm font-semibold">Documentation</div>
            </a>
            
            <a 
              :href="DISCORD_INVITE_URL" 
              target="_blank" 
              rel="noopener noreferrer" 
              class="p-4 bg-indigo-900/20 hover:bg-indigo-900/30 border border-indigo-700/30 rounded-lg text-center transition-colors touch-manipulation"
              aria-label="Join Discord community"
            >
              <div class="text-2xl mb-2" aria-hidden="true">💬</div>
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

        <!-- Enrichment Summary -->
        <Card v-if="enrichmentTotal > 0" title="Library Enrichment">
          <div class="space-y-3">
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-400">{{ enrichmentCompletedItems }} / {{ enrichmentTotal }} processed</span>
              <span class="text-gray-400">{{ enrichmentProgress }}%</span>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                class="h-2 rounded-full bg-linear-to-r from-green-500 to-blue-500 transition-all duration-500"
                :style="{ width: `${enrichmentProgress}%` }"
              ></div>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="flex items-center justify-between rounded-md border border-green-500/30 bg-green-900/10 px-2 py-2">
                <span class="text-gray-300">Processed</span>
                <Badge variant="success">{{ enrichmentCompletedItems }}</Badge>
              </div>
              <div class="flex items-center justify-between rounded-md border border-blue-500/30 bg-blue-900/10 px-2 py-2">
                <span class="text-gray-300">Processing</span>
                <Badge variant="info">{{ enrichmentProcessingItems }}</Badge>
              </div>
              <div class="flex items-center justify-between rounded-md border border-yellow-500/30 bg-yellow-900/10 px-2 py-2">
                <span class="text-gray-300">Pending</span>
                <Badge variant="warning">{{ enrichmentPendingItems }}</Badge>
              </div>
              <div class="flex items-center justify-between rounded-md border px-2 py-2" :class="enrichmentDeferredItems > 0 ? 'border-orange-500/30 bg-orange-900/10' : 'border-gray-600 bg-gray-800/40 opacity-80'">
                <span class="text-gray-300">Deferred</span>
                <Badge :variant="enrichmentDeferredItems > 0 ? 'warning' : 'default'">{{ enrichmentDeferredItems }}</Badge>
              </div>
              <div class="flex items-center justify-between rounded-md border px-2 py-2" :class="enrichmentFailedItems > 0 ? 'border-red-500/30 bg-red-900/10' : 'border-gray-600 bg-gray-800/40 opacity-80'">
                <span class="text-gray-300">Failed</span>
                <Badge :variant="enrichmentFailedItems > 0 ? 'error' : 'default'">{{ enrichmentFailedItems }}</Badge>
              </div>
            </div>
            <div class="text-xs text-gray-400">
              OMDb: {{ enrichmentOmdb }} • Tavily: {{ enrichmentTavily }}
            </div>
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
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useLibrariesStore } from '@/stores/libraries'
import { useServiceRequirements } from '@/composables/useServiceRequirements'
import { useSWR } from '@/composables/useSWR'
import { CACHE_KEYS, CACHE_TTL, POLL_INTERVALS } from '@/constants/cacheKeys'
import api from '@/api'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Badge from '@/components/common/Badge.vue'
import ArrConfigWarning from '@/components/settings/ArrConfigWarning.vue'
import PgvectorVariantBanner from '@/components/PgvectorVariantBanner.vue'

const router = useRouter()
const librariesStore = useLibrariesStore()
// Service requirements for Quick Actions
const { canUseFeature: canClassifyMedia } = useServiceRequirements(['aiProvider'])
const { canUseFeature: canManageLibraries } = useServiceRequirements(['mediaServer'])

// Constants
const GITHUB_WIKI_URL = 'https://github.com/cloudbyday90/Classifarr/wiki'
const DISCORD_INVITE_URL = 'https://discord.gg/classifarr'

// ============================================
// SWR: Main dashboard data (cached, instant load)
// ============================================
const {
  data: dashboardData,
  isLoading: dashboardLoading,
  isStale,
  error: dashboardError,
  refresh: refreshDashboard,
  isOffline,
  cacheTimestamp
} = useSWR(
  CACHE_KEYS.DASHBOARD_MAIN,
  async () => {
    await librariesStore.fetchLibraries()
    const [statsRes, historyRes, pendingRes] = await Promise.all([
      api.getStats(),
      api.getHistory({ page: 1, limit: 8, excludeMethod: 'source_library' }),
      api.getPendingClassificationCount()
    ])
    return {
      stats: statsRes,
      recentHistory: historyRes.data || [],
      awaitingDecisionCount: pendingRes.count || 0
    }
  },
  { ttl: CACHE_TTL.MEDIUM }
)

// ============================================
// Queue stats: Separate SWR with faster polling
// ============================================
const {
  data: queueData,
  refresh: refreshQueue
} = useSWR(
  CACHE_KEYS.DASHBOARD_QUEUE,
  async () => {
    try {
      const liveRes = await api.getLiveStats()
      if (liveRes) {
        return {
          queueStats: liveRes.queue || { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true },
          enrichmentStats: liveRes.enrichment || {
            totalItems: 0,
            completedItems: 0,
            processingItems: 0,
            pendingItems: 0,
            deferredItems: 0,
            failedItems: 0,
            omdbEnriched: 0,
            tavilyEnriched: 0,
            progress: 0
          }
        }
      }
    } catch {
      // Fallback to basic queue stats
      const res = await api.getQueueStats()
      return {
        queueStats: res,
        enrichmentStats: {
          totalItems: 0,
          completedItems: 0,
          processingItems: 0,
          pendingItems: 0,
          deferredItems: 0,
          failedItems: 0,
          omdbEnriched: 0,
          tavilyEnriched: 0,
          progress: 0
        }
      }
    }
    return {
      queueStats: { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true },
      enrichmentStats: {
        totalItems: 0,
        completedItems: 0,
        processingItems: 0,
        pendingItems: 0,
        deferredItems: 0,
        failedItems: 0,
        omdbEnriched: 0,
        tavilyEnriched: 0,
        progress: 0
      }
    }
  },
  { ttl: CACHE_TTL.SHORT, pollInterval: POLL_INTERVALS.FAST, pollOnlyWhenVisible: true }
)

// ============================================
// Computed: Template compatibility + derived state
// ============================================
const loading = computed(() => dashboardLoading.value && !dashboardData.value)
const error = computed(() => dashboardError.value?.message || null)
const stats = computed(() => dashboardData.value?.stats || {})
const recentHistory = computed(() => dashboardData.value?.recentHistory || [])
const awaitingDecisionCount = computed(() => dashboardData.value?.awaitingDecisionCount || 0)
const queueStats = computed(() => queueData.value?.queueStats || { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true })
const enrichmentStats = computed(() => queueData.value?.enrichmentStats || {})
const lastUpdated = computed(() => cacheTimestamp.value ? new Date(cacheTimestamp.value) : null)
const enrichmentTotal = computed(() => Number(enrichmentStats.value.totalItems || 0))
const enrichmentCompletedItems = computed(() => Number(enrichmentStats.value.completedItems || 0))
const enrichmentProcessingItems = computed(() => Number(enrichmentStats.value.processingItems || 0))
const enrichmentPendingItems = computed(() => Number(enrichmentStats.value.pendingItems || 0))
const enrichmentDeferredItems = computed(() => Number(enrichmentStats.value.deferredItems || 0))
const enrichmentFailedItems = computed(() => Number(enrichmentStats.value.failedItems || 0))
const enrichmentOmdb = computed(() => Number(enrichmentStats.value.omdbEnriched || 0))
const enrichmentTavily = computed(() => Number(enrichmentStats.value.tavilyEnriched || 0))
const enrichmentProgress = computed(() => (
  enrichmentTotal.value > 0
    ? Math.round((enrichmentCompletedItems.value / enrichmentTotal.value) * 100)
    : Number(enrichmentStats.value.progress || 0)
))

// Compute average confidence from backend all-time data
const computedAvgConfidence = computed(() => {
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

// Format relative time helper
const formatRelativeTime = (date) => {
  const seconds = Math.floor((new Date() - date) / 1000)
  
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// Manual refresh function for button
const loadDashboard = () => {
  refreshDashboard()
  refreshQueue()
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
    'existing_media': '🎬'
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
    'existing_media': 'Existing Media'
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
    'existing_media': 'text-pink-400'
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
    'existing_media': 'Based on existing media in libraries'
  }
  return tooltips[method] || 'Classification method'
}

// ============================================
// Keyboard Navigation
// ============================================
const handleKeyboard = (event) => {
  // Ctrl/Cmd + Shift + D: Refresh dashboard (non-conflicting shortcut)
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'd' || event.key === 'D')) {
    event.preventDefault()
    loadDashboard()
  }
  
  // Escape: Dismiss error (if shown)
  // Note: error is a computed property, so we clear the underlying dashboardError ref
  if (event.key === 'Escape' && error.value && dashboardError.value) {
    event.preventDefault()
    // Trigger a refresh to clear the error state
    loadDashboard()
  }
}

// Focus management on error
// Only focus when error appears (not when it's cleared)
watch(error, (newError, oldError) => {
  if (newError && !oldError) {
    nextTick(() => {
      const errorHeading = document.getElementById('error-heading')
      if (errorHeading) {
        errorHeading.focus()
      }
    })
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeyboard)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyboard)
})
</script>
