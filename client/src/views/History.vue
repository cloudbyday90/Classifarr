<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">Classification History</h1>

    <Card>
      <div v-if="loading" class="text-center py-12 text-gray-400">
        Loading history...
      </div>

      <div v-else-if="history.length === 0" class="text-center py-12 text-gray-400">
        No classification history yet
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead class="border-b border-gray-800">
            <tr class="text-left text-sm text-gray-400">
              <th class="pb-3">Title</th>
              <th class="pb-3">Type</th>
              <th class="pb-3">Library</th>
              <th class="pb-3">Method</th>
              <th class="pb-3">Confidence</th>
              <th class="pb-3">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in history"
              :key="item.id"
              class="border-b border-gray-800 hover:bg-background transition-colors cursor-pointer"
              @click="openDetail(item)"
            >
              <td class="py-3">
                <div class="font-medium">{{ item.title }}</div>
                <div class="text-sm text-gray-400">{{ item.year }}</div>
              </td>
              <td class="py-3">
                <Badge>{{ item.media_type }}</Badge>
              </td>
              <td class="py-3">{{ item.library_name }}</td>
              <td class="py-3">
                <Badge :variant="getMethodVariant(item.method)">
                  {{ item.method }}
                </Badge>
              </td>
              <td class="py-3">
                <Badge :variant="getConfidenceVariant(item.confidence)">
                  {{ item.confidence }}%
                </Badge>
              </td>
              <td class="py-3 text-sm text-gray-400">
                {{ formatDate(item.created_at) }}
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="pagination" class="flex items-center justify-between mt-6">
          <div class="text-sm text-gray-400">
            Page {{ pagination.page }} of {{ pagination.totalPages }}
          </div>
          <div class="flex gap-2">
            <Button
              @click="loadPage(pagination.page - 1)"
              :disabled="pagination.page <= 1"
              variant="secondary"
            >
              Previous
            </Button>
            <Button
              @click="loadPage(pagination.page + 1)"
              :disabled="pagination.page >= pagination.totalPages"
              variant="secondary"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </Card>

    <!-- Detail Modal -->
    <div v-if="selectedItem" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="selectedItem = null">
      <div class="bg-background-light rounded-lg border border-gray-700 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div class="p-6 border-b border-gray-700 flex items-center justify-between">
          <h2 class="text-xl font-bold">Classification Details</h2>
          <button @click="selectedItem = null" class="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>
        <div class="p-6 space-y-4">
          <!-- Title & Basic Info -->
          <div class="flex items-start gap-4">
            <div class="text-4xl">{{ selectedItem.media_type === 'movie' ? '🎬' : '📺' }}</div>
            <div>
              <h3 class="text-lg font-bold">{{ selectedItem.title }}</h3>
              <p class="text-gray-400">{{ selectedItem.year }} • {{ selectedItem.media_type }}</p>
              <p v-if="selectedItem.tmdb_id" class="text-sm text-gray-500">TMDB: {{ selectedItem.tmdb_id }}</p>
            </div>
          </div>

          <!-- Classification Result -->
          <div class="bg-background rounded-lg p-4 border border-gray-700">
            <div class="flex items-center justify-between mb-3">
              <span class="text-gray-400">Classified To:</span>
              <span class="font-bold text-primary">{{ selectedItem.library_name }}</span>
            </div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-gray-400">Confidence:</span>
              <Badge :variant="getConfidenceVariant(selectedItem.confidence)">
                {{ selectedItem.confidence }}%
              </Badge>
            </div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-gray-400">Method:</span>
              <Badge :variant="getMethodVariant(selectedItem.method)">
                {{ selectedItem.method }}
              </Badge>
            </div>
          </div>

          <!-- Reason (WHY it was classified this way) -->
          <div class="bg-background rounded-lg p-4 border border-gray-700">
            <h4 class="font-semibold mb-2 text-yellow-400">📋 Reason</h4>
            <p class="text-gray-300">{{ selectedItem.reason || 'No reason recorded' }}</p>
          </div>

          <!-- Metadata -->
          <div v-if="selectedItem.metadata" class="bg-background rounded-lg p-4 border border-gray-700">
            <h4 class="font-semibold mb-3">📊 Metadata</h4>
            
            <div v-if="parsedMetadata?.genres?.length" class="mb-3">
              <span class="text-gray-400 text-sm">Genres:</span>
              <div class="flex flex-wrap gap-1 mt-1">
                <Badge v-for="genre in parsedMetadata.genres" :key="genre" variant="secondary">{{ genre }}</Badge>
              </div>
            </div>

            <div v-if="parsedMetadata?.keywords?.length" class="mb-3">
              <span class="text-gray-400 text-sm">Keywords:</span>
              <div class="flex flex-wrap gap-1 mt-1">
                <Badge v-for="keyword in parsedMetadata.keywords.slice(0, 10)" :key="keyword" variant="info">{{ keyword }}</Badge>
                <span v-if="parsedMetadata.keywords.length > 10" class="text-gray-500">+{{ parsedMetadata.keywords.length - 10 }} more</span>
              </div>
            </div>

            <div v-if="parsedMetadata?.certification" class="mb-3">
              <span class="text-gray-400 text-sm">Rating:</span>
              <Badge class="ml-2">{{ parsedMetadata.certification }}</Badge>
            </div>

            <div v-if="parsedMetadata?.original_language" class="mb-3">
              <span class="text-gray-400 text-sm">Language:</span>
              <span class="ml-2 text-gray-300">{{ parsedMetadata.original_language }}</span>
            </div>

            <div v-if="parsedMetadata?.overview" class="mt-3">
              <span class="text-gray-400 text-sm">Overview:</span>
              <p class="text-gray-300 text-sm mt-1">{{ parsedMetadata.overview }}</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="space-y-3 pt-4 border-t border-gray-700">
            <!-- Correction Form -->
            <div v-if="!correcting" class="flex gap-3">
              <Button @click="correcting = true" variant="warning" class="flex-1">
                ✏️ Correct Classification
              </Button>
              <Button @click="selectedItem = null" variant="secondary" class="flex-1">Close</Button>
            </div>
            <div v-else class="space-y-3">
              <div>
                <label class="block text-sm text-gray-400 mb-1">Select correct library:</label>
                <select 
                  v-model="correctedLibraryId" 
                  class="w-full bg-background border border-gray-700 rounded-lg px-3 py-2 text-white"
                >
                  <option value="" disabled>Choose a library...</option>
                  <option v-for="lib in libraries" :key="lib.id" :value="lib.id">
                    {{ lib.name }}
                  </option>
                </select>
              </div>
              <div class="flex gap-3">
                <Button @click="submitCorrection" :disabled="!correctedLibraryId || submitting" class="flex-1">
                  {{ submitting ? 'Saving...' : '✅ Submit Correction' }}
                </Button>
                <Button @click="correcting = false; correctedLibraryId = ''" variant="secondary" class="flex-1">
                  Cancel
                </Button>
              </div>
              <p class="text-xs text-gray-500">This will teach the system to classify similar items correctly in the future.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useLibrariesStore } from '@/stores/libraries'
import api from '@/api'
import Card from '@/components/common/Card.vue'
import Badge from '@/components/common/Badge.vue'
import Button from '@/components/common/Button.vue'

const librariesStore = useLibrariesStore()
const libraries = computed(() => librariesStore.libraries)

const history = ref([])
const loading = ref(true)
const pagination = ref(null)
const selectedItem = ref(null)
const correcting = ref(false)
const correctedLibraryId = ref('')
const submitting = ref(false)

const parsedMetadata = computed(() => {
  if (!selectedItem.value?.metadata) return null
  try {
    return typeof selectedItem.value.metadata === 'string' 
      ? JSON.parse(selectedItem.value.metadata) 
      : selectedItem.value.metadata
  } catch {
    return null
  }
})

onMounted(async () => {
  await loadPage(1)
})

const openDetail = (item) => {
  selectedItem.value = item
}

const loadPage = async (page) => {
  loading.value = true
  try {
    await librariesStore.fetchLibraries()
    const response = await api.getHistory({ page, limit: 50 })
    history.value = response.data.data
    pagination.value = response.data.pagination
  } catch (error) {
    console.error('Failed to load history:', error)
  } finally {
    loading.value = false
  }
}

const submitCorrection = async () => {
  if (!selectedItem.value || !correctedLibraryId.value) return
  
  submitting.value = true
  try {
    await api.submitCorrection({
      classification_id: selectedItem.value.id,
      corrected_library_id: correctedLibraryId.value,
      corrected_by: 'user'
    })
    
    // Update the local item
    const lib = libraries.value.find(l => l.id === correctedLibraryId.value)
    if (lib) {
      selectedItem.value.library_name = lib.name
      selectedItem.value.library_id = lib.id
      // Update in history list too
      const historyItem = history.value.find(h => h.id === selectedItem.value.id)
      if (historyItem) {
        historyItem.library_name = lib.name
        historyItem.library_id = lib.id
      }
    }
    
    correcting.value = false
    correctedLibraryId.value = ''
    alert('Correction saved! The system will learn from this.')
  } catch (error) {
    console.error('Failed to submit correction:', error)
    alert('Failed to save correction: ' + error.message)
  } finally {
    submitting.value = false
  }
}

const getMethodVariant = (method) => {
  const variants = {
    exact_match: 'success',
    learned_pattern: 'info',
    rule_match: 'default',
    ai_fallback: 'warning',
  }
  return variants[method] || 'default'
}

const getConfidenceVariant = (confidence) => {
  if (confidence >= 90) return 'success'
  if (confidence >= 70) return 'info'
  if (confidence >= 50) return 'warning'
  return 'error'
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString()
}
</script>

