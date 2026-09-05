<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <details class="border-t border-gray-600 pt-3">
    <summary class="cursor-pointer rounded py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      Observation details: {{ library.name }} (#{{ library.id }})
    </summary>
    <p class="my-2 text-sm text-gray-300">
      Each of the {{ library.inventoryRowCount }} inventory rows appears in one state below.
      Repeated placements have their own clocks and count separately here.
    </p>
    <table class="w-full text-left text-sm">
      <caption class="pb-2 text-left font-semibold">
        Acquisition states for {{ library.name }} (#{{ library.id }})
      </caption>
      <thead>
        <tr>
          <th scope="col">
            State
          </th>
          <th scope="col">
            Rows
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="[state, label] in states"
          :key="state"
        >
          <th
            scope="row"
            class="py-1 pr-4 font-normal"
          >
            {{ label }}
          </th>
          <td>{{ library.states[state] }}</td>
        </tr>
      </tbody>
    </table>
    <p class="mt-3 text-sm text-gray-300">
      Fresh captures are less than {{ freshness.cacheDays }} days old. Backoff lasts
      {{ freshness.retryHours }} hours after an attempt when no fresh capture is available.
      Due means the observation is not fresh; it does not guarantee a scheduled task.
    </p>
    <ul class="mt-3 space-y-1 text-sm">
      <li>Attributable captures: {{ library.counts.captured }} / {{ library.identifiedRowCount }} identified rows.</li>
      <li>Rows captured with no keywords: {{ library.counts.emptyKeywords }}.</li>
      <li>Rows captured with unknown original language: {{ library.counts.unknownLanguage }}.</li>
      <li>Captures without a successful timestamp: {{ library.counts.undatedObservation }}.</li>
      <li>Invalid or mismatched observation records: {{ library.counts.invalidObservation }}.</li>
      <li>Rows with invalid or future clocks: {{ library.counts.clockAnomaly }}.</li>
      <li>Rows attempted without a subsequent valid capture: {{ library.counts.attemptWithoutRefresh }}.</li>
      <li>Oldest retained successful observation: {{ library.oldestSuccessfulObservationAt || 'Not recorded' }}.</li>
    </ul>
    <p class="mt-3 text-sm text-gray-300">
      These detail counts can overlap. They describe retained observations for the
      current source, not a permanent success or failure history.
    </p>
    <p class="mt-3 text-sm">
      Rows with related enrichment tasks — processing: {{ library.queue.processing }};
      pending: {{ library.queue.pending }}; no active task recorded: {{ library.queue.idle }}.
    </p>
    <p class="mt-1 text-sm text-gray-300">
      Queue activity can include other providers and tasks awaiting source checks.
      A task does not prove that TMDb will be called or that observation will succeed.
    </p>
  </details>
</template>

<script setup>
defineProps({ library: { type: Object, required: true }, freshness: { type: Object, required: true } })
const states = [
  ['fresh', 'Fresh'], ['never_observed', 'Never observed for this source'], ['due', 'Due for observation'],
  ['backoff', 'Waiting between attempts'], ['missing_identity', 'Missing movie or TV identity'],
  ['unsupported_type', 'Unsupported media type'], ['observation_withheld', 'Oversized observation withheld'],
  ['clock_anomaly', 'Invalid or future observation clock'],
]
</script>
