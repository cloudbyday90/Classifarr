<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="space-y-2 border-t border-gray-600 pt-2 text-sm">
    <p v-if="!diagnostic.isActive">
      This library is currently inactive or no longer in the catalog.
    </p>
    <p v-if="diagnostic.completionEvidence === 'legacy_only'">
      Only legacy visits are retained; incremental completion is unknown.
    </p>
    <template v-else>
      <p v-if="diagnostic.repeatedResets">
        Repeated resets recorded: {{ diagnostic.restartsSinceCompletion }} restarts and
        {{ diagnostic.discardedSinceCompletion }} discarded visits {{ sinceCompletion }}.
      </p>
      <p v-if="diagnostic.expirationsSinceCompletion">
        {{ diagnostic.expirationsSinceCompletion }} scan age-limit restarts {{ sinceCompletion }}.
      </p>
      <p v-if="diagnostic.completionEvidence === 'no_retained_completion'">
        No complete incremental measurement is retained for this library in this window.
      </p>
      <p>
        Retained incremental visits: {{ diagnostic.visitCount }};
        completed measurements: {{ diagnostic.completedScans }};
        partial visits: {{ diagnostic.partialVisits }}; discarded visits: {{ diagnostic.discardedVisits }}.
      </p>
      <p>
        Visits observed from {{ time(diagnostic.firstVisitAt) }} to {{ time(diagnostic.lastVisitAt) }}
        ({{ diagnostic.observedSpanMinutes }} minutes apart).
      </p>
      <p v-if="diagnostic.lastCompletedAt">
        Last completed {{ time(diagnostic.lastCompletedAt) }} ({{ diagnostic.lastCompletionAgeMinutes }} minutes before this report).
        <span v-if="diagnostic.lastMeasurementAt">
          Measurement baseline: {{ time(diagnostic.lastMeasurementAt) }};
          completed scan elapsed time: {{ diagnostic.lastCompletedDurationMinutes }} minutes.
        </span>
      </p>
      <p v-if="diagnostic.unresolvedSince">
        First retained unresolved visit: {{ time(diagnostic.unresolvedSince) }}
        ({{ diagnostic.unresolvedElapsedMinutes }} minutes before this report).
        This is elapsed observation time, not continuous processing time.
      </p>
      <details v-if="reasons.length">
        <summary class="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          Recorded restart reasons for {{ label }}
        </summary>
        <ul class="ml-5 list-disc space-y-1">
          <li
            v-for="[reason, count] in reasons"
            :key="reason"
          >
            {{ count }}: {{ restart(reason) }}
          </li>
        </ul>
        <p>Reason counts cover this retained window. Discarded visits do not prove a subsequent restart.</p>
      </details>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { observationHistoryTime as time } from '@/utils/observationHistoryDisplay'
import { observationScanRestart as restart } from '@/utils/observationScanDisplay'
const props = defineProps({ diagnostic: { type: Object, required: true }, label: { type: String, required: true } })
const reasons = computed(() => Object.entries(props.diagnostic.restartReasons).filter(([, count]) => count > 0))
const sinceCompletion = computed(() => props.diagnostic.lastCompletedAt ? 'since the last retained completion' : 'in the retained window')
</script>
