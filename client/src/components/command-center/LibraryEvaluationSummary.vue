<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    v-if="evaluation !== undefined"
    class="library-evaluation"
    aria-labelledby="library-evaluation-heading"
  >
    <div class="heading-row">
      <h2 id="library-evaluation-heading">
        Library learning
      </h2>
      <button
        v-if="current"
        type="button"
        :aria-pressed="paused"
        @click="togglePause"
      >
        {{ paused ? 'Resume summary' : 'Pause summary' }}
      </button>
    </div>
    <p
      class="sr-only"
      role="status"
    >
      {{ announcement }}
    </p>
    <p v-if="!snapshot">
      Library evaluation status is unavailable. It will refresh automatically.
    </p>
    <template v-else>
      <p v-if="snapshot.representative">
        <strong>Background profiles:</strong> {{ formatCount(snapshot.representative.compared) }} decisions compared;
        {{ formatCount(snapshot.representative.differs) }} differed from the existing destination.
        Routing is unchanged.
      </p>
      <p v-if="snapshot.passed || snapshot.blocked || snapshot.incomplete">
        <strong>Evidence:</strong> {{ formatCount(snapshot.passed) }} checks passed;
        {{ formatCount(snapshot.blocked) }} did not meet the evidence checks;
        {{ formatCount(snapshot.incomplete) }} could not finish.
      </p>
      <p v-else>
        No completed evidence checks recorded yet. Eligible classifications are checked automatically.
      </p>
      <p>
        <strong>Routing approval:</strong>
        {{ formatCount(snapshot.held) }} passing checks were held for confirmation.
        These checks do not authorize routing.
      </p>
      <p class="scope">
        {{ paused ? 'Summary paused · ' : '' }}Attempts since service start, not unique items or accuracy.
      </p>
      <details>
        <summary>How this is measured</summary>
        <p>
          Classifarr checks existing AI and library evidence during eligible classifications.
          Confirmation holds do not stop these checks. No extra AI request is made by this summary.
        </p>
        <dl>
          <div><dt>Strict checks passed, confirmation held</dt><dd>{{ formatCount(snapshot.counts.strict_qualified_admin_held) }}</dd></div>
          <div><dt>Expanded-neighbor checks passed, confirmation held</dt><dd>{{ formatCount(snapshot.counts.calibrated_qualified_admin_held) }}</dd></div>
          <div><dt>Expanded-neighbor checks passed, no confirmation hold</dt><dd>{{ formatCount(snapshot.counts.qualified) }}</dd></div>
          <div><dt>Evidence changed before the final check</dt><dd>{{ formatCount(snapshot.counts.freshness_blocked) }}</dd></div>
        </dl>
        <p>
          Expanded-neighbor results are evaluated only; they cannot enable automatic routing.
          These counters exclude some early exits and successful strict automatic routes.
          Repeated attempts can count again. Counts reset when the service restarts and are
          not the number of items currently waiting for you.
        </p>
        <p v-if="snapshot.representative">
          Profiles compare descriptions for items not already in the current inventory, using query vectors
          classification already produced. {{ formatCount(snapshot.representative.pending) }} comparisons are waiting;
          {{ formatCount(snapshot.representative.skipped) }} observations were skipped or unavailable.
          Agreement is not accuracy. Duplicate suppression lasts 30 minutes; counts reset on restart.
        </p>
        <p v-if="snapshot.representative?.capped">
          A profile-comparison counter reached its limit; these counts are lower bounds.
        </p>
        <p v-if="snapshot.capped">
          At least one counter reached its limit; displayed counts are lower bounds.
        </p>
        <slot />
      </details>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { normalizeLibraryEvaluationSummary } from '@/utils/libraryEvaluationSummary'

const props = defineProps({ evaluation: { type: Object, default: undefined } })
const current = computed(() => normalizeLibraryEvaluationSummary(props.evaluation))
const paused = ref(false)
const snapshot = ref(null)
watch(current, (value) => {
  // Failure or lost authorization must clear even a paused, previously valid snapshot.
  if (!value || !paused.value) snapshot.value = value
}, { immediate: true })
const announcement = computed(() => !snapshot.value
  ? 'Library evaluation status is unavailable.'
  : paused.value ? 'Library evaluation summary paused.' : 'Library evaluation summary updates automatically.')
function togglePause() {
  paused.value = !paused.value
  if (!paused.value) snapshot.value = current.value
}
function formatCount(count) { return count.toLocaleString() }
</script>

<style scoped>
.library-evaluation { margin-bottom: 1.5rem; padding: 1rem 1.25rem; border: 1px solid #374151; border-radius: 0.75rem; background: #1f2937; color: #e5e7eb; }
.heading-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; }
h2 { margin: 0; color: #f9fafb; font-size: 1rem; font-weight: 700; }
p, dl { margin-top: 0.5rem; font-size: 0.875rem; line-height: 1.5; }
.scope { color: #d1d5db; font-size: 0.8125rem; }
button, summary { color: #bfdbfe; cursor: pointer; font-size: 0.875rem; min-height: 2rem; }
button { padding: 0.25rem 0.5rem; border: 1px solid #64748b; border-radius: 0.375rem; }
button:focus-visible, summary:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
summary { margin-top: 0.5rem; }
dl > div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.5rem; }
dd { font-variant-numeric: tabular-nums; }
</style>
