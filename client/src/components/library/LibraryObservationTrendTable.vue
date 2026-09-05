<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div
    role="region"
    :aria-label="`Coverage trend table for ${label}`"
    tabindex="0"
    class="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
  >
    <table class="w-full min-w-[64rem] text-left text-sm">
      <caption class="pb-2 text-left font-medium">
        Hourly coverage for {{ label }}, newest first
      </caption>
      <thead>
        <tr>
          <th scope="col">
            Sample time
          </th>
          <th scope="col">
            Inventory / identified rows
          </th>
          <th scope="col">
            Captured / identified
          </th>
          <th scope="col">
            Fresh / identified
          </th>
          <th scope="col">
            Keywords / identified
          </th>
          <th scope="col">
            Language / identified
          </th>
          <th scope="col">
            Comparison with previous sample
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="point in points"
          :key="point.sample.observedAt"
        >
          <th scope="row">
            {{ time(point.sample.observedAt) }}
          </th>
          <template v-if="point.row">
            <td>{{ point.row.inventoryRows }} / {{ point.row.identifiedRows }}</td>
            <td>{{ ratio(point.row.capturedRows, point.row.identifiedRows) }}</td>
            <td>{{ ratio(point.row.freshRows, point.row.identifiedRows) }}</td>
            <td>{{ ratio(point.row.keywordRows, point.row.identifiedRows) }}</td>
            <td>{{ ratio(point.row.languageRows, point.row.identifiedRows) }}</td>
          </template>
          <td
            v-else
            colspan="5"
          >
            {{ point.sample.status === 'capacity_exceeded' ? 'Inventory limit exceeded; counts withheld.'
              : !point.sample.libraryIds.includes(libraryId) ? 'Library outside this sample selection.' : 'Per-library detail unavailable.' }}
          </td>
          <td>
            {{ change(point.row) }}
            <span v-if="point.row?.populationChanged && point.row.comparison !== 'population_changed'"> Inventory population also changed.</span>
            <span v-if="point.sample.selectionChanged"> Selected libraries changed.</span>
            <span v-if="!point.sample.acquisitionConfigured"> Acquisition was not configured.</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { observationHistoryTime as time, observationHistoryRatio as ratio } from '@/utils/observationHistoryDisplay'
import { observationTrendChange as change } from '@/utils/observationTrendDisplay'
const props = defineProps({ samples: { type: Array, required: true }, libraryId: { type: Number, required: true }, label: { type: String, required: true } })
const points = computed(() => props.samples.map(sample => ({ sample, row: sample.libraryCoverage?.find(row => row.libraryId === props.libraryId) })))
</script>

<style scoped>
th, td { padding: 0.5rem 0.75rem; vertical-align: top; }
</style>
