<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="space-y-3">
    <h3 class="text-lg font-semibold">
      Coverage across libraries
    </h3>
    <p class="text-sm text-gray-300">
      One active library is sampled every five minutes, measuring at most 20,000 rows per visit.
      Larger libraries continue on later turns while other libraries keep their turns.
      Complete scans are compared only when their populations are comparable; missed sampling slots remain gaps.
    </p>
    <p v-if="sampling.lastSampleAt">
      Last sampling pass: {{ time(sampling.lastSampleAt) }}. Active libraries at that pass: {{ sampling.activeLibraryCount }}.
    </p>
    <p v-else>
      Automatic sampling has not recorded a visit yet.
    </p>
    <p v-if="sampling.status === 'sampling_delayed'">
      Sampling is delayed; the last recorded measurements may be stale.
    </p>
    <p v-if="sampling.status === 'clock_anomaly'">
      The sampling clock is ahead of the current time; new visits are paused until it catches up.
    </p>
    <LibraryObservationDiagnosticSummary
      v-if="diagnostics"
      :diagnostics="diagnostics"
      :libraries="libraries"
    />
    <p class="text-sm text-gray-300">
      {{ grouped.length }} libraries appear in the retained seven-day history. Current names are labels;
      inactive or deleted libraries may still have retained measurements. Unchanged coverage does not establish a failure.
    </p>
    <p v-if="!grouped.length">
      No per-library visits are available in the retained window.
    </p>
    <nav
      v-if="pages > 1"
      aria-label="Coverage library pages"
      class="flex flex-wrap items-center gap-3"
    >
      <button
        type="button"
        :disabled="page === 0"
        :class="buttonClass"
        @click="page--"
      >
        Previous libraries
      </button>
      <span role="status">Page {{ page + 1 }} of {{ pages }}</span>
      <button
        type="button"
        :disabled="page + 1 >= pages"
        :class="buttonClass"
        @click="page++"
      >
        Next libraries
      </button>
    </nav>
    <div
      v-for="library in visible"
      :key="library.id"
      class="space-y-2 rounded border border-gray-600 p-3"
    >
      <h4 class="font-medium">
        {{ library.label }}
      </h4>
      <p>Sampled {{ time(library.latest.observedAt) }}.</p>
      <p v-if="library.latest.scanStartedAt">
        {{ library.latest.status === 'available' ? 'Complete coverage measured as of' : 'Scan started' }}
        {{ time(library.latest.scanStartedAt) }}.
        <span v-if="library.latest.status === 'available'">Freshness uses that time.</span>
      </p>
      <p v-if="library.latest.status === 'available'">
        Keywords {{ ratio(library.latest.keywordRows, library.latest.identifiedRows) }};
        language {{ ratio(library.latest.languageRows, library.latest.identifiedRows) }};
        captured {{ ratio(library.latest.capturedRows, library.latest.identifiedRows) }}.
      </p>
      <p v-else-if="library.latest.status === 'in_progress'">
        {{ library.latest.scannedRows }} rows scanned; more remain. Complete coverage is not available yet.
      </p>
      <p v-else-if="library.latest.status === 'invalidated'">
        Inputs changed before this visit could be saved. The scan will restart automatically.
      </p>
      <p v-else>
        Inventory exceeds 20,000 rows; this library's coverage is unknown.
      </p>
      <p v-if="library.latest.restartReason">
        {{ restart(library.latest.restartReason) }}
      </p>
      <p>{{ change(library.latest) }}</p>
      <p v-if="library.latest.elapsedMinutes !== null">
        {{ library.latest.elapsedMinutes }} minutes since the previous {{ library.latest.measurementVersion === 3 ? 'complete scan' : 'recorded visit' }}.
      </p>
      <p v-if="library.latest.populationChanged && library.latest.comparison !== 'population_changed'">
        Inventory population also changed.
      </p>
      <p v-if="library.latest.unchangedComparisons">
        {{ unchanged(library.latest) }}
      </p>
      <p v-if="!library.latest.acquisitionConfigured">
        Acquisition was not configured for this visit.
      </p>
      <LibraryObservationDiagnosticDetail
        v-if="library.diagnostic"
        :diagnostic="library.diagnostic"
        :label="library.label"
      />
      <details @toggle="toggle($event, library.id)">
        <summary class="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          Recorded visits for {{ library.label }}
        </summary>
        <LibraryObservationTrendTable
          v-if="expanded.has(library.id)"
          :observations="library.points"
          :library-id="library.id"
          :label="library.label"
          class="mt-3"
        />
      </details>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { observationHistoryTime as time, observationHistoryRatio as ratio } from '@/utils/observationHistoryDisplay'
import { observationTrendChange as change, observationTrendUnchanged as unchanged } from '@/utils/observationTrendDisplay'
import { observationScanRestart as restart } from '@/utils/observationScanDisplay'
import LibraryObservationTrendTable from './LibraryObservationTrendTable.vue'
import LibraryObservationDiagnosticSummary from './LibraryObservationDiagnosticSummary.vue'
import LibraryObservationDiagnosticDetail from './LibraryObservationDiagnosticDetail.vue'
const props = defineProps({ sampling: { type: Object, required: true }, points: { type: Array, required: true },
  libraries: { type: Array, default: () => [] }, diagnostics: { type: Object, default: null } })
const page = ref(0)
const expanded = ref(new Set())
const buttonClass = 'rounded border border-gray-500 px-3 py-2 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
const grouped = computed(() => {
  const names = new Map(props.libraries.map(library => [library.id, library.name]))
  const diagnostics = new Map((props.diagnostics?.libraries ?? []).map(item => [item.libraryId, item]))
  const groups = new Map()
  for (const point of props.points) {
    if (!groups.has(point.libraryId)) {
      const name = names.get(point.libraryId)
      groups.set(point.libraryId, { id: point.libraryId, label: name ? `${name} (library ${point.libraryId})` : `Library ${point.libraryId}`,
        latest: point, points: [], diagnostic: diagnostics.get(point.libraryId) })
    }
    groups.get(point.libraryId).points.push(point)
  }
  return [...groups.values()].sort((a, b) => priority(a.diagnostic) - priority(b.diagnostic) || a.id - b.id)
})
function priority(diagnostic) {
  if (!diagnostic?.isActive) return 3
  if (diagnostic.repeatedResets) return 0
  if (diagnostic.expirationsSinceCompletion) return 1
  return diagnostic.completionEvidence !== 'retained_completion' ? 2 : 3
}
const pages = computed(() => Math.max(1, Math.ceil(grouped.value.length / 12)))
const visible = computed(() => grouped.value.slice(page.value * 12, (page.value + 1) * 12))
watch(pages, value => { page.value = Math.min(page.value, value - 1) })
function toggle(event, id) {
  if (event.target.open) expanded.value.add(id)
  else expanded.value.delete(id)
}
</script>
