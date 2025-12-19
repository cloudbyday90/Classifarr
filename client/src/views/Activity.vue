<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold mb-2">Activity</h1>
      <p class="text-gray-400">Monitor real-time classification and webhook activity</p>
    </div>

    <!-- Queue Section -->
    <Card>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold">Processing Queue</h2>
          <Badge v-if="queueCount > 0" variant="warning">{{ queueCount }} pending</Badge>
          <Badge v-else variant="success">Empty</Badge>
        </div>
      </template>

      <div v-if="loading" class="text-center py-8">
        <Spinner />
        <p class="text-gray-400 mt-2">Loading queue...</p>
      </div>

      <div v-else-if="queueCount === 0" class="text-center py-8 text-gray-400">
        <ClockIcon class="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No items in queue</p>
      </div>

      <div v-else class="space-y-2">
        <div 
          v-for="item in queueItems"
          :key="item.id"
          class="p-4 bg-background-light rounded-lg border border-gray-700"
        >
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <h3 class="font-medium">{{ item.title }}</h3>
              <p class="text-sm text-gray-400">{{ item.type }} • Queued {{ formatTime(item.queued) }}</p>
            </div>
            <Spinner class="w-5 h-5" />
          </div>
        </div>
      </div>
    </Card>

    <!-- Recent Activity -->
    <Card>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold">Recent Activity</h2>
          <Button variant="secondary" size="sm" @click="refreshActivity">
            <ArrowPathIcon class="w-4 h-4 mr-2" :class="{ 'animate-spin': refreshing }" />
            Refresh
          </Button>
        </div>
      </template>

      <div v-if="loading" class="text-center py-8">
        <Spinner />
        <p class="text-gray-400 mt-2">Loading activity...</p>
      </div>

      <div v-else-if="recentActivity.length === 0" class="text-center py-8 text-gray-400">
        <DocumentTextIcon class="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No recent activity</p>
      </div>

      <div v-else class="space-y-2">
        <div 
          v-for="activity in recentActivity"
          :key="activity.id"
          class="p-4 bg-background-light rounded-lg border border-gray-700"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center space-x-2 mb-1">
                <Badge :variant="activity.success ? 'success' : 'error'">
                  {{ activity.success ? 'Success' : 'Failed' }}
                </Badge>
                <span class="text-sm text-gray-400">{{ formatTimestamp(activity.timestamp) }}</span>
              </div>
              <h3 class="font-medium">{{ activity.title }}</h3>
              <p class="text-sm text-gray-400 mt-1">
                {{ activity.mediaType }} → {{ activity.library }}
                <span v-if="activity.confidence" class="ml-2">
                  ({{ Math.round(activity.confidence * 100) }}% confidence)
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- Auto-refresh indicator -->
    <div class="text-center text-sm text-gray-500">
      Auto-refreshing every 30 seconds
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ClockIcon, DocumentTextIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'
import Card from '@/components/common/Card.vue'
import Badge from '@/components/common/Badge.vue'
import Button from '@/components/common/Button.vue'
import Spinner from '@/components/common/Spinner.vue'
import api from '@/api'

const loading = ref(true)
const refreshing = ref(false)
const queueCount = ref(0)
const queueItems = ref([])
const recentActivity = ref([])
let refreshTimer = null

const loadActivity = async () => {
  try {
    loading.value = true

    // In a real implementation, this would fetch from actual queue/activity endpoints
    // For now, we'll use the classification history
    const response = await api.get('/classification/history', {
      params: { limit: 20 }
    })

    if (response.data) {
      recentActivity.value = response.data.map(item => ({
        id: item.id,
        title: item.title,
        mediaType: item.media_type,
        library: item.selected_library,
        confidence: item.confidence_score,
        success: item.webhook_response?.success !== false,
        timestamp: item.created_at
      }))
    }

    // Queue would be checked from a different endpoint
    queueCount.value = 0
    queueItems.value = []

  } catch (error) {
    console.error('Failed to load activity:', error)
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const refreshActivity = async () => {
  refreshing.value = true
  await loadActivity()
}

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString()
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

onMounted(() => {
  loadActivity()
  
  // Auto-refresh every 30 seconds
  refreshTimer = setInterval(() => {
    loadActivity()
  }, 30000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})
</script>
