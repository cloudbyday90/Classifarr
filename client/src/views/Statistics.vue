<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Statistics & Analytics</h1>
      <p class="text-gray-400 text-sm">Classification performance and trends</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-8 text-gray-400">
      Loading statistics...
    </div>

    <div v-else class="space-y-6">
      <!-- Summary Cards -->
      <div class="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 text-center">
          <div class="text-3xl font-bold text-primary">{{ stats.overall?.total || 0 }}</div>
          <div class="text-xs text-gray-400 mt-1">Total</div>
        </div>
        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 text-center">
          <div class="text-3xl font-bold text-green-400">{{ stats.overall?.avg_confidence || 0 }}%</div>
          <div class="text-xs text-gray-400 mt-1">Avg Confidence</div>
        </div>
        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 text-center">
          <div class="text-3xl font-bold text-green-400">{{ stats.overall?.high_confidence || 0 }}</div>
          <div class="text-xs text-gray-400 mt-1">High (90%+)</div>
        </div>
        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 text-center">
          <div class="text-3xl font-bold text-red-400">{{ stats.overall?.low_confidence || 0 }}</div>
          <div class="text-xs text-gray-400 mt-1">Low (&lt;50%)</div>
        </div>
        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 text-center">
          <div class="text-3xl font-bold text-blue-400">{{ stats.overall?.last_24h || 0 }}</div>
          <div class="text-xs text-gray-400 mt-1">Last 24h</div>
        </div>
        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 text-center">
          <div class="text-3xl font-bold text-purple-400">{{ stats.overall?.last_7d || 0 }}</div>
          <div class="text-xs text-gray-400 mt-1">Last 7 Days</div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Daily Trend -->
        <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 class="text-lg font-medium mb-4">Daily Classifications (30 days)</h3>
          <div class="h-48 flex items-end gap-1">
            <div
              v-for="(day, index) in stats.daily"
              :key="index"
              class="flex-1 bg-blue-500 rounded-t transition-all hover:bg-blue-400"
              :style="{ height: getDayHeight(day.count) }"
              :title="`${day.date}: ${day.count} classifications, ${day.avg_confidence}% avg`"
            ></div>
          </div>
          <div class="flex justify-between text-xs text-gray-500 mt-2">
            <span>{{ formatDate(stats.daily?.[0]?.date) }}</span>
            <span>{{ formatDate(stats.daily?.[stats.daily?.length - 1]?.date) }}</span>
          </div>
        </div>

        <!-- By Method -->
        <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 class="text-lg font-medium mb-4">Classification Methods</h3>
          <div class="space-y-3">
            <div v-for="method in stats.byMethod" :key="method.method" class="space-y-1">
              <div class="flex justify-between text-sm">
                <span class="capitalize">{{ method.method || 'unknown' }}</span>
                <span>{{ method.count }} ({{ method.avg_confidence }}%)</span>
              </div>
              <div class="w-full bg-gray-700 rounded-full h-2">
                <div
                  class="h-2 rounded-full transition-all"
                  :class="getMethodColor(method.method)"
                  :style="{ width: getMethodWidth(method.count) }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Secondary Stats -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- By Library -->
        <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 class="text-lg font-medium mb-4">By Library</h3>
          <div class="space-y-3">
            <div
              v-for="lib in stats.byLibrary"
              :key="lib.id"
              class="flex items-center justify-between text-sm"
            >
              <span>{{ lib.name }}</span>
              <div class="text-right">
                <span class="font-medium">{{ lib.count }}</span>
                <span class="text-gray-500 ml-1">({{ lib.avg_confidence || 0 }}%)</span>
              </div>
            </div>
            <div v-if="stats.byLibrary?.length === 0" class="text-gray-500 text-center py-4">
              No library data yet
            </div>
          </div>
        </div>

        <!-- By Media Type -->
        <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 class="text-lg font-medium mb-4">By Media Type</h3>
          <div class="space-y-4">
            <div
              v-for="type in stats.byMediaType"
              :key="type.media_type"
              class="flex items-center gap-3"
            >
              <span class="text-2xl">{{ type.media_type === 'movie' ? '🎬' : '📺' }}</span>
              <div class="flex-1">
                <div class="flex justify-between">
                  <span class="capitalize">{{ type.media_type }}</span>
                  <span class="font-medium">{{ type.count }}</span>
                </div>
                <div class="text-xs text-gray-500">{{ type.avg_confidence }}% avg</div>
              </div>
            </div>
            <div v-if="stats.byMediaType?.length === 0" class="text-gray-500 text-center py-4">
              No media type data yet
            </div>
          </div>
        </div>

        <!-- Top Titles -->
        <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 class="text-lg font-medium mb-4">Top Classified Titles</h3>
          <div class="space-y-2">
            <div
              v-for="(title, index) in stats.topTitles"
              :key="index"
              class="flex items-center gap-2 text-sm"
            >
              <span class="text-gray-500 w-4">{{ index + 1 }}.</span>
              <span class="flex-1 truncate">{{ title.title }}</span>
              <span class="text-gray-400">{{ title.count }}x</span>
            </div>
            <div v-if="stats.topTitles?.length === 0" class="text-gray-500 text-center py-4">
              No classification data yet
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/api'

const loading = ref(true)
const stats = ref({})

onMounted(async () => {
  try {
    const response = await api.getDetailedStats()
    stats.value = response.data
  } catch (error) {
    console.error('Failed to load stats:', error)
  } finally {
    loading.value = false
  }
})

const maxDaily = computed(() => {
  if (!stats.value.daily?.length) return 1
  return Math.max(...stats.value.daily.map(d => d.count), 1)
})

const totalMethods = computed(() => {
  if (!stats.value.byMethod?.length) return 1
  return stats.value.byMethod.reduce((sum, m) => sum + parseInt(m.count), 0) || 1
})

const getDayHeight = (count) => {
  return `${Math.max(5, (count / maxDaily.value) * 100)}%`
}

const getMethodWidth = (count) => {
  return `${(count / totalMethods.value) * 100}%`
}

const getMethodColor = (method) => {
  const colors = {
    exact: 'bg-green-500',
    learned: 'bg-blue-500',
    rule: 'bg-purple-500',
    ai: 'bg-yellow-500',
    unknown: 'bg-gray-500'
  }
  return colors[method] || colors.unknown
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>
