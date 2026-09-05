<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    aria-labelledby="library-overlap-title"
    class="space-y-4 break-words rounded-lg border border-gray-700 bg-gray-800 p-4"
    :aria-busy="loading"
  >
    <h2
      id="library-overlap-title"
      class="text-xl font-semibold"
    >
      What libraries have in common
    </h2>
    <p class="text-sm text-gray-300">
      Existing placements and traits describe your inventory. They do not verify
      classification accuracy. Movie and TV identities are compared separately.
    </p>
    <p role="status">
      {{ statusText }}
    </p>
    <div v-if="error">
      <p role="alert">
        Library comparison is unavailable. Try again shortly.
      </p>
      <button
        type="button"
        class="mt-2 rounded border border-gray-500 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        @click="load"
      >
        Retry library comparison
      </button>
    </div>
    <template v-if="report">
      <p class="text-sm text-gray-300">
        Snapshot: {{ report.observedAt }}. Includes {{ report.scope.selectedLibraryCount }} of
        {{ report.scope.activeLibraryCount }} active libraries, selected by library ID
        (limit {{ report.scope.libraryLimit }}). Inactive libraries are excluded.
      </p>
      <p v-if="report.scope.excludedLibraryCount">
        {{ report.scope.excludedLibraryCount }} active libraries are outside this comparison.
      </p>
      <p v-if="report.status === 'capacity_exceeded'">
        Comparison withheld: the selected libraries exceed the {{ report.scope.rowLimit }}-row
        inventory limit. No partial inventory percentages are shown.
      </p>
      <template v-else>
        <p class="text-sm text-gray-300">
          Identity coverage counts inventory rows. Overlap and common traits count
          distinct identified items, with repeated placements counted once within each library.
        </p>
        <div
          v-if="report.libraries.length"
          class="overflow-x-auto"
          role="region"
          aria-label="Library identity coverage"
          tabindex="0"
        >
          <table class="library-overlap-table w-full min-w-[42rem] text-left text-sm">
            <caption class="pb-2 text-left font-semibold">
              Inventory and identity coverage
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  Library / type
                </th>
                <th scope="col">
                  Inventory rows
                </th>
                <th scope="col">
                  Rows with ID
                </th>
                <th scope="col">
                  Distinct IDs
                </th>
                <th scope="col">
                  Repeated rows
                </th>
                <th scope="col">
                  Missing ID
                </th>
              </tr>
            </thead>
            <tbody>
              <template
                v-for="library in report.libraries"
                :key="library.id"
              >
                <tr
                  v-for="cohort in library.cohorts.filter(value => value.rowCount)"
                  :key="cohort.mediaType"
                >
                  <th
                    scope="row"
                    class="py-2 pr-3"
                  >
                    {{ library.name }} (#{{ library.id }}) / {{ cohort.mediaType }}
                  </th>
                  <td>{{ cohort.rowCount }}</td>
                  <td>{{ cohort.identifiedRowCount }} / {{ cohort.rowCount }} ({{ cohort.identityCoveragePercent }}%)</td>
                  <td>{{ cohort.distinctIdentityCount }}</td>
                  <td>{{ cohort.duplicateRowCount }}</td>
                  <td>{{ cohort.unidentifiedRowCount }}</td>
                </tr>
                <tr v-if="!library.inventoryRowCount || library.unsupportedTypeRowCount || library.omittedTraitRowCount">
                  <th
                    scope="row"
                    class="py-2 pr-3"
                  >
                    {{ library.name }} (#{{ library.id }}) / coverage notes
                  </th>
                  <td colspan="5">
                    <span v-if="!library.inventoryRowCount">No inventory rows. </span>
                    <span v-if="library.unsupportedTypeRowCount">{{ library.unsupportedTypeRowCount }} rows have an unsupported media type. </span>
                    <span v-if="library.omittedTraitRowCount">{{ library.omittedTraitRowCount }} rows have oversized trait fields withheld. </span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <p v-if="!report.pairs.length">
          No two selected libraries contain rows of the same supported media type.
        </p>
        <div
          v-for="pair in report.pairs"
          :key="`${pair.leftLibraryId}:${pair.rightLibraryId}:${pair.mediaType}`"
          class="space-y-2 border-t border-gray-600 pt-4"
        >
          <h3 class="font-semibold">
            {{ libraryName(pair.leftLibraryId) }} / {{ libraryName(pair.rightLibraryId) }} — {{ pair.mediaType }}
          </h3>
          <p v-if="pair.identityStatus === 'insufficient_coverage'">
            Insufficient identity coverage to compare these libraries.
          </p>
          <template v-else>
            <p>
              Shared identities: {{ pair.sharedIdentityCount }}.
              {{ pair.sharedIdentityCount }} / {{ pair.leftIdentityCount }} ({{ pair.leftOverlapPercent }}%) of {{ libraryName(pair.leftLibraryId) }};
              {{ pair.sharedIdentityCount }} / {{ pair.rightIdentityCount }} ({{ pair.rightOverlapPercent }}%) of {{ libraryName(pair.rightLibraryId) }}.
            </p>
            <p v-if="pair.identityStatus === 'partial_coverage'">
              Partial identity coverage; unidentified rows may contain additional overlap.
            </p>
          </template>
          <LibraryOverlapTraits
            :pair="pair"
            :left-name="libraryName(pair.leftLibraryId)"
            :right-name="libraryName(pair.rightLibraryId)"
          />
        </div>
      </template>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getLibraryOverlap } from '@/api/libraryCatalogApi'
import LibraryOverlapTraits from './LibraryOverlapTraits.vue'

const report = ref(null)
const loading = ref(true)
const error = ref(false)
let active = true
const statusText = computed(() => loading.value ? 'Loading library comparison…' :
  report.value?.status === 'available' ? `Library comparisons loaded: ${report.value.pairs.length}.` :
    report.value?.status === 'capacity_exceeded' ? 'Library comparison exceeds the inventory limit.' : '')
const libraryName = id => {
  const library = report.value.libraries.find(value => value.id === id)
  return `${library.name} (#${id})`
}
async function load() {
  loading.value = true
  error.value = false
  report.value = null
  try {
    const result = await getLibraryOverlap()
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
.library-overlap-table th,
.library-overlap-table td {
  padding: 0.5rem 0.75rem;
  vertical-align: top;
}
</style>
