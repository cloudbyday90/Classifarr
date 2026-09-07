<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="method-attribution">
    <p
      v-if="!available"
      role="status"
    >
      Original method attribution is unavailable. Counts have not been estimated.
    </p>
    <template v-else>
      <p>
        Original method captured for {{ number(attribution.totals.captured_events) }} of {{ number(attribution.totals.events) }} history events;
        {{ number(attribution.totals.unrecorded_events) }} unrecorded,
        {{ number(attribution.totals.invalid_events) }} invalid,
        {{ number(attribution.totals.unsupported_events) }} unsupported.
      </p>
      <p>
        Original method was saved before routing. Recorded method reflects the current history record,
        including later manual resolution or a pending decision. This is another view of the same history events.
        Missing original methods are not inferred from recorded methods. Capture does not establish accuracy.
      </p>
      <div
        class="table-scroll"
        tabindex="0"
        role="region"
        aria-label="Original method attribution table"
      >
        <table>
          <caption>Retained history by original and recorded method</caption>
          <thead>
            <tr>
              <th scope="col">
                Recorded library
              </th>
              <th scope="col">
                Original method
              </th>
              <th scope="col">
                Candidate source
              </th>
              <th scope="col">
                Recorded method
              </th>
              <th scope="col">
                History events
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in attribution.groups"
              :key="JSON.stringify([row.library_id, row.original_method, row.candidate_source, row.recorded_method, row.provenance_status])"
            >
              <th scope="row">
                {{ libraryLabel(row) }}
              </th>
              <td>{{ row.provenance_status === 'captured' ? methodLabel(row.original_method) : statusLabels[row.provenance_status] }}</td>
              <td>{{ row.provenance_status === 'captured' ? sourceLabel(row.candidate_source) : 'Unavailable' }}</td>
              <td>{{ methodLabel(row.recorded_method) }}</td>
              <td>{{ number(row.events) }}</td>
            </tr>
            <tr v-if="attribution.groups.length === 0">
              <td colspan="5">
                No retained classification history.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="attribution.truncated"
        role="status"
      >
        Showing {{ attribution.groups.length }} of {{ number(attribution.group_count) }} attribution groups.
        Totals include all groups.
      </p>
      <p>
        Invalid provenance means the capture could not be validated; unsupported means its original method was not supported.
        A valid capture can have no candidate source when no proposal was supplied or a proposal did not apply.
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { evidenceNumber as number, evidenceLibraryLabel as libraryLabel, evidenceMethodLabel as methodLabel } from '../../utils/evidenceCoverageLabels'

const props = defineProps({ attribution: { type: Object, default: null }, historyEvents: { type: Number, required: true } })
const fields = ['captured_events', 'unrecorded_events', 'invalid_events', 'unsupported_events']
const available = computed(() => {
  const totals = props.attribution?.totals
  return totals && Array.isArray(props.attribution.groups) && totals.events === props.historyEvents
    && ['events', ...fields].every(field => Number.isSafeInteger(totals[field]) && totals[field] >= 0)
    && fields.reduce((sum, field) => sum + totals[field], 0) === totals.events
})
const statusLabels = { unrecorded: 'Unrecorded', invalid: 'Invalid provenance', unsupported: 'Unsupported method' }
const sourceNames = { policy_ranked: 'Policy ranking', signal_ranked: 'Signal ranking',
  decision_proposal: 'Decision proposal', signal_proposal: 'Signal proposal' }
const sourceLabel = source => source == null ? 'No candidate source' : sourceNames[source]
</script>

<style scoped>
p { margin: 0.75rem 0; color: #d1d5db; }
.table-scroll { overflow-x: auto; margin-top: 1.25rem; }
.table-scroll:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
table { width: 100%; border-collapse: collapse; }
caption { text-align: left; font-weight: 600; margin-bottom: 0.5rem; }
th, td { padding: 0.65rem; text-align: left; border-bottom: 1px solid #4b5563; }
thead th { vertical-align: bottom; }
tbody th { min-width: 12rem; font-weight: 500; }
</style>
