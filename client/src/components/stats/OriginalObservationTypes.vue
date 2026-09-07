<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="original-observation-types">
    <h3>Original observation types</h3>
    <p
      v-if="!available"
      role="status"
    >
      Original observation types are unavailable. Counts have not been estimated.
    </p>
    <template v-else>
      <p>
        {{ dateLabel(coverage.start_date) }} through {{ dateLabel(coverage.end_date) }} UTC, including today so far.
        These are the same window events and recorded libraries shown above.
        Unknown recording times, older events and future events are excluded.
      </p>
      <p>
        Origin comes from the validated original method and is not inferred from later changes.
        Imported membership describes an existing placement; manual action is not an independent review label.
        Classifier workflow includes retries, fallbacks and attempts without a candidate, not only successful decisions.
        Unknown origin includes missing, invalid, unsupported or unrecognized original provenance.
      </p>
      <div
        class="table-scroll"
        tabindex="0"
        role="region"
        aria-label="Original observation types table"
      >
        <table>
          <caption>Original observation types within the library UTC window</caption>
          <thead>
            <tr>
              <th scope="col">
                Recorded library
              </th>
              <th scope="col">
                UTC window events
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
              <td>{{ number(row.events) }}</td>
              <td
                v-for="column in columns"
                :key="column.key"
              >
                {{ number(row.observation_types[column.key]) }}
              </td>
            </tr>
            <tr v-if="coverage.groups.length === 0">
              <td colspan="6">
                No retained classification history.
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">
                All recorded libraries
              </th>
              <td>{{ number(coverage.totals.events) }}</td>
              <td
                v-for="column in columns"
                :key="column.key"
              >
                {{ number(coverage.totals.observation_types[column.key]) }}
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
      <p>
        The four types add up to window events. These counts describe evidence composition, not classification accuracy.
        Capture rates by known type cannot account for unknown origins, so no such rates are estimated.
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { evidenceNumber as number, evidenceLibraryLabel as libraryLabel } from '../../utils/evidenceCoverageLabels'
import { provenanceDateLabel as dateLabel } from '../../utils/provenanceTrendDisplay'
import { isLibraryUtcCoverage } from '../../utils/libraryUtcCoverageDisplay'
import { observationTypeColumns as columns } from '../../utils/originalObservationTypeDisplay'
const props = defineProps({ coverage: { type: Object, default: null }, trend: { type: Object, default: null },
  historyEvents: { type: Number, required: true } })
const available = computed(() => isLibraryUtcCoverage(props.coverage, props.trend, props.historyEvents))
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
