<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="space-y-3">
    <h3 class="text-lg font-semibold">
      Coverage by library
    </h3>
    <p class="text-sm text-gray-300">
      Changes compare consecutive hourly samples of the same inventory population.
      Unchanged coverage does not establish a failure: captured metadata can have unknown traits.
      Library names are current labels; times and counts describe the recorded samples.
    </p>
    <p v-if="!latest?.libraryIds.length">
      No selected libraries in the latest retained sample.
    </p>
    <p v-if="latest?.selectionChanged">
      Selected libraries changed in the latest sample.
    </p>
    <div
      v-for="library in selected"
      :key="library.id"
      class="space-y-2 rounded border border-gray-600 p-3"
    >
      <h4 class="font-medium">
        {{ library.label }}
      </h4>
      <p v-if="library.row">
        Keywords {{ ratio(library.row.keywordRows, library.row.identifiedRows) }};
        language {{ ratio(library.row.languageRows, library.row.identifiedRows) }};
        captured {{ ratio(library.row.capturedRows, library.row.identifiedRows) }}.
      </p>
      <p>{{ change(library.row) }}</p>
      <p v-if="library.row?.populationChanged && library.row.comparison !== 'population_changed'">
        Inventory population also changed.
      </p>
      <p v-if="library.row?.unchangedIntervals">
        {{ unchanged(library.row) }}
      </p>
      <details>
        <summary class="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          Hourly trend for {{ library.label }}
        </summary>
        <LibraryObservationTrendTable
          :samples="samples"
          :library-id="library.id"
          :label="library.label"
          class="mt-3"
        />
      </details>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { observationHistoryRatio as ratio } from '@/utils/observationHistoryDisplay'
import { observationTrendChange as change, observationTrendUnchanged as unchanged } from '@/utils/observationTrendDisplay'
import LibraryObservationTrendTable from './LibraryObservationTrendTable.vue'
const props = defineProps({ samples: { type: Array, required: true }, libraries: { type: Array, default: () => [] } })
const latest = computed(() => props.samples[0])
const selected = computed(() => (latest.value?.libraryIds || []).map(id => {
  const name = props.libraries.find(library => library.id === id)?.name
  return { id, label: name ? `${name} (library ${id})` : `Library ${id}`,
    row: latest.value.libraryCoverage?.find(row => row.libraryId === id) }
}))
</script>
