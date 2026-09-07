<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="library-utc-coverage">
    <h3>UTC capture by recorded library</h3>
    <p
      v-if="!available"
      role="status"
    >
      Per-library UTC coverage is unavailable. Counts have not been estimated.
    </p>
    <template v-else>
      <p>
        {{ dateLabel(coverage.start_date) }} through {{ dateLabel(coverage.end_date) }} UTC, including today so far.
        {{ number(coverage.totals.events) }} window events across {{ number(coverage.totals.retained_events) }} retained history events.
        {{ number(coverage.totals.unknown_events) }} have an unknown recording time and are excluded from the window.
      </p>
      <p>
        Recorded library reflects the current history record and can change after resolution or removal.
        These rows do not establish current inventory membership or classification accuracy.
        Libraries without retained history are omitted. N/A means no window events; today is partial.
      </p>
      <div
        class="table-scroll"
        tabindex="0"
        role="region"
        aria-label="UTC library capture table"
      >
        <table>
          <caption>UTC provenance window and time exclusions by recorded library</caption>
          <thead>
            <tr>
              <th scope="col">
                Recorded library
              </th>
              <th
                v-for="column in columns"
                :key="column.key"
                scope="col"
              >
                {{ column.label }}
              </th>
              <th scope="col">
                Capture coverage
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
              <td
                v-for="column in columns"
                :key="column.key"
              >
                {{ number(row[column.key]) }}
              </td>
              <td>{{ percent(row.capture_coverage) }}</td>
            </tr>
            <tr v-if="coverage.groups.length === 0">
              <td colspan="11">
                No retained classification history.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="coverage.truncated"
        role="status"
      >
        Showing {{ coverage.groups.length }} of {{ number(coverage.group_count) }} recorded-library groups.
        Global totals include all groups.
      </p>
      <p>
        Captured, unrecorded, invalid and unsupported refer to original-method provenance within the UTC window.
        Capture coverage is captured divided by window events. Window, older, future and unknown-time counts add up to retained events.
        Future includes the capture cutoff. This is the same history as the UTC trend, not additional events.
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { evidenceNumber as number, evidenceLibraryLabel as libraryLabel } from '../../utils/evidenceCoverageLabels'
import { provenanceDateLabel as dateLabel, provenancePercent as percent } from '../../utils/provenanceTrendDisplay'
import { isLibraryUtcCoverage } from '../../utils/libraryUtcCoverageDisplay'
const props = defineProps({ coverage: { type: Object, default: null }, trend: { type: Object, default: null },
  historyEvents: { type: Number, required: true } })
const available = computed(() => isLibraryUtcCoverage(props.coverage, props.trend, props.historyEvents))
const columns = [
  { key: 'retained_events', label: 'Retained events' }, { key: 'events', label: 'UTC window events' },
  { key: 'captured_events', label: 'Captured' }, { key: 'unrecorded_events', label: 'Unrecorded' },
  { key: 'invalid_events', label: 'Invalid' }, { key: 'unsupported_events', label: 'Unsupported' },
  { key: 'older_events', label: 'Older' }, { key: 'future_events', label: 'Future' }, { key: 'unknown_events', label: 'Unknown time' },
]
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
tbody th { min-width: 12rem; font-weight: 500; }
</style>
