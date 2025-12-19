<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <Card title="Welcome to Classifarr" description="AI-powered media classification for the *arr ecosystem">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div class="bg-background rounded-lg p-4 border border-gray-800">
          <div class="text-3xl font-bold text-primary">{{ stats.total || 0 }}</div>
          <div class="text-sm text-gray-400 mt-1">Total Classifications</div>
        </div>
        <div class="bg-background rounded-lg p-4 border border-gray-800">
          <div class="text-3xl font-bold text-success">{{ libraries.length }}</div>
          <div class="text-sm text-gray-400 mt-1">Active Libraries</div>
        </div>
        <div class="bg-background rounded-lg p-4 border border-gray-800">
          <div class="text-3xl font-bold text-warning">{{ stats.avgConfidence || 0 }}%</div>
          <div class="text-sm text-gray-400 mt-1">Avg Confidence</div>
        </div>
      </div>
    </Card>

    <Card title="Recent Classifications">
      <div v-if="recentHistory.length === 0" class="text-center py-8 text-gray-400">
        No classifications yet
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="item in recentHistory"
          :key="item.id"
          class="flex items-center justify-between p-3 bg-background rounded-lg border border-gray-800"
        >
          <div class="flex-1">
            <div class="font-medium">{{ item.title }}</div>
            <div class="text-sm text-gray-400">{{ item.library_name }}</div>
          </div>
          <Badge :variant="getConfidenceVariant(item.confidence)">
            {{ item.confidence }}% {{ item.method }}
          </Badge>
        </div>
      </div>
    </Card>

    <Card title="Quick Actions">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Button @click="$router.push('/libraries')">
          📚 Manage Libraries
        </Button>
        <Button @click="$router.push('/settings')" variant="secondary">
          ⚙️ Configure Settings
        </Button>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useLibrariesStore } from '@/stores/libraries'
import api from '@/api'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Badge from '@/components/common/Badge.vue'

const librariesStore = useLibrariesStore()
const { libraries } = librariesStore

const stats = ref({})
const recentHistory = ref([])

onMounted(async () => {
  await librariesStore.fetchLibraries()
  
  try {
    const statsRes = await api.getStats()
    stats.value = statsRes.data
    
    const historyRes = await api.getHistory({ page: 1, limit: 5 })
    recentHistory.value = historyRes.data.data || []
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
  }
})

const getConfidenceVariant = (confidence) => {
  if (confidence >= 90) return 'success'
  if (confidence >= 70) return 'info'
  if (confidence >= 50) return 'warning'
  return 'error'
}
</script>
