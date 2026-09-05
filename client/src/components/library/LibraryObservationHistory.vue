<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    aria-labelledby="observation-history-title"
    :aria-busy="loading"
    class="space-y-4 break-words rounded-lg border border-gray-700 bg-gray-800 p-4"
  >
    <h2
      id="observation-history-title"
      class="text-xl font-semibold"
    >
      Metadata acquisition progress
    </h2>
    <p class="text-sm text-gray-300">
      Acquisition outcomes and hourly coverage are recorded automatically for up to seven days.
      Empty captures can still have unknown keywords or language.
    </p>
    <p role="status">
      {{ loading ? 'Loading acquisition history…' : report ? 'Acquisition history loaded.' : '' }}
    </p>
    <div v-if="error">
      <p role="alert">
        Acquisition history is unavailable. Try again shortly.
      </p>
      <button
        type="button"
        class="mt-2 rounded border border-gray-500 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        @click="load"
      >
        Retry acquisition history
      </button>
    </div>
    <template v-if="report">
      <p v-if="latestCoverage?.status === 'available'">
        Most recent coverage: keywords {{ ratio(latestCoverage.keywordRows, latestCoverage.identifiedRows) }};
        language {{ ratio(latestCoverage.languageRows, latestCoverage.identifiedRows) }}.
        Sampled {{ time(latestCoverage.observedAt) }}.
      </p>
      <p v-else-if="latestCoverage">
        The latest coverage sample exceeds the inventory limit. Coverage counts are withheld.
      </p>
      <p v-else>
        No coverage samples have been recorded yet. Sampling starts automatically after startup.
      </p>
      <p class="text-sm text-gray-300">
        Outcomes cover committed acquisition attempts across all inventory. Coverage samples cover up to 12 active
        libraries and 20,000 rows. Library selection and inventory can change between samples.
        Gaps are unrecorded periods, and task completion alone does not establish capture.
      </p>
      <LibraryObservationActivityTable :activity="report.activity" />
      <LibraryObservationTrends
        :samples="report.samples"
        :libraries="libraries"
      />
      <LibraryObservationCoverageTable :samples="report.samples" />
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getLibraryObservationHistory } from '@/api/libraryCatalogApi'
import { observationHistoryTime as time, observationHistoryRatio as ratio } from '@/utils/observationHistoryDisplay'
import LibraryObservationActivityTable from './LibraryObservationActivityTable.vue'
import LibraryObservationCoverageTable from './LibraryObservationCoverageTable.vue'
import LibraryObservationTrends from './LibraryObservationTrends.vue'

defineProps({ libraries: { type: Array, default: () => [] } })

const report = ref(null)
const loading = ref(true)
const error = ref(false)
const latestCoverage = computed(() => report.value?.samples[0])
let active = true
async function load() {
  loading.value = true
  error.value = false
  report.value = null
  try {
    const result = await getLibraryObservationHistory()
    if (!Array.isArray(result?.activity) || !Array.isArray(result?.samples)) throw new Error('Invalid history response')
    if (active) report.value = result
  } catch {
    if (active) error.value = true
  } finally {
    if (active) loading.value = false
  }
}
onMounted(load)
onBeforeUnmount(() => { active = false })
</script>
