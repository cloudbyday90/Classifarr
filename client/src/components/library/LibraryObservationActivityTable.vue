<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <details class="rounded border border-gray-600 p-3">
    <summary class="cursor-pointer font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      Recorded acquisition outcomes
    </summary>
    <p class="my-3 text-sm text-gray-300">
      Captured means an attributable observation was saved. Unavailable means the attempt produced no usable
      capture. Skips, cached reuse and source changes rejected before persistence are excluded.
      The current hour may be incomplete; these counts are not provider billing totals.
    </p>
    <div
      v-if="activity.length"
      role="region"
      aria-label="Acquisition outcomes table"
      tabindex="0"
      class="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <table class="w-full min-w-[36rem] text-left text-sm">
        <caption class="pb-2 text-left font-medium">
          Acquisition outcomes by UTC hour, newest first
        </caption>
        <thead>
          <tr>
            <th scope="col">
              Hour beginning
            </th>
            <th scope="col">
              Recorded attempts
            </th>
            <th scope="col">
              Captured
            </th>
            <th scope="col">
              Unavailable
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="bucket in activity"
            :key="bucket.bucketAt"
          >
            <th scope="row">
              {{ time(bucket.bucketAt) }}
            </th>
            <td>{{ bucket.attempted }}</td>
            <td>{{ bucket.captured }}</td>
            <td>{{ bucket.unavailable }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else>
      No acquisition outcomes have been recorded in the retained window.
    </p>
  </details>
</template>

<script setup>
import { observationHistoryTime as time } from '@/utils/observationHistoryDisplay'
defineProps({ activity: { type: Array, required: true } })
</script>

<style scoped>
th, td { padding: 0.5rem 0.75rem; vertical-align: top; }
</style>
