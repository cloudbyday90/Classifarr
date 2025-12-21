<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Manual Request</h1>
        <p class="text-gray-400 text-sm">Submit a classification request directly without Overseerr/Seer</p>
      </div>
    </div>

    <!-- Search Box -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div class="space-y-4">
        <div class="flex gap-4">
          <div class="flex-1">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search for a movie or TV show..."
              class="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
              @keyup.enter="search"
            />
          </div>
          <select
            v-model="searchType"
            class="px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="multi">All</option>
            <option value="movie">Movies</option>
            <option value="tv">TV Shows</option>
          </select>
          <button
            @click="search"
            :disabled="searching || searchQuery.length < 2"
            class="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {{ searching ? '...' : '🔍 Search' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Search Results -->
    <div v-if="results.length > 0" class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      <div class="p-4 border-b border-gray-700">
        <h2 class="text-lg font-medium">Search Results</h2>
      </div>
      <div class="divide-y divide-gray-700">
        <div
          v-for="item in results"
          :key="`${item.media_type}-${item.id}`"
          class="flex items-center gap-4 p-4 hover:bg-gray-750 transition-colors"
        >
          <img
            v-if="item.poster_path"
            :src="item.poster_path"
            :alt="item.title"
            class="w-16 h-24 object-cover rounded"
          />
          <div v-else class="w-16 h-24 bg-gray-700 rounded flex items-center justify-center text-2xl">
            {{ item.media_type === 'movie' ? '🎬' : '📺' }}
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="font-medium text-lg">{{ item.title }}</span>
              <span v-if="item.year" class="text-gray-400">({{ item.year }})</span>
              <span 
                :class="['text-xs px-2 py-0.5 rounded', item.media_type === 'movie' ? 'bg-blue-900/30 text-blue-400' : 'bg-purple-900/30 text-purple-400']"
              >
                {{ item.media_type === 'movie' ? 'Movie' : 'TV' }}
              </span>
            </div>
            <p class="text-sm text-gray-400 line-clamp-2 mt-1">{{ item.overview || 'No description available' }}</p>
            <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span>TMDB: {{ item.id }}</span>
              <span v-if="item.vote_average">⭐ {{ item.vote_average.toFixed(1) }}</span>
            </div>
          </div>
          <button
            @click="submitRequest(item)"
            :disabled="submitting === item.id"
            class="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {{ submitting === item.id ? '...' : '➕ Classify' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="searchedOnce && !searching" class="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center text-gray-500">
      No results found for "{{ lastQuery }}"
    </div>

    <!-- Recent Requests -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      <div class="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 class="text-lg font-medium">Recent Manual Requests</h2>
        <button
          @click="loadRecent"
          class="text-sm text-gray-400 hover:text-white"
        >
          🔄 Refresh
        </button>
      </div>

      <div v-if="recentRequests.length === 0" class="p-8 text-center text-gray-500">
        No manual requests yet
      </div>

      <div v-else class="divide-y divide-gray-700">
        <div
          v-for="request in recentRequests"
          :key="request.id"
          class="flex items-center justify-between p-4"
        >
          <div>
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ request.media_title }}</span>
              <span 
                :class="['text-xs px-2 py-0.5 rounded', request.media_type === 'movie' ? 'bg-blue-900/30 text-blue-400' : 'bg-purple-900/30 text-purple-400']"
              >
                {{ request.media_type }}
              </span>
            </div>
            <div class="text-xs text-gray-500 mt-1">
              TMDB: {{ request.tmdb_id }}
              <span v-if="request.routed_to_library"> • → {{ request.routed_to_library }}</span>
              <span v-if="request.processing_time_ms"> • {{ request.processing_time_ms }}ms</span>
            </div>
          </div>
          <span
            :class="[
              'px-2 py-1 text-xs rounded',
              request.processing_status === 'completed' ? 'bg-green-900/30 text-green-400' :
              request.processing_status === 'failed' ? 'bg-red-900/30 text-red-400' :
              request.processing_status === 'queued' ? 'bg-yellow-900/30 text-yellow-400' :
              'bg-gray-900 text-gray-400'
            ]"
          >
            {{ request.processing_status }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'

const toast = useToast()

const searchQuery = ref('')
const searchType = ref('multi')
const searching = ref(false)
const searchedOnce = ref(false)
const lastQuery = ref('')
const results = ref([])
const recentRequests = ref([])
const submitting = ref(null)

onMounted(() => {
  loadRecent()
})

const search = async () => {
  if (searchQuery.value.length < 2) {
    toast.error('Please enter at least 2 characters')
    return
  }

  searching.value = true
  lastQuery.value = searchQuery.value
  
  try {
    const response = await api.searchTMDB(searchQuery.value, searchType.value)
    results.value = response.data
    searchedOnce.value = true
  } catch (error) {
    console.error('Search failed:', error)
    toast.error('Search failed: ' + (error.response?.data?.error || error.message))
  } finally {
    searching.value = false
  }
}

const submitRequest = async (item) => {
  submitting.value = item.id
  
  try {
    await api.submitManualRequest({
      tmdbId: item.id,
      mediaType: item.media_type,
      title: item.title
    })
    toast.success(`"${item.title}" queued for classification`)
    await loadRecent()
  } catch (error) {
    console.error('Submit failed:', error)
    toast.error('Failed to submit: ' + (error.response?.data?.error || error.message))
  } finally {
    submitting.value = null
  }
}

const loadRecent = async () => {
  try {
    const response = await api.getRecentManualRequests()
    recentRequests.value = response.data
  } catch (error) {
    console.error('Failed to load recent requests:', error)
  }
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
