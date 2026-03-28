<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">

    <!-- Header strip -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
      <div class="flex flex-wrap items-center gap-4 text-sm">
        <div class="flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs uppercase tracking-wide">
          Graph Retrieval
        </div>
        <div class="flex items-center gap-2">
          <span :class="['w-2 h-2 rounded-full', config.rag_graph_enabled ? 'bg-green-500' : 'bg-gray-500']"></span>
          <span class="text-gray-400">Status:</span>
          <span :class="config.rag_graph_enabled ? 'text-green-400' : 'text-gray-400'">
            {{ config.rag_graph_enabled ? 'Enabled' : 'Disabled' }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-gray-400">Active dimensions:</span>
          <span class="text-white">{{ activeDimensionCount }}</span>
        </div>
      </div>
    </div>

    <!-- Master toggle -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div class="flex items-start justify-between">
        <div>
          <h3 class="text-lg font-semibold text-white">Graph Retrieval</h3>
          <p class="mt-1 text-sm text-gray-400 max-w-2xl">
            Augments the existing vector + full-text RAG pipeline with a third, structured retrieval
            path. Finds past classifications that are relationally connected to the query item
            (same franchise/collection, director, studio, or cast) even when semantic similarity
            is too low to surface them. Implemented as Postgres-native indexed columns — no external
            graph database required.
          </p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer ml-6 mt-1 shrink-0">
          <input type="checkbox" v-model="config.rag_graph_enabled" class="sr-only peer" />
          <div class="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-blue-600
                      peer-focus:ring-2 peer-focus:ring-blue-500
                      after:content-[''] after:absolute after:top-0.5 after:left-[2px]
                      after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all
                      peer-checked:after:translate-x-full"></div>
        </label>
      </div>

      <div v-if="!config.rag_graph_enabled" class="mt-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700 text-sm text-gray-400">
        Graph retrieval is disabled. Enable it to add franchise/collection, director, studio, and
        cast signal to classification lookups. Run the backfill script first for best results.
      </div>
    </div>

    <!-- Config panels — only shown when enabled -->
    <template v-if="config.rag_graph_enabled">

      <!-- Fusion weight -->
      <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-white mb-1">Fusion Weight</h3>
        <p class="text-sm text-gray-400 mb-4">
          Controls how much the graph signal contributes in the 3-way weighted RRF
          fusion alongside vector (weight 1.0) and full-text (weight 1.0) tracks.
          At 0.20 a top-1 graph hit adds ~20% of what a top-1 vector hit adds.
          At 1.0 graph contributes equally.
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Graph RRF Weight
              <span class="ml-1 text-gray-500">(0.00 – 1.00)</span>
            </label>
            <input
              v-model.number="config.rag_graph_weight"
              type="number"
              min="0"
              max="1"
              step="0.01"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white
                     focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <p class="mt-1 text-xs text-gray-500">Default: 0.20. Higher values give graph more influence over final ranking.</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Candidates Limit
            </label>
            <input
              v-model.number="config.rag_graph_candidates_limit"
              type="number"
              min="1"
              max="100"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white
                     focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <p class="mt-1 text-xs text-gray-500">Max graph candidates passed to RRF per query (default 20). Mirrors top_k used for vector/text paths.</p>
          </div>
        </div>
        <div class="mt-4">
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Minimum Matches to Apply
          </label>
          <div class="w-full md:w-1/2">
            <input
              v-model.number="config.rag_graph_min_matches_to_apply"
              type="number"
              min="1"
              max="20"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white
                     focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <p class="mt-1 text-xs text-gray-500">
              Minimum graph hits required before graph signal enters fusion. Avoids injecting a single very weak hit
              when the database has little history (default 1).
            </p>
          </div>
        </div>
      </div>

      <!-- Dimensions -->
      <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-white mb-1">Retrieval Dimensions</h3>
        <p class="text-sm text-gray-400 mb-4">
          Each dimension adds a separate signal arm to the graph query. Higher-precision dimensions
          (collection, director) are enabled by default. Higher-noise dimensions (studio, cast, genre)
          are off by default and should be validated before enabling.
        </p>

        <div class="space-y-4">
          <!-- Collection -->
          <div class="flex items-start justify-between py-3 border-b border-gray-700">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-white text-sm">Collection / Franchise</span>
                <span class="text-xs bg-green-500/20 text-green-300 border border-green-500/30 px-2 py-0.5 rounded-full">High precision</span>
              </div>
              <p class="text-xs text-gray-400 mt-1">
                Finds items in the same TMDB franchise or collection (e.g. all Star Wars films).
                Uses the existing indexed <code class="text-gray-300">collection_id</code> column — zero additional storage.
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer ml-6 mt-1 shrink-0">
              <input type="checkbox" v-model="config.rag_graph_collection_enabled" class="sr-only peer" />
              <div class="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-blue-600
                          after:content-[''] after:absolute after:top-0.5 after:left-[2px]
                          after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all
                          peer-checked:after:translate-x-full"></div>
            </label>
          </div>

          <!-- Director -->
          <div class="flex items-start justify-between py-3 border-b border-gray-700">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-white text-sm">Director / Showrunner</span>
                <span class="text-xs bg-green-500/20 text-green-300 border border-green-500/30 px-2 py-0.5 rounded-full">High precision</span>
              </div>
              <p class="text-xs text-gray-400 mt-1">
                Matches items with the same director (movies) or showrunner/creator (TV).
                Requires the enrichment fix from Issue 286 and backfill for existing rows.
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer ml-6 mt-1 shrink-0">
              <input type="checkbox" v-model="config.rag_graph_director_enabled" class="sr-only peer" />
              <div class="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-blue-600
                          after:content-[''] after:absolute after:top-0.5 after:left-[2px]
                          after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all
                          peer-checked:after:translate-x-full"></div>
            </label>
          </div>

          <!-- Studio -->
          <div class="flex items-start justify-between py-3 border-b border-gray-700">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-white text-sm">Production Studio</span>
                <span class="text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-2 py-0.5 rounded-full">Higher noise</span>
              </div>
              <p class="text-xs text-gray-400 mt-1">
                Matches items from the same primary production company. Higher false-positive rate —
                large studios produce many unrelated titles. Recommended: validate before enabling.
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer ml-6 mt-1 shrink-0">
              <input type="checkbox" v-model="config.rag_graph_studio_enabled" class="sr-only peer" />
              <div class="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-blue-600
                          after:content-[''] after:absolute after:top-0.5 after:left-[2px]
                          after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all
                          peer-checked:after:translate-x-full"></div>
            </label>
          </div>

          <!-- Cast -->
          <div class="flex items-start justify-between py-3 border-b border-gray-700">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-white text-sm">Cast Overlap</span>
                <span class="text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full">High noise</span>
              </div>
              <p class="text-xs text-gray-400 mt-1">
                Matches items sharing any of the top-5 cast members (TMDB person ID overlap).
                High recall but high noise — the same actor appears in very different genres.
                Uses <code class="text-gray-300">integer[]</code> GIN index for fast overlap queries.
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer ml-6 mt-1 shrink-0">
              <input type="checkbox" v-model="config.rag_graph_cast_enabled" class="sr-only peer" />
              <div class="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-blue-600
                          after:content-[''] after:absolute after:top-0.5 after:left-[2px]
                          after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all
                          peer-checked:after:translate-x-full"></div>
            </label>
          </div>

          <!-- Genre -->
          <div class="flex items-start justify-between py-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-white text-sm">Genre Overlap</span>
                <span class="text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full">High noise</span>
              </div>
              <p class="text-xs text-gray-400 mt-1">
                Matches items sharing any genre name (e.g. "Action"). Very high noise — most libraries span
                only a few genres, so genre overlap connects almost everything. Enable only on libraries with
                fine-grained genre tagging.
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer ml-6 mt-1 shrink-0">
              <input type="checkbox" v-model="config.rag_graph_genre_enabled" class="sr-only peer" />
              <div class="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-blue-600
                          after:content-[''] after:absolute after:top-0.5 after:left-[2px]
                          after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all
                          peer-checked:after:translate-x-full"></div>
            </label>
          </div>
        </div>
      </div>

      <!-- Backfill reminder -->
      <div class="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 text-sm text-blue-300">
        <div class="font-semibold mb-1">✅ Backfill runs automatically at startup</div>
        <p>
          Classifarr populates relationship columns for existing history rows in the background each time it starts,
          so no manual step is required. Check the Data Readiness panel below to see current fill rates.
          Collection signal is available immediately from the existing
          <code class="text-blue-200">collection_id</code> column.
        </p>
        <p class="mt-2 text-blue-400/70 text-xs">
          Advanced: to run the backfill manually (e.g. after a large import), use
          <code class="text-blue-300">docker exec classifarr node server/src/scripts/backfillGraphRelationships.js</code>.
        </p>
      </div>

    </template>

    <!-- Data Readiness -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold text-white">Data Readiness</h3>
          <p class="text-sm text-gray-400 mt-1">
            Fill-rate for graph relationship columns in <code class="text-gray-300">classification_history</code>.
            Classifarr backfills these automatically at startup. Aim for ≥80% before enabling graph retrieval.
          </p>
        </div>
        <button
          @click="loadFillRate"
          :disabled="fillRateLoading"
          class="shrink-0 ml-4 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
        >
          {{ fillRateLoading ? 'Loading…' : 'Refresh' }}
        </button>
      </div>

      <div v-if="fillRateError" class="text-sm text-red-400 mb-3">
        {{ fillRateError }}
      </div>

      <div v-if="fillRate" class="space-y-2">
        <div class="text-xs text-gray-500 mb-3">
          Rows with non-null metadata: <span class="text-gray-300 font-medium">{{ fillRate.total.toLocaleString() }}</span>
        </div>
        <template v-for="dim in fillRateDimensions" :key="dim.key">
          <div class="flex items-center gap-3">
            <span class="w-36 text-sm text-gray-300 shrink-0">{{ dim.label }}</span>
            <div class="flex-1 bg-gray-900 rounded-full h-2">
              <div
                class="h-2 rounded-full transition-all"
                :class="fillRateBarClass(fillRate[dim.pct])"
                :style="{ width: (fillRate[dim.pct] ?? 0) + '%' }"
              ></div>
            </div>
            <span class="w-20 text-right text-sm shrink-0" :class="fillRateTextClass(fillRate[dim.pct])">
              {{ fillRate[dim.pct] !== null ? fillRate[dim.pct] + '%' : 'n/a' }}
              <span class="text-gray-500 text-xs">({{ fillRate[dim.count].toLocaleString() }})</span>
            </span>
          </div>
        </template>
      </div>

      <div v-else-if="!fillRateLoading && !fillRateError" class="text-sm text-gray-500">
        Click Refresh to check fill rates.
      </div>
    </div>

    <!-- Save button -->
    <div class="flex items-center justify-between">
      <div v-if="saveMessage" :class="['text-sm', saveError ? 'text-red-400' : 'text-green-400']">
        {{ saveMessage }}
      </div>
      <div v-else></div>
      <button
        @click="saveConfig"
        :disabled="saving"
        class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors
               disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ saving ? 'Saving…' : 'Save Configuration' }}
      </button>
    </div>

  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '@/api'

const config = ref({
  rag_graph_enabled: false,
  rag_graph_weight: 0.20,
  rag_graph_collection_enabled: true,
  rag_graph_director_enabled: true,
  rag_graph_studio_enabled: false,
  rag_graph_cast_enabled: false,
  rag_graph_genre_enabled: false,
  rag_graph_min_matches_to_apply: 1,
  rag_graph_candidates_limit: 20
})

const saving = ref(false)
const saveMessage = ref('')
const saveError = ref(false)

const fillRate = ref(null)
const fillRateLoading = ref(false)
const fillRateError = ref('')

const fillRateDimensions = [
  { key: 'collection', label: 'Collection',      pct: 'pct_collection', count: 'has_collection' },
  { key: 'director',   label: 'Director',         pct: 'pct_director',   count: 'has_director'   },
  { key: 'studio',     label: 'Studio',           pct: 'pct_studio',     count: 'has_studio'     },
  { key: 'cast',       label: 'Cast',             pct: 'pct_cast',       count: 'has_cast'       },
  { key: 'genres',     label: 'Genres',           pct: 'pct_genres',     count: 'has_genres'     }
]

const fillRateBarClass = (pct) => {
  if (pct === null) return 'bg-gray-600'
  if (pct >= 80) return 'bg-green-500'
  if (pct >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

const fillRateTextClass = (pct) => {
  if (pct === null) return 'text-gray-500'
  if (pct >= 80) return 'text-green-400'
  if (pct >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

const loadFillRate = async () => {
  fillRateLoading.value = true
  fillRateError.value = ''
  try {
    const res = await api.getRagGraphFillRate()
    fillRate.value = res.data
  } catch (err) {
    fillRateError.value = err.response?.data?.error || 'Failed to load fill-rate data'
  } finally {
    fillRateLoading.value = false
  }
}

const activeDimensionCount = computed(() => {
  if (!config.value.rag_graph_enabled) return 0
  return [
    config.value.rag_graph_collection_enabled,
    config.value.rag_graph_director_enabled,
    config.value.rag_graph_studio_enabled,
    config.value.rag_graph_cast_enabled,
    config.value.rag_graph_genre_enabled
  ].filter(Boolean).length
})

const loadConfig = async () => {
  try {
    const res = await api.getAIConfig()
    const data = res.data || {}
    config.value = {
      rag_graph_enabled:              data.rag_graph_enabled              ?? false,
      rag_graph_weight:               Number(data.rag_graph_weight        ?? 0.20),
      rag_graph_collection_enabled:   data.rag_graph_collection_enabled   ?? true,
      rag_graph_director_enabled:     data.rag_graph_director_enabled     ?? true,
      rag_graph_studio_enabled:       data.rag_graph_studio_enabled       ?? false,
      rag_graph_cast_enabled:         data.rag_graph_cast_enabled         ?? false,
      rag_graph_genre_enabled:        data.rag_graph_genre_enabled        ?? false,
      rag_graph_min_matches_to_apply: Number(data.rag_graph_min_matches_to_apply ?? 1),
      rag_graph_candidates_limit:     Number(data.rag_graph_candidates_limit     ?? 20)
    }
  } catch (err) {
    console.error('Failed to load graph retrieval config:', err)
  }
}

const saveConfig = async () => {
  saving.value = true
  saveMessage.value = ''
  saveError.value = false
  try {
    await api.updateAIConfig({
      rag_graph_enabled:              config.value.rag_graph_enabled,
      rag_graph_weight:               config.value.rag_graph_weight,
      rag_graph_collection_enabled:   config.value.rag_graph_collection_enabled,
      rag_graph_director_enabled:     config.value.rag_graph_director_enabled,
      rag_graph_studio_enabled:       config.value.rag_graph_studio_enabled,
      rag_graph_cast_enabled:         config.value.rag_graph_cast_enabled,
      rag_graph_genre_enabled:        config.value.rag_graph_genre_enabled,
      rag_graph_min_matches_to_apply: config.value.rag_graph_min_matches_to_apply,
      rag_graph_candidates_limit:     config.value.rag_graph_candidates_limit
    })
    saveMessage.value = 'Configuration saved'
  } catch (err) {
    console.error('Failed to save graph retrieval config:', err)
    saveMessage.value = err.response?.data?.error || 'Failed to save configuration'
    saveError.value = true
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadConfig()
  loadFillRate()
})
</script>
