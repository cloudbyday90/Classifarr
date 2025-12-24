<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- System Status Row -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div class="flex items-center gap-2">
          <span class="text-2xl">{{ queueStats.ollamaAvailable ? '🟢' : '🔴' }}</span>
          <div>
            <div class="text-sm font-medium">Ollama</div>
            <div class="text-xs text-gray-400">{{ queueStats.ollamaAvailable ? 'Online' : 'Offline' }}</div>
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

    <!-- Enrichment Progress Row -->
    <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-xl">📊</span>
          <span class="font-medium">Library Enrichment Progress</span>
        </div>
        <span class="text-sm text-gray-400">{{ enrichmentStats.enriched }} / {{ enrichmentStats.totalItems }} items</span>
      </div>
      <div class="w-full bg-gray-700 rounded-full h-3 mb-2">
        <div 
          class="bg-gradient-to-r from-blue-500 to-primary h-3 rounded-full transition-all duration-500"
          :style="{ width: enrichmentStats.progress + '%' }"
        ></div>
      </div>
      <div class="flex justify-between text-xs text-gray-400">
        <span>{{ enrichmentStats.progress }}% Complete</span>
        <div class="flex gap-4">
          <span>🔍 Tavily: {{ enrichmentStats.tavilyEnriched }}</span>
          <span>⏳ Pending: {{ queueStats.pending }}</span>
        </div>
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
                  <div class="text-sm text-gray-400">→ {{ item.library_name }}</div>
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
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-400">Exact Match</span>
              <span class="text-green-400">{{ methodStats.exact || 0 }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Learned</span>
              <span class="text-blue-400">{{ methodStats.learned || 0 }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Rule-Based</span>
              <span class="text-purple-400">{{ methodStats.rule || 0 }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">AI</span>
              <span class="text-yellow-400">{{ methodStats.ai || 0 }}</span>
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

const librariesStore = useLibrariesStore()

const stats = ref({})

// Compute average confidence from the array of {method, avg_confidence}
const computedAvgConfidence = computed(() => {
  const avgData = stats.value.avgConfidence
  if (!avgData || !Array.isArray(avgData) || avgData.length === 0) {
    return 0
  }
  // Calculate overall average from all methods
  const total = avgData.reduce((sum, item) => sum + parseFloat(item.avg_confidence || 0), 0)
  return Math.round(total / avgData.length)
})
const recentHistory = ref([])
const queueStats = ref({ pending: 0, processing: 0, completed: 0, failed: 0, ollamaAvailable: true })
const enrichmentStats = ref({ totalItems: 0, enriched: 0, tavilyEnriched: 0, progress: 0 })
const methodStats = ref({})
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
    
    // Calculate method stats from recent history
    const methods = {}
    recentHistory.value.forEach(item => {
      const method = item.method || 'unknown'
      methods[method] = (methods[method] || 0) + 1
    })
    methodStats.value = methods
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
</script>
