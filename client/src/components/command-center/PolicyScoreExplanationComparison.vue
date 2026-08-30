<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    v-if="hasComparison"
    ref="comparisonSection"
    class="score-explanation-comparison"
    tabindex="-1"
    aria-labelledby="score-explanation-comparison-heading"
  >
    <h3 id="score-explanation-comparison-heading">
      Selected score explanation comparison
    </h3>
    <p>
      This compares {{ comparison.selected_explanation_count }} already-visible deterministic policy scores. It does not send data, call AI, change policy, or route media.
    </p>
    <p>
      Score range: {{ comparison.score_range.minimum }}/100 to {{ comparison.score_range.maximum }}/100.
    </p>

    <div class="comparison-entry-grid">
      <section
        v-for="(entry, index) in entries"
        :key="`score-explanation-${index + 1}`"
        class="comparison-entry"
        :aria-labelledby="`score-explanation-entry-${index + 1}`"
      >
        <h4 :id="`score-explanation-entry-${index + 1}`">
          Selected explanation {{ index + 1 }}
        </h4>
        <dl>
          <dt>
            Policy score
          </dt>
          <dd>
            {{ entry.score }}/100
          </dd>
          <dt>
            Weighted base score
          </dt>
          <dd>
            {{ formatValue(entry.base_score) }}/100
          </dd>
          <dt>
            Agreement adjustment
          </dt>
          <dd>
            {{ formatValue(entry.agreement_multiplier_percent) }}%
          </dd>
          <dt v-if="entry.review_threshold !== null">
            Confirmation threshold
          </dt>
          <dd v-if="entry.review_threshold !== null">
            {{ entry.review_threshold }}/100
          </dd>
          <dt v-if="entry.automatic_threshold !== null">
            Automatic threshold
          </dt>
          <dd v-if="entry.automatic_threshold !== null">
            {{ entry.automatic_threshold }}/100
          </dd>
        </dl>
        <p>{{ calibrationLabel(entry.calibration.status_id) }}</p>
      </section>
    </div>

    <div class="comparison-table-wrap">
      <table>
        <caption>
          Evidence contribution by selected explanation
        </caption>
        <thead>
          <tr>
            <th scope="col">
              Evidence category
            </th>
            <th
              v-for="(_, index) in entries"
              :key="`score-explanation-heading-${index + 1}`"
              scope="col"
            >
              Explanation {{ index + 1 }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="source in comparison.source_coverage"
            :key="source.source_id"
          >
            <th scope="row">
              {{ sourceLabel(source.source_id) }}
            </th>
            <td
              v-for="(entry, index) in entries"
              :key="`${source.source_id}-${index + 1}`"
            >
              <template v-if="componentFor(entry, source.source_id)">
                {{ componentFor(entry, source.source_id).evidence_score }}/100 evidence;
                {{ formatValue(componentFor(entry, source.source_id).weighted_contribution) }} points
              </template>
              <template v-else>
                Not active
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'

import {
  POLICY_SCORE_EXPLANATION_CALIBRATION_LABELS,
  POLICY_SCORE_EXPLANATION_COMPARISON_MAXIMUM_ENTRIES,
  POLICY_SCORE_EXPLANATION_SOURCE_LABELS,
} from '@/utils/policyScoreExplanationComparison'

const props = defineProps({
  comparison: {
    type: Object,
    required: true,
  },
})

const comparisonSection = ref(null)
const entries = computed(() => (Array.isArray(props.comparison?.entries) ? props.comparison.entries : [])
  .slice(0, POLICY_SCORE_EXPLANATION_COMPARISON_MAXIMUM_ENTRIES))
const hasComparison = computed(() => entries.value.length >= 2 &&
  entries.value.length === props.comparison?.selected_explanation_count)

function componentFor(entry, sourceId) {
  return entry.components.find(component => component.source_id === sourceId) || null
}

function formatValue(value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(1)
}

function sourceLabel(sourceId) {
  return POLICY_SCORE_EXPLANATION_SOURCE_LABELS[sourceId] || 'Unavailable evidence category'
}

function calibrationLabel(statusId) {
  return POLICY_SCORE_EXPLANATION_CALIBRATION_LABELS[statusId] || 'Evidence-safety calibration status is unavailable.'
}

function focus() {
  comparisonSection.value?.focus()
}

defineExpose({ focus })
</script>

<style scoped>
.score-explanation-comparison {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid #4f46e5;
  border-radius: 0.5rem;
  background: rgba(30, 41, 59, 0.7);
  color: #e5e7eb;
}

.score-explanation-comparison:focus {
  outline: 2px solid #818cf8;
  outline-offset: 3px;
}

.score-explanation-comparison > p {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: #cbd5e1;
}

.comparison-entry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
}

.comparison-entry {
  padding: 0.75rem;
  border: 1px solid #374151;
  border-radius: 0.375rem;
  background: #111827;
}

.comparison-entry h4 {
  margin-bottom: 0.5rem;
  font-size: 0.8125rem;
  color: #f3f4f6;
}

.comparison-entry dl {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.375rem 0.75rem;
  margin: 0;
  font-size: 0.75rem;
}

.comparison-entry dt {
  color: #9ca3af;
}

.comparison-entry dd {
  margin: 0;
  color: #e5e7eb;
  text-align: right;
}

.comparison-entry p {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: #cbd5e1;
}

.comparison-table-wrap {
  overflow-x: auto;
  margin-top: 1rem;
}

table {
  width: 100%;
  min-width: 520px;
  border-collapse: collapse;
  font-size: 0.75rem;
}

caption {
  margin-bottom: 0.5rem;
  color: #f3f4f6;
  font-weight: 600;
  text-align: left;
}

th,
td {
  padding: 0.625rem;
  border: 1px solid #374151;
  text-align: left;
  vertical-align: top;
}

thead th {
  background: #1f2937;
  color: #f3f4f6;
}

tbody th {
  color: #cbd5e1;
  font-weight: 600;
}

td {
  color: #d1d5db;
}
</style>
