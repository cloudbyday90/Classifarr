<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    aria-labelledby="observation-health-title"
    :aria-busy="loading"
    class="space-y-4 break-words rounded-lg border border-gray-700 bg-gray-800 p-4"
  >
    <h2
      id="observation-health-title"
      class="text-xl font-semibold"
    >
      Metadata coverage and freshness
    </h2>
    <p class="text-sm text-gray-300">
      Automatically collected TMDb observations help explain your libraries.
      Missing keywords and original language remain unknown.
    </p>
    <p role="status">
      {{ statusText }}
    </p>
    <div v-if="error">
      <p role="alert">
        Observation health is unavailable. Try again shortly.
      </p>
      <button
        type="button"
        class="mt-2 rounded border border-gray-500 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        @click="load"
      >
        Retry observation health
      </button>
    </div>
    <template v-if="report">
      <p class="text-sm text-gray-300">
        Snapshot: {{ report.observedAt }}. Includes {{ report.scope.selectedLibraryCount }} of
        {{ report.scope.activeLibraryCount }} active libraries, selected by library ID
        (limit {{ report.scope.libraryLimit }}). Inactive libraries are excluded.
      </p>
      <p v-if="!report.acquisitionConfigured">
        Automatic TMDb observation acquisition is not configured. Existing observations remain visible.
      </p>
      <p v-if="report.scope.excludedLibraryCount">
        {{ report.scope.excludedLibraryCount }} active libraries are outside this summary.
      </p>
      <p v-if="report.status === 'capacity_exceeded'">
        Health counts withheld: selected inventory exceeds {{ report.scope.rowLimit }} rows.
        No sampled percentages are shown.
      </p>
      <template v-else>
        <p class="text-sm text-gray-300">
          Identity coverage uses movie/TV inventory rows. Keyword, language and fresh
          capture counts use identified movie/TV rows. Source rows count separately,
          including repeated placements. A recent capture can still have missing traits.
        </p>
        <div
          v-if="report.libraries.length"
          role="region"
          aria-label="Observation coverage table"
          tabindex="0"
          class="overflow-x-auto"
        >
          <table class="health-table w-full min-w-[58rem] text-left text-sm">
            <caption class="pb-2 text-left font-semibold">
              Observation coverage by library
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  Library
                </th>
                <th scope="col">
                  Identified / movie-TV rows
                </th>
                <th scope="col">
                  Keywords / identified rows
                </th>
                <th scope="col">
                  Language / identified rows
                </th>
                <th scope="col">
                  Fresh / identified rows
                </th>
                <th scope="col">
                  Latest successful observation
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="library in report.libraries"
                :key="library.id"
              >
                <th scope="row">
                  {{ library.name }} (#{{ library.id }})
                </th>
                <td>{{ library.identifiedRowCount }} / {{ library.supportedRowCount }} ({{ percentage(library.identityCoveragePercent) }})</td>
                <td>{{ library.counts.keywordsKnown }} / {{ library.identifiedRowCount }} ({{ percentage(library.keywordCoveragePercent) }})</td>
                <td>{{ library.counts.languageKnown }} / {{ library.identifiedRowCount }} ({{ percentage(library.languageCoveragePercent) }})</td>
                <td>{{ library.states.fresh }} / {{ library.identifiedRowCount }}</td>
                <td>{{ library.lastSuccessfulObservationAt || 'Not recorded' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else>
          No active libraries are available for observation health.
        </p>
        <LibraryObservationHealthDetails
          v-for="library in report.libraries"
          :key="library.id"
          :library="library"
          :freshness="report.freshness"
        />
      </template>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getLibraryObservationHealth } from '@/api/libraryCatalogApi'
import LibraryObservationHealthDetails from './LibraryObservationHealthDetails.vue'

const report = ref(null)
const loading = ref(true)
const error = ref(false)
let active = true
const percentage = value => value === null ? 'unknown' : `${value}%`
const statusText = computed(() => loading.value ? 'Loading observation health…' :
  report.value?.status === 'available' ? `Observation health loaded. Libraries measured: ${report.value.libraries.length}.` :
    report.value?.status === 'capacity_exceeded' ? 'Observation health exceeds the inventory limit.' : '')
async function load() {
  loading.value = true
  error.value = false
  report.value = null
  try {
    const result = await getLibraryObservationHealth()
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

<style scoped>
.health-table th,
.health-table td {
  padding: 0.5rem 0.75rem;
  vertical-align: top;
}
</style>
