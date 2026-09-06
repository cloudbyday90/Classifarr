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
      Acquisition outcomes and coverage are recorded automatically for up to seven days.
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
      <p class="text-sm text-gray-300">
        Outcomes cover committed acquisition attempts across all inventory.
        Task completion alone does not establish capture.
      </p>
      <LibraryObservationSampling
        v-if="report.librarySampling"
        :sampling="report.librarySampling"
        :points="report.librarySamples"
        :libraries="libraries"
      />
      <LibraryObservationActivityTable :activity="report.activity" />
      <details
        v-if="report.librarySampling && report.samples.length"
        class="rounded border border-gray-600 p-3"
      >
        <summary class="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          Earlier hourly coverage from legacy sampling
        </summary>
        <LibraryObservationLegacyCoverage
          :samples="report.samples"
          :libraries="libraries"
          class="mt-3"
        />
      </details>
      <LibraryObservationLegacyCoverage
        v-else-if="!report.librarySampling"
        :samples="report.samples"
        :libraries="libraries"
      />
    </template>
  </section>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { getLibraryObservationHistory } from '@/api/libraryCatalogApi'
import LibraryObservationActivityTable from './LibraryObservationActivityTable.vue'
import LibraryObservationLegacyCoverage from './LibraryObservationLegacyCoverage.vue'
import LibraryObservationSampling from './LibraryObservationSampling.vue'

defineProps({ libraries: { type: Array, default: () => [] } })

const report = ref(null)
const loading = ref(true)
const error = ref(false)
let active = true
async function load() {
  loading.value = true
  error.value = false
  report.value = null
  try {
    const result = await getLibraryObservationHistory()
    if (!Array.isArray(result?.activity) || !Array.isArray(result?.samples)) throw new Error('Invalid history response')
    if (result.librarySampling && (result.librarySampling.version !== 'library.observation_sampling.v2'
      || !Array.isArray(result.librarySamples))) throw new Error('Invalid sampling response')
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
