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
          <div v-if="recentHistory.length === 0" class="text-center py-8 text-gray-400">
            No classifications yet. Submit a request to get started!
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="item in recentHistory"
              :key="item.id"
              class="flex items-center justify-between p-3 bg-background rounded-lg border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <div class="flex items-center gap-3">
                <span class="text-xl">{{ item.media_type === 'movie' ? '🎬' : '📺' }}</span>
                <div>
                  <div class="font-medium">{{ item.title }}</div>
                  <div class="text-sm text-gray-400">
                    <span v-if="item.status === 'awaiting_decision'">⏳ Awaiting Decision</span>
                    <span v-else>→ {{ item.library_name }}</span>
                  </div>
                </div>
              </div>
              <Badge :variant="getConfidenceVariant(item.confidence)">
                {{ item.confidence }}%
              </Badge>
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
          <div class="space-y-3">
            <Button @click="$router.push('/request')" class="w-full">
              ➕ New Request
            </Button>
            <Button @click="$router.push('/libraries')" variant="secondary" class="w-full">
              📚 Libraries
            </Button>
            <Button @click="$router.push('/queue')" variant="ghost" class="w-full">
              📋 Queue Status
            </Button>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useLibrariesStore } from '@/stores/libraries'
import api from '@/api'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Badge from '@/components/common/Badge.vue'
import SetupBanner from '@/components/SetupBanner.vue'
import ArrConfigWarning from '@/components/settings/ArrConfigWarning.vue'

const librariesStore = useLibrariesStore()

const stats = ref({})

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

onMounted(async () => {
  await loadData()
  // Poll queue stats every 5 seconds
  pollInterval = setInterval(loadQueueStats, 5000)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

const loadData = async () => {
  await librariesStore.fetchLibraries()
  
  try {
    const [statsRes, historyRes, queueRes] = await Promise.all([
      api.getStats(),
      api.getHistory({ page: 1, limit: 8, excludeMethod: 'source_library' }),
      api.getQueueStats()
    ])
    
    stats.value = statsRes.data
    recentHistory.value = historyRes.data.data || []
    queueStats.value = queueRes // getQueueStats already extracts .data
    
    // Load awaiting decision count
    try {
      const pendingRes = await api.get('/classification/pending/count')
      awaitingDecisionCount.value = pendingRes.data.count || 0
    } catch (e) {
      console.error('Failed to load awaiting decision count:', e)
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
  }
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
