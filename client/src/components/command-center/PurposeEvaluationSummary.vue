<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    class="purpose-summary"
    aria-label="Destination review summary"
  >
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ errorMessage || (loading && !summary ? 'Loading saved destination reviews…' : purposeEvaluationMessage(summary)) }}
    </p>
    <details>
      <summary>Destination review details</summary>
      <template v-if="summary?.status === 'complete' && summary.report">
        <p>These comparisons describe explicit choices, not accuracy. Each row uses the same choices, so differences overlap. Confirmations can be influenced by the suggestion. Routing and learning are unchanged.</p>
        <p>Confirmations: {{ summary.report.cohorts.confirmation.eligible }} · Changes: {{ summary.report.cohorts.correction.eligible }}. Each keeps its recorded action meaning.</p>
        <dl v-if="summary.report.eligible">
          <template
            v-for="(label, key) in purposeComparisonLabels"
            :key="key"
          >
            <dt>{{ label }}</dt>
            <dd>Agree: {{ summary.report.comparisons[key].agrees }} · Differ: {{ summary.report.comparisons[key].differs }} · Unknown: {{ summary.report.comparisons[key].unavailable }}</dd>
          </template>
        </dl>
        <p
          v-for="(label, key) in purposeSourceLabels"
          :key="key"
        >
          {{ label }}: {{ purposeChoiceCount(summary.report.sources[key].eligible) }}.
        </p>
        <p>{{ summary.report.coverage.duplicateItems }} later item reviews held out. Missing original destinations remain unknown.</p>
        <dl v-if="gaps.length">
          <template
            v-for="[key, count] in gaps"
            :key="key"
          >
            <dt>{{ purposeGapLabels[key] }}</dt><dd>{{ count }}</dd>
          </template>
        </dl>
        <p>Only recorded choices from thirty days are inspected. An empty window only means no retained destination choices were available; it does not tell us whether classification is working. Current media placement is not a review.</p>
      </template>
      <p v-else>
        {{ purposeFailureLabels[summary?.reason] || 'The summary is missing, unavailable or out of date.' }} Verified counts are withheld. Checks retry automatically.
      </p>
      <p v-if="paused">
        Presentation is paused; expired counts are still withheld.
      </p>
      <p v-if="summary?.observedAt">
        Last checked: <time :datetime="summary.observedAt">{{ new Date(summary.observedAt).toLocaleString() }}</time>.
      </p>
    </details>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { purposeEvaluationMessage, purposeChoiceCount, purposeComparisonLabels, purposeSourceLabels, purposeGapLabels, purposeFailureLabels } from '@/utils/purposeEvaluationPresentation'
const props = defineProps({ summary: { type: Object, default: null }, loading: Boolean, paused: Boolean, errorMessage: { type: String, default: '' } })
const gaps = computed(() => props.summary?.status === 'complete' ? Object.entries(props.summary.report?.coverage.gaps || {}).filter(([, count]) => count > 0) : [])
</script>

<style scoped>
.purpose-summary { margin-top: .75rem; }
p, dt, dd { margin-top: .4rem; font-size: .875rem; line-height: 1.5; }
dl { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .25rem .75rem; }
summary { color: #bfdbfe; cursor: pointer; min-height: 2rem; }
summary:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
@media (max-width: 480px) {
  dl { grid-template-columns: 1fr; }
  dd { margin-top: 0; margin-bottom: .5rem; }
}
</style>
