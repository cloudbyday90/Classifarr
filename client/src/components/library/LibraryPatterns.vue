<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold flex items-center gap-2">
          <span class="text-2xl">🧩</span>
          Learned Patterns
        </h3>
        <p class="text-sm text-gray-400 mt-1">
          Patterns that route media to this library
        </p>
      </div>
      <div class="flex gap-2">
        <button
          @click="discoverPatterns"
          :disabled="discovering"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
        >
          <span v-if="discovering">🔄 Discovering...</span>
          <span v-else>🔍 Discover Patterns</span>
        </button>
        <router-link
          to="/patterns"
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
        >
          View All Patterns →
        </router-link>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      <p class="text-gray-400 mt-2">Loading patterns...</p>
    </div>

    <!-- No Patterns -->
    <div v-else-if="patterns.length === 0" class="text-center py-8 bg-gray-800/50 rounded-lg">
      <span class="text-4xl">🧩</span>
      <p class="text-gray-400 mt-2">No patterns discovered for this library yet</p>
      <p class="text-sm text-gray-500 mt-1">
        Click "Discover Patterns" to analyze classification history
      </p>
    </div>

    <!-- Patterns Table -->
    <div v-else class="space-y-4">
      <!-- Active Patterns -->
      <div v-if="activePatterns.length > 0">
        <h4 class="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
          <span>📊 Active Patterns</span>
          <span class="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
            {{ activePatterns.length }}
          </span>
        </h4>
        <div class="bg-gray-800/50 rounded-lg overflow-hidden">
          <table class="min-w-full divide-y divide-gray-700">
            <thead class="bg-gray-900/50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Pattern
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Confidence
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Matches
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-700">
              <tr v-for="pattern in activePatterns" :key="pattern.id" class="hover:bg-gray-700/30">
                <td class="px-4 py-3 whitespace-nowrap">
                  <span class="text-sm">{{ formatPatternType(pattern.pattern_type) }}</span>
                </td>
                <td class="px-4 py-3">
                  <span class="text-sm font-medium">{{ pattern.pattern_value }}</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <div class="w-16 bg-gray-700 rounded-full h-2">
                      <div
                        class="h-2 rounded-full transition-all"
                        :class="getConfidenceColor(pattern.confidence)"
                        :style="{ width: `${pattern.confidence}%` }"
                      ></div>
                    </div>
                    <span class="text-sm font-medium">{{ pattern.confidence }}%</span>
                  </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span class="text-sm text-gray-400">{{ pattern.sample_size || 0 }} matches</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <div class="flex gap-2">
                    <button
                      v-if="pattern.status === 'discovered'"
                      @click="approvePattern(pattern.id)"
                      class="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 rounded transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      @click="rejectPattern(pattern.id)"
                      class="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      @click="viewDetails(pattern.id)"
                      class="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
                    >
                      Details
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Suggested Patterns -->
      <div v-if="suggestedPatterns.length > 0">
        <h4 class="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
          <span>💡 Suggested Patterns</span>
          <span class="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
            {{ suggestedPatterns.length }}
          </span>
        </h4>
        <div class="bg-gray-800/50 rounded-lg overflow-hidden">
          <table class="min-w-full divide-y divide-gray-700">
            <thead class="bg-gray-900/50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Pattern
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Confidence
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Matches
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-700">
              <tr v-for="pattern in suggestedPatterns" :key="pattern.id" class="hover:bg-gray-700/30">
                <td class="px-4 py-3 whitespace-nowrap">
                  <span class="text-sm">{{ formatPatternType(pattern.pattern_type) }}</span>
                </td>
                <td class="px-4 py-3">
                  <span class="text-sm font-medium">{{ pattern.pattern_value }}</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <div class="w-16 bg-gray-700 rounded-full h-2">
                      <div
                        class="h-2 rounded-full transition-all"
                        :class="getConfidenceColor(pattern.confidence)"
                        :style="{ width: `${pattern.confidence}%` }"
                      ></div>
                    </div>
                    <span class="text-sm font-medium">{{ pattern.confidence }}%</span>
                  </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span class="text-sm text-gray-400">{{ pattern.sample_size || 0 }} matches</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <div class="flex gap-2">
                    <button
                      @click="approvePattern(pattern.id)"
                      class="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 rounded transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      @click="rejectPattern(pattern.id)"
                      class="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api'

const props = defineProps({
  libraryId: {
    type: Number,
    required: true
  }
})

const router = useRouter()
const loading = ref(false)
const discovering = ref(false)
const patterns = ref([])

const activePatterns = computed(() => {
  return patterns.value.filter(p => p.status === 'approved' || p.status === 'discovered')
    .sort((a, b) => b.confidence - a.confidence)
})

const suggestedPatterns = computed(() => {
  return patterns.value.filter(p => p.status === 'discovered')
    .sort((a, b) => b.confidence - a.confidence)
})

async function loadPatterns() {
  loading.value = true
  try {
    const response = await api.getLibraryPatterns(props.libraryId)
    patterns.value = response.data.patterns || []
  } catch (error) {
    console.error('Failed to load library patterns:', error)
  } finally {
    loading.value = false
  }
}

async function discoverPatterns() {
  discovering.value = true
  try {
    await api.discoverLibraryPatterns(props.libraryId)
    await loadPatterns()
  } catch (error) {
    console.error('Failed to discover patterns:', error)
  } finally {
    discovering.value = false
  }
}

async function approvePattern(id) {
  try {
    await api.approvePattern(id, { approved_by: 'user' })
    await loadPatterns()
  } catch (error) {
    console.error('Failed to approve pattern:', error)
  }
}

async function rejectPattern(id) {
  try {
    await api.rejectPattern(id, { rejected_by: 'user' })
    await loadPatterns()
  } catch (error) {
    console.error('Failed to reject pattern:', error)
  }
}

function viewDetails(id) {
  // Navigate to global patterns page with this pattern highlighted
  router.push({ path: '/patterns', query: { pattern: id } })
}

function formatPatternType(type) {
  const types = {
    'studio': '🎬 Studio',
    'franchise': '🎭 Franchise',
    'genre': '🎨 Genre',
    'certification': '🔞 Certification',
    'keyword': '🔑 Keyword'
  }
  return types[type] || type
}

function getConfidenceColor(confidence) {
  if (confidence >= 90) return 'bg-green-500'
  if (confidence >= 70) return 'bg-yellow-500'
  return 'bg-orange-500'
}

onMounted(() => {
  loadPatterns()
})
</script>
