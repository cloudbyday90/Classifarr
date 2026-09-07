<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="candidate-library-comparison">
    <h3>Original candidate and recorded library</h3>
    <p
      v-if="!available"
      role="status"
    >
      Candidate library comparison is unavailable. Counts have not been estimated.
    </p>
    <template v-else>
      <p>
        {{ dateLabel(coverage.start_date) }} through {{ dateLabel(coverage.end_date) }} UTC, including today so far.
        Only original classifier workflows within this window are compared.
        Imports, direct manual actions and unknown origins are excluded, as are unknown recording times,
        older events and future events.
      </p>
      <p>
        The candidate is the proposal captured before routing. The recorded library is the history row's
        library now; later resolution or removal can change it. Same or different means ID agreement,
        not classification accuracy, successful delivery or an independent review.
      </p>
      <div
        class="table-scroll"
        tabindex="0"
        role="region"
        aria-label="Candidate library comparison table"
      >
        <table>
          <caption>Original candidate comparison within the library UTC window</caption>
          <thead>
            <tr>
              <th scope="col">
                Recorded library
              </th>
              <th scope="col">
                Classifier workflow events
              </th>
              <th
                v-for="column in columns"
                :key="column.key"
                scope="col"
              >
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in coverage.groups"
              :key="row.library_id ?? 'unassigned'"
            >
              <th scope="row">
                {{ libraryLabel(row) }}
              </th>
              <td>{{ number(row.observation_types.classifier_workflow_events) }}</td>
              <td
                v-for="column in columns"
                :key="column.key"
              >
                {{ number(row.candidate_comparison[column.key]) }}
              </td>
            </tr>
            <tr v-if="coverage.groups.length === 0">
              <td colspan="7">
                No retained classification history.
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">
                All recorded libraries
              </th>
              <td>{{ number(coverage.totals.observation_types.classifier_workflow_events) }}</td>
              <td
                v-for="column in columns"
                :key="column.key"
              >
                {{ number(coverage.totals.candidate_comparison[column.key]) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p
        v-if="coverage.truncated"
        role="status"
      >
        Showing {{ coverage.groups.length }} of {{ number(coverage.group_count) }} recorded-library groups.
        All-library totals include the omitted groups.
      </p>
      <p v-if="coverage.totals.observation_types.classifier_workflow_events === 0">
        No captured classifier workflows in this UTC window. This does not establish agreement or accuracy.
      </p>
      <p>
        The five outcomes add up to classifier workflow events, including retries and superseded attempts.
        No candidate and invalid candidate are explicit captured outcomes. Recorded library unknown means a valid
        candidate exists but its recorded library is unassigned or removed. Missing original provenance is excluded,
        not inferred from a later placement. No agreement rate is estimated.
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { evidenceNumber as number, evidenceLibraryLabel as libraryLabel } from '../../utils/evidenceCoverageLabels'
import { provenanceDateLabel as dateLabel } from '../../utils/provenanceTrendDisplay'
import { candidateComparisonColumns as columns, isCandidateLibraryComparison } from '../../utils/candidateLibraryComparisonDisplay'
const props = defineProps({ coverage: { type: Object, default: null }, trend: { type: Object, default: null },
  historyEvents: { type: Number, required: true } })
const available = computed(() => isCandidateLibraryComparison(props.coverage, props.trend, props.historyEvents))
</script>

<style scoped>
h3 { margin-top: 1.5rem; font-size: 1.1rem; font-weight: 600; }
p { margin: 0.75rem 0; color: #d1d5db; }
.table-scroll { overflow-x: auto; margin-top: 1.25rem; }
.table-scroll:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
table { width: 100%; border-collapse: collapse; }
caption { text-align: left; font-weight: 600; margin-bottom: 0.5rem; }
th, td { padding: 0.65rem; text-align: left; border-bottom: 1px solid #4b5563; }
thead th { vertical-align: bottom; }
tbody th, tfoot th { min-width: 12rem; font-weight: 500; }
tfoot { border-top: 2px solid #9ca3af; }
</style>
