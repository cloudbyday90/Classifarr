<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    v-if="available"
    class="evaluation-history"
    aria-labelledby="evaluation-history-heading"
  >
    <div class="heading-row">
      <h2 id="evaluation-history-heading">
        Evaluation progress
      </h2>
      <button
        v-if="snapshot"
        type="button"
        :aria-pressed="paused"
        @click="togglePause"
      >
        {{ paused ? 'Resume summary' : 'Pause summary' }}
      </button>
    </div>
    <p role="status">
      {{ errorMessage || (isLoading ? 'Loading evaluation history…' : paused ? 'Summary paused.' : '') }}
    </p>
    <template v-if="snapshot">
      <p v-if="!latest">
        No saved evaluation windows yet. Background replay records future results automatically.
      </p>
      <template v-else>
        <p>
          <strong>{{ latest.paired }} of {{ latest.eligible }} eligible items compared</strong>
          in the latest saved revision · {{ latest.moviePaired }} movies · {{ latest.tvPaired }} TV shows.
        </p>
        <p>
          {{ latest.labeled }} compared items have reference labels; {{ latest.paired - latest.labeled }} remain unlabelled.
          This is coverage, not accuracy. Routing is unchanged.
        </p>
        <details>
          <summary>Saved results and scope</summary>
          <EvaluationCoverageGaps :group="latest" />
          <p>
            {{ latest.selected }} distinct items selected from a {{ latest.sampled }}-item frozen cohort.
            Counts retain the latest completed pair per item, even if its cached responses later expire.
            These are historical results, not live model verification.
          </p>
          <p>
            {{ latest.gains }} labeled gains · {{ latest.regressions }} labeled regressions ·
            {{ latest.deferralsReduced }} fewer deferrals · {{ latest.deferralsIncreased }} more deferrals.
            Fewer deferrals alone do not establish better decisions.
          </p>
          <p>
            Up to 500 distinct result windows from 30 days. Repeated items count once within a revision;
            changed models, evidence or cohorts start a separate comparison. Retention can reduce these counts.
          </p>
          <ol aria-label="Recent evaluation revisions">
            <li
              v-for="(group, index) in snapshot.groups"
              :key="index"
            >
              {{ index === 0 ? 'Latest saved revision' : `Earlier revision ${index}` }}:
              {{ group.paired }} / {{ group.eligible }} compared, {{ group.labeled }} labeled,
              {{ group.gains }} gains / {{ group.regressions }} regressions.
              <time :datetime="new Date(group.latestAt).toISOString()">{{ new Date(group.latestAt).toLocaleString() }}</time>
            </li>
          </ol>
          <p>
            {{ snapshot.windows }} windows across {{ snapshot.revisions }} revisions retained; at most six revisions shown.
            Revisions are not directly comparable. No AI calls are made by this summary.
          </p>
        </details>
      </template>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useEvaluationHistory } from '@/composables/useEvaluationHistory'
import EvaluationCoverageGaps from './EvaluationCoverageGaps.vue'
const { available, paused, snapshot, isLoading, togglePause, errorMessage } = useEvaluationHistory()
const latest = computed(() => snapshot.value?.groups[0])
</script>

<style scoped>
.evaluation-history { margin-bottom: 1rem; padding: 1rem 1.25rem; border: 1px solid #374151; border-radius: .75rem; background: #1f2937; color: #e5e7eb; }
.heading-row { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: .5rem; }
h2 { font-size: 1rem; font-weight: 700; }
p, li { margin-top: .5rem; font-size: .875rem; line-height: 1.5; }
button, summary { color: #bfdbfe; cursor: pointer; min-height: 2rem; }
button { padding: .25rem .5rem; border: 1px solid #64748b; border-radius: .375rem; }
button:focus-visible, summary:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
time { display: block; color: #d1d5db; }
ol { list-style: decimal; padding-left: 1.5rem; }
</style>
