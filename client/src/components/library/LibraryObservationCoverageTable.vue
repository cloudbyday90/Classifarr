<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <details class="rounded border border-gray-600 p-3">
    <summary class="cursor-pointer font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      Hourly coverage history
    </summary>
    <p class="my-3 text-sm text-gray-300">
      Each sample uses current inventory rows. Percentages use the displayed denominators;
      library IDs identify the selected population. Capacity limits withhold the whole sample.
    </p>
    <div
      v-if="samples.length"
      role="region"
      aria-label="Coverage history table"
      tabindex="0"
      class="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <table class="w-full min-w-[64rem] text-left text-sm">
        <caption class="pb-2 text-left font-medium">
          Hourly coverage samples, newest first
        </caption>
        <thead>
          <tr>
            <th scope="col">
              Sample time
            </th>
            <th scope="col">
              Population
            </th>
            <th scope="col">
              Identified / movie-TV rows
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
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="sample in samples"
            :key="sample.observedAt"
          >
            <th scope="row">
              {{ time(sample.observedAt) }}
            </th>
            <td>
              Libraries: {{ sample.libraryIds.join(', ') || 'none' }}. Excluded: {{ sample.excludedLibraryCount }}.
              <span v-if="sample.status === 'available'">Inventory rows: {{ sample.inventoryRows }}.</span>
              <span v-if="!sample.acquisitionConfigured">Acquisition was not configured.</span>
            </td>
            <td
              v-if="sample.status !== 'available'"
              colspan="5"
            >
              Inventory limit exceeded; counts withheld.
            </td>
            <template v-else>
              <td>{{ ratio(sample.identifiedRows, sample.supportedRows) }}</td>
              <td>{{ ratio(sample.capturedRows, sample.identifiedRows) }}</td>
              <td>{{ ratio(sample.freshRows, sample.identifiedRows) }}</td>
              <td>{{ ratio(sample.keywordRows, sample.identifiedRows) }}</td>
              <td>{{ ratio(sample.languageRows, sample.identifiedRows) }}</td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else>
      No hourly coverage samples have been recorded in the retained window.
    </p>
  </details>
</template>

<script setup>
import { observationHistoryTime as time, observationHistoryRatio as ratio } from '@/utils/observationHistoryDisplay'
defineProps({ samples: { type: Array, required: true } })
</script>

<style scoped>
th, td { padding: 0.5rem 0.75rem; vertical-align: top; }
</style>
