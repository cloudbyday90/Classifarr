<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="space-y-3">
    <p v-if="latest?.status === 'available'">
      Most recent coverage: keywords {{ ratio(latest.keywordRows, latest.identifiedRows) }};
      language {{ ratio(latest.languageRows, latest.identifiedRows) }}.
      Sampled {{ time(latest.observedAt) }}.
    </p>
    <p v-else-if="latest">
      The latest coverage sample exceeds the inventory limit. Coverage counts are withheld.
    </p>
    <p v-else>
      No coverage samples have been recorded yet. Sampling starts automatically after startup.
    </p>
    <p class="text-sm text-gray-300">
      These hourly samples cover up to 12 active libraries and 20,000 combined rows.
      Library selection and inventory can change between samples. Gaps are unrecorded periods.
    </p>
    <LibraryObservationTrends
      :samples="samples"
      :libraries="libraries"
    />
    <LibraryObservationCoverageTable :samples="samples" />
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { observationHistoryTime as time, observationHistoryRatio as ratio } from '@/utils/observationHistoryDisplay'
import LibraryObservationTrends from './LibraryObservationTrends.vue'
import LibraryObservationCoverageTable from './LibraryObservationCoverageTable.vue'
const props = defineProps({ samples: { type: Array, required: true }, libraries: { type: Array, required: true } })
const latest = computed(() => props.samples[0])
</script>
