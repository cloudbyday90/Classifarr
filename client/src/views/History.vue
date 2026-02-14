<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Classification History</h1>
      <div v-if="selectedItems.length > 0" class="flex items-center gap-3">
        <span class="text-sm text-gray-400">{{ selectedItems.length }} selected</span>
        <Button 
          @click="handleReclassifyClick" 
          variant="warning"
          :disabled="!canReclassify"
          :title="!canReclassify ? lockdownTooltip : undefined"
        >
          <span v-if="!canReclassify">🔒 </span>🔄 {{ reclassifyActionLabel }}
        </Button>
        <Button @click="clearSelection" variant="secondary" size="sm">
          Clear
        </Button>
      </div>
    </div>

    <Card>
      <div class="mb-4 grid grid-cols-1 gap-3 border-b border-gray-800 pb-4 md:grid-cols-6">
        <input
          v-model="filters.search"
          type="text"
          placeholder="Search title..."
          class="md:col-span-2 rounded-lg border border-gray-700 bg-background px-3 py-2 text-sm text-white"
          @keyup.enter="applyFilters"
        />

        <select v-model="filters.media_type" class="rounded-lg border border-gray-700 bg-background px-3 py-2 text-sm text-white">
          <option value="">All types</option>
          <option value="movie">Movie</option>
          <option value="tv">TV</option>
        </select>

        <select v-model="filters.library_id" class="rounded-lg border border-gray-700 bg-background px-3 py-2 text-sm text-white">
          <option value="">All libraries</option>
          <option v-for="library in libraries" :key="`filter-library-${library.id}`" :value="String(library.id)">
            {{ library.name }}
          </option>
        </select>

        <select v-model="filters.method" class="rounded-lg border border-gray-700 bg-background px-3 py-2 text-sm text-white">
          <option value="">All methods</option>
          <option v-for="methodOption in methodOptions" :key="`filter-method-${methodOption.value}`" :value="methodOption.value">
            {{ methodOption.label }}
          </option>
        </select>

        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
            @click="toggleAdvancedFilters"
          >
            {{ showAdvancedFilters ? 'Hide Dates' : 'Dates' }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-blue-700/40 bg-blue-900/20 px-3 py-2 text-sm text-blue-200 hover:bg-blue-900/30"
            @click="applyFilters"
          >
            Apply
          </button>
          <button
            type="button"
            class="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
            @click="resetFilters"
          >
            Reset
          </button>
        </div>
      </div>

      <div v-if="showAdvancedFilters" class="mb-4 flex flex-wrap items-center gap-3 border-b border-gray-800 pb-4">
        <label class="text-sm text-gray-400">
          From
          <input v-model="filters.date_from" type="date" class="ml-2 rounded border border-gray-700 bg-background px-2 py-1 text-white" />
        </label>
        <label class="text-sm text-gray-400">
          To
          <input v-model="filters.date_to" type="date" class="ml-2 rounded border border-gray-700 bg-background px-2 py-1 text-white" />
        </label>
      </div>

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
              <th class="pb-3 w-8">
                <input 
                  type="checkbox" 
                  :checked="isAllSelected" 
                  @change="toggleSelectAll"
                  class="w-4 h-4 rounded-sm"
                />
              </th>
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
              :class="{ 'bg-primary/10': isSelected(item.id) }"
            >
              <td class="py-3" @click.stop>
                <input 
                  type="checkbox" 
                  :checked="isSelected(item.id)" 
                  @change="toggleSelection(item)"
                  class="w-4 h-4 rounded-sm"
                />
              </td>
              <td class="py-3" @click="openDetail(item)">
                <div class="font-medium">{{ item.title }}</div>
                <div class="text-sm text-gray-400">{{ item.year }}</div>
              </td>
              <td class="py-3" @click="openDetail(item)">
                <Badge>{{ item.media_type }}</Badge>
              </td>
              <td class="py-3" @click="openDetail(item)">{{ item.library_name }}</td>
              <td class="py-3" @click="openDetail(item)">
                <Badge :variant="getMethodVariant(item.method)">
                  {{ item.method }}
                </Badge>
              </td>
              <td class="py-3" @click="openDetail(item)">
                <Badge :variant="getConfidenceVariant(item.confidence)">
                  {{ item.confidence }}%
                </Badge>
              </td>
              <td class="py-3 text-sm text-gray-400" @click="openDetail(item)">
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
                {{ getFriendlyMethodName(selectedItem.method) }}
              </Badge>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-400">Date:</span>
              <span class="text-gray-300">
                {{ formatDate(selectedItem.created_at) }}
                <span 
                  v-if="parsedMetadata?.classification_details?.processing_time_ms" 
                  class="text-gray-500 text-sm"
                >
                  ({{ (parsedMetadata.classification_details.processing_time_ms / 1000).toFixed(2) }}s)
                </span>
              </span>
            </div>
          </div>

          <!-- Source Library Indicator -->
          <div 
            v-if="selectedItem.method === 'source_library'" 
            class="bg-blue-900/20 border border-blue-700 rounded-lg p-3"
          >
            <div class="flex items-start gap-2">
              <span class="text-blue-400 text-lg">ℹ️</span>
              <div class="text-sm">
                <p class="text-blue-300">This item already exists in your media server library.</p>
                <p class="text-blue-400/70 mt-1">No classification analysis was needed.</p>
              </div>
            </div>
          </div>

          <!-- Signal Breakdown -->
          <div 
            v-if="shouldShowSignalBreakdown" 
            class="bg-background rounded-lg p-4 border border-gray-700"
          >
            <h4 class="font-semibold mb-3 text-yellow-400">🔬 Classification Signals</h4>
            <div class="space-y-1">
              <SignalRow icon="⚙️" label="Preset"  :score="signalScores.preset"  :weight="signalWeights.preset" />
              <SignalRow icon="📊" label="Profile" :score="signalScores.profile" :weight="signalWeights.profile" />
              <SignalRow icon="📚" label="Pattern" :score="signalScores.pattern" :weight="signalWeights.pattern" />
              <SignalRow icon="🧠" label="RAG"     :score="signalScores.rag"     :weight="signalWeights.rag" :detail="ragSignalDetail" />
              <SignalRow icon="📖" label="History" :score="signalScores.history" :weight="signalWeights.history" />
            </div>
            <div class="mt-3 pt-3 border-t border-gray-700 flex justify-between">
              <span class="text-gray-400">Combined Score:</span>
              <span class="font-bold text-primary">{{ selectedItem.confidence }}%</span>
            </div>
          </div>

          <!-- Reason (WHY it was classified this way) -->
          <div class="bg-background rounded-lg p-4 border border-gray-700">
            <h4 class="font-semibold mb-2 text-yellow-400">📋 Reason</h4>
            <p class="text-gray-300">{{ selectedItem.reason || 'No reason recorded' }}</p>
          </div>

          <!-- RAG Loop Trace -->
          <div class="bg-background rounded-lg p-4 border border-gray-700">
            <h4 class="font-semibold mb-3 text-cyan-400">🔁 Targeted Re-check Trace</h4>
            <div v-if="ragLoopSummary.hasTrace" class="space-y-3">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div class="bg-gray-800/50 rounded-md p-2">
                  <span class="text-gray-400">Mode:</span>
                  <span class="ml-2 text-gray-200">{{ ragLoopSummary.mode || 'shadow' }}</span>
                </div>
                <div class="bg-gray-800/50 rounded-md p-2">
                  <span class="text-gray-400">Ran:</span>
                  <span class="ml-2 text-gray-200">{{ ragLoopSummary.ran ? 'yes' : 'no' }}</span>
                </div>
                <div class="bg-gray-800/50 rounded-md p-2">
                  <span class="text-gray-400">Trigger:</span>
                  <span class="ml-2 text-gray-200">{{ ragLoopSummary.trigger || 'n/a' }}</span>
                </div>
                <div class="bg-gray-800/50 rounded-md p-2">
                  <span class="text-gray-400">Strategy:</span>
                  <span class="ml-2 text-gray-200">{{ ragLoopSummary.strategy || 'n/a' }}</span>
                </div>
                <div class="bg-gray-800/50 rounded-md p-2">
                  <span class="text-gray-400">Top Similarity:</span>
                  <span class="ml-2 text-gray-200">{{ ragLoopBeforeAfterLabel }}</span>
                </div>
                <div class="bg-gray-800/50 rounded-md p-2">
                  <span class="text-gray-400">Decision:</span>
                  <span class="ml-2 text-gray-200">{{ ragLoopDecisionLabel }}</span>
                </div>
              </div>
              <div v-if="ragLoopSummary.events.length > 0">
                <p class="text-xs text-gray-400 mb-1">Stage summary</p>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="(event, idx) in ragLoopSummary.events.slice(0, 8)"
                    :key="`rag-loop-event-${idx}`"
                    class="px-2 py-1 rounded bg-gray-800 text-xs text-gray-200 border border-gray-700"
                  >
                    {{ event.stage }}: {{ event.outcome }}
                    <span v-if="event.reason" class="text-gray-400">({{ event.reason }})</span>
                  </span>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-gray-400">
              No second-pass trace recorded for this item.
            </p>
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

          <!-- Collapsible Library Profile Panel -->
          <div v-if="selectedItem.library_id" class="bg-background rounded-lg border border-gray-700">
            <button 
              @click="showLibraryProfile = !showLibraryProfile"
              class="w-full p-4 flex items-center justify-between text-left hover:bg-gray-800/50 transition-colors rounded-lg"
            >
              <span class="font-semibold text-blue-400">📊 Library Profile Used in Decision</span>
              <span class="text-gray-400 text-sm">{{ showLibraryProfile ? '▲ Hide' : '▼ Show' }}</span>
            </button>
            <div v-if="showLibraryProfile" class="border-t border-gray-700">
              <LibraryProfilePanel :classificationId="selectedItem.id" />
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

    <!-- Batch Reclassify Modal -->
    <BatchReclassifyModal
      v-model="showBatchModal"
      :items="selectedItems"
      @complete="onBatchComplete"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useLibrariesStore } from '@/stores/libraries'
import { useServiceRequirements } from '@/composables/useServiceRequirements'
import { useServiceLockdownDialog } from '@/composables/useServiceLockdownToast'
import api from '@/api'
import { buildRagLoopTraceSummary } from '@/utils/ragLoopUi'
import Card from '@/components/common/Card.vue'
import Badge from '@/components/common/Badge.vue'
import Button from '@/components/common/Button.vue'
import BatchReclassifyModal from '@/components/BatchReclassifyModal.vue'
import LibraryProfilePanel from '@/components/history/LibraryProfilePanel.vue'
import SignalRow from '@/components/history/SignalRow.vue'

const librariesStore = useLibrariesStore()
const libraries = computed(() => librariesStore.libraries)

// Service lockdown for AI provider
const { canUseFeature: canReclassify, lockdownTooltip, firstUnavailableService } = useServiceRequirements(['aiProvider'])
const { showLockdownNotification } = useServiceLockdownDialog()

const history = ref([])
const loading = ref(true)
const pagination = ref(null)
const selectedItem = ref(null)
const correcting = ref(false)
const correctedLibraryId = ref('')
const submitting = ref(false)
const showLibraryProfile = ref(false)
const showAdvancedFilters = ref(false)

const filters = ref({
  search: '',
  media_type: '',
  library_id: '',
  method: '',
  date_from: '',
  date_to: '',
})

// Batch selection state
const selectedItems = ref([])
const showBatchModal = ref(false)
const methodOptions = [
  { value: 'policy_engine', label: 'Policy Engine' },
  { value: 'policy_auto', label: 'Policy Auto' },
  { value: 'policy_prompt', label: 'Policy Prompt' },
  { value: 'source_library', label: 'Source Library' },
  { value: 'manual_classification', label: 'Manual Classification' },
  { value: 'manual_correction', label: 'Manual Correction' },
  { value: 'learned_pattern', label: 'Learned Pattern' },
  { value: 'exact_match', label: 'Exact Match' },
  { value: 'ai_analysis', label: 'AI Analysis' },
  { value: 'ai_fallback', label: 'AI Fallback' },
  { value: 'ai_verified', label: 'AI Verified' },
]

const isAllSelected = computed(() => {
  return history.value.length > 0 && selectedItems.value.length === history.value.length
})

const reclassifyActionLabel = computed(() => {
  return selectedItems.value.length > 1 ? 'Batch Reclassify' : 'Reclassify'
})

const isSelected = (id) => {
  return selectedItems.value.some(item => item.id === id)
}

const toggleSelection = (item) => {
  const index = selectedItems.value.findIndex(i => i.id === item.id)
  if (index >= 0) {
    selectedItems.value.splice(index, 1)
  } else {
    selectedItems.value.push(item)
  }
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedItems.value = []
  } else {
    selectedItems.value = [...history.value]
  }
}

const clearSelection = () => {
  selectedItems.value = []
}

const handleReclassifyClick = () => {
  // Check if AI provider is available
  if (!canReclassify.value) {
    showLockdownNotification(firstUnavailableService.value)
    return
  }
  
  showBatchModal.value = true
}

const onBatchComplete = () => {
  clearSelection()
  loadPage(pagination.value?.page || 1)
}

const toggleAdvancedFilters = () => {
  showAdvancedFilters.value = !showAdvancedFilters.value
}

const buildHistoryFilters = () => {
  const params = {}
  if (filters.value.search?.trim()) params.search = filters.value.search.trim()
  if (filters.value.media_type) params.media_type = filters.value.media_type
  if (filters.value.library_id) params.library_id = filters.value.library_id
  if (filters.value.method) params.method = filters.value.method
  if (filters.value.date_from) params.date_from = filters.value.date_from
  if (filters.value.date_to) params.date_to = filters.value.date_to
  return params
}

const applyFilters = async () => {
  await loadPage(1)
}

const resetFilters = async () => {
  filters.value = {
    search: '',
    media_type: '',
    library_id: '',
    method: '',
    date_from: '',
    date_to: '',
  }
  await loadPage(1)
}

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

const signalScores = computed(() => {
  return parsedMetadata.value?.classification_details?.scores || null
})

const signalWeights = computed(() => {
  return parsedMetadata.value?.classification_details?.weights || {
    preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10
  }
})

const ragSignalDetail = computed(() => {
  const details = parsedMetadata.value?.classification_details?.rag_details
  if (!details) return ''
  const parts = []
  if (Number.isFinite(details.combined_similarity)) {
    parts.push(`Combined ${Math.round(details.combined_similarity * 100)}%`)
  }
  if (Number.isFinite(details.text_similarity)) {
    parts.push(`Text ${Math.round(details.text_similarity * 100)}%`)
  }
  if (Number.isFinite(details.image_similarity)) {
    parts.push(`Image ${Math.round(details.image_similarity * 100)}%`)
  }
  if (Number.isFinite(details.text_weight) || Number.isFinite(details.image_weight)) {
    const textWeight = Number.isFinite(details.text_weight) ? details.text_weight : 0
    const imageWeight = Number.isFinite(details.image_weight) ? details.image_weight : 0
    parts.push(`W ${textWeight.toFixed(2)}/${imageWeight.toFixed(2)}`)
  }
  return parts.join(' • ')
})

const ragLoopSummary = computed(() => {
  return buildRagLoopTraceSummary(parsedMetadata.value, selectedItem.value?.confidence)
})

const ragLoopDecisionLabel = computed(() => {
  if (!ragLoopSummary.value.hasTrace) return null
  if (ragLoopSummary.value.decisionOutcome === 'pass2') {
    return 'Applied'
  }
  return `Skipped (${ragLoopSummary.value.decisionReason || 'baseline_preserved'})`
})

const ragLoopBeforeAfterLabel = computed(() => {
  if (!ragLoopSummary.value.hasTrace) return null
  const before = ragLoopSummary.value.beforeScorePercent
  const after = ragLoopSummary.value.afterScorePercent
  if (Number.isFinite(before) && Number.isFinite(after)) {
    return `${before}% -> ${after}%`
  }
  return 'n/a'
})

// Check if signal breakdown should be shown (only for policy engine methods with actual scores)
const shouldShowSignalBreakdown = computed(() => {
  if (!signalScores.value) return false
  // Check if any signal has a non-zero score (indicating policy engine was used)
  const hasNonZeroScore = Object.values(signalScores.value).some(score => score > 0)
  return hasNonZeroScore
})

const methodDisplayNames = {
  'policy_engine': 'Policy Engine',
  'policy_auto': 'Policy Engine',
  'policy_prompt': 'Policy Engine',
  'source_library': 'Source Library',
  'manual_classification': 'Manual',
  'manual_correction': 'Manual',
  'learned_pattern': 'Learned Pattern',
  'exact_match': 'Exact Match',
  'ai_analysis': 'AI Analysis',
  'ai_fallback': 'AI Analysis',
  'ai_verified': 'AI Verified',
  'signal_calculation': 'Signal Calculation',
  'rule_match': 'Rule Match',
  'existing_media': 'Existing Media',
  'holiday_detection': 'Holiday Detection',
  'queued_for_retry': 'Queued For Retry'
}

const getFriendlyMethodName = (method) => {
  return methodDisplayNames[method] || 
    method?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 
    'Unknown'
}

onMounted(async () => {
  await loadPage(1)
})

const openDetail = (item) => {
  selectedItem.value = item
  showLibraryProfile.value = false
}

const loadPage = async (page) => {
  loading.value = true
  try {
    await librariesStore.fetchLibraries()
    const response = await api.getHistory({
      page,
      limit: 50,
      ...buildHistoryFilters(),
    })
    history.value = response.data.data
    pagination.value = response.data.pagination
    selectedItems.value = selectedItems.value.filter(selected =>
      history.value.some(item => item.id === selected.id)
    )
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
    // New standardized names
    'exact_match': 'success',
    'learned_pattern': 'info',
    'custom_rule': 'default',
    'ai_analysis': 'warning',
    'source_library': 'success',
    'manual_correction': 'success',
    'existing_media': 'success',
    'reclassification': 'warning',
    // Legacy names (backwards compatibility)
    'rule_match': 'default',
    'ai_fallback': 'warning',
    'library_rule': 'default',
    'learned_correction': 'success',
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

