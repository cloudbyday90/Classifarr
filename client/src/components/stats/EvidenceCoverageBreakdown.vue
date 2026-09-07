<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    class="evidence-breakdown"
    aria-labelledby="evidence-coverage-heading"
  >
    <h2 id="evidence-coverage-heading">
      Available evidence
    </h2>
    <p>
      All retained history and feedback, across all states. Imported membership describes
      where media was observed; it does not establish classifier accuracy.
      <RouterLink to="/libraries">
        Library profiles
      </RouterLink> show common genres, studios and other observed traits.
    </p>
    <p
      v-if="!available"
      role="status"
    >
      Evidence coverage is unavailable. Counts have not been estimated.
    </p>
    <template v-else>
      <p>
        Captured <time :datetime="coverage.captured_at">{{ capturedAt }}</time>.
        {{ number(coverage.history.totals.events) }} history events;
        {{ number(coverage.feedback.totals.observations) }} feedback observations.
        {{ number(coverage.feedback.totals.evaluated) }} evaluated
        ({{ percent(coverage.feedback.totals.evaluation_coverage) }} of feedback).
      </p>
      <HistoryLifecycleCounts :counts="coverage.history.totals" />
      <p>
        History states add up to history events. Completed includes imported membership and does not mean correct or reviewed.
        Pending decision and retry pending describe retained history, not live queue depth.
        Other includes failed, superseded and unknown states.
      </p>
      <p>History follows its recorded library; feedback follows its selected library. These populations cannot be added together.</p>
      <p>{{ number(coverage.history.totals.original_candidates) }} original candidates recorded.</p>
      <CandidateCaptureCounts :counts="coverage.history.totals" />
      <div
        class="table-scroll"
        tabindex="0"
        role="region"
        aria-label="History evidence table"
      >
        <table>
          <caption>Retained history by recorded library and method</caption>
          <thead>
            <tr>
              <th scope="col">
                Library / method
              </th>
              <th scope="col">
                History events
              </th>
              <th scope="col">
                Imported membership
              </th>
              <th scope="col">
                Original candidate recorded
              </th>
              <th scope="col">
                Linked feedback
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in coverage.history.groups"
              :key="`${row.library_id}:${row.method}`"
            >
              <th scope="row">
                {{ libraryLabel(row) }}<span class="method">{{ methodLabel(row.method) }}</span>
              </th>
              <td>
                {{ number(row.events) }} total
                <HistoryLifecycleCounts :counts="row" />
              </td>
              <td>{{ number(row.imported_observations) }}</td>
              <td>
                {{ number(row.original_candidates) }} recorded
                <CandidateCaptureCounts :counts="row" />
              </td>
              <td>{{ number(row.linked_feedback) }}</td>
            </tr>
            <tr v-if="coverage.history.groups.length === 0">
              <td colspan="5">
                No retained classification history.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="coverage.history.truncated"
        role="status"
      >
        Showing {{ coverage.history.groups.length }} of {{ number(coverage.history.group_count) }} history groups.
        Totals include all groups.
      </p>
      <p>
        Candidate availability includes policy rankings and explicit proposals saved before routing.
        No proposal means the classifier supplied none; unrecorded means capture was missing or unsupported.
        Imports and direct manual selections are not applicable. Only nonzero missing-reason counts are shown.
        Availability does not prove that a candidate is correct, reviewed or eligible for feedback evaluation.
      </p>
      <div
        class="table-scroll"
        tabindex="0"
        role="region"
        aria-label="Feedback evidence table"
      >
        <table>
          <caption>Retained feedback by selected library and recorded source method</caption>
          <thead>
            <tr>
              <th scope="col">
                Library / recorded source method
              </th>
              <th scope="col">
                Feedback observations
              </th>
              <th scope="col">
                Linked to source
              </th>
              <th scope="col">
                Evaluated outcomes
              </th>
              <th scope="col">
                Evaluated coverage
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in coverage.feedback.groups"
              :key="`${row.library_id}:${row.method}`"
            >
              <th scope="row">
                {{ libraryLabel(row) }}<span class="method">{{ methodLabel(row.method) }}</span>
              </th>
              <td>{{ number(row.observations) }}</td>
              <td>{{ number(row.source_bound) }}</td>
              <td>{{ number(row.evaluated) }}</td>
              <td>{{ percent(row.evaluation_coverage) }}</td>
            </tr>
            <tr v-if="coverage.feedback.groups.length === 0">
              <td colspan="5">
                No retained feedback observations.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="coverage.feedback.truncated"
        role="status"
      >
        Showing {{ coverage.feedback.groups.length }} of {{ number(coverage.feedback.group_count) }} feedback groups.
        Totals include all groups.
      </p>
      <p>Evaluated coverage uses retained feedback as its denominator. N/A means there are no feedback observations.</p>
      <EvidenceMethodAttribution
        :attribution="coverage.history_attribution"
        :history-events="coverage.history.totals.events"
      />
      <HistoryRecordingTimeCoverage
        :coverage="coverage.recording_time_coverage"
        :history-events="coverage.history.totals.events"
      />
      <UtcProvenanceCoverage :trend="coverage.utc_provenance_trend" />
      <LibraryUtcCoverage
        :coverage="coverage.utc_library_coverage"
        :trend="coverage.utc_provenance_trend"
        :history-events="coverage.history.totals.events"
      />
      <OriginalObservationTypes
        :coverage="coverage.utc_library_coverage"
        :trend="coverage.utc_provenance_trend"
        :history-events="coverage.history.totals.events"
      />
      <DailyProvenanceCoverage :trend="coverage.provenance_trend" />
      <p v-if="coverage.deleted_feedback_receipts">
        {{ number(coverage.deleted_feedback_receipts) }} deleted feedback results are excluded from these counts.
      </p>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import HistoryLifecycleCounts from './HistoryLifecycleCounts.vue'
import CandidateCaptureCounts from './CandidateCaptureCounts.vue'
import EvidenceMethodAttribution from './EvidenceMethodAttribution.vue'
import DailyProvenanceCoverage from './DailyProvenanceCoverage.vue'
import UtcProvenanceCoverage from './UtcProvenanceCoverage.vue'
import LibraryUtcCoverage from './LibraryUtcCoverage.vue'
import OriginalObservationTypes from './OriginalObservationTypes.vue'
import HistoryRecordingTimeCoverage from './HistoryRecordingTimeCoverage.vue'
import { evidenceNumber as number, evidenceLibraryLabel as libraryLabel, evidenceMethodLabel as methodLabel } from '../../utils/evidenceCoverageLabels'

const props = defineProps({ coverage: { type: Object, default: null } })
const available = computed(() => props.coverage?.status === 'available')
const capturedAt = computed(() => new Date(props.coverage.captured_at).toLocaleString())
const percent = value => value == null ? 'N/A' : `${(value * 100).toFixed(1)}%`
</script>

<style scoped>
.evidence-breakdown { margin: 2rem 0; padding: 1.25rem; background: #1f2937; border-radius: 8px; color: #f3f4f6; }
h2 { font-size: 1.25rem; font-weight: 600; }
p { margin: 0.75rem 0; color: #d1d5db; }
a { color: #93c5fd; text-decoration: underline; }
.table-scroll { overflow-x: auto; margin-top: 1.25rem; }
.table-scroll:focus-visible, a:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
table { width: 100%; border-collapse: collapse; }
caption { text-align: left; font-weight: 600; margin-bottom: 0.5rem; }
th, td { padding: 0.65rem; text-align: left; border-bottom: 1px solid #4b5563; }
thead th { vertical-align: bottom; }
tbody th { min-width: 12rem; font-weight: 500; }
.method { display: block; font-size: 0.875rem; color: #d1d5db; }
</style>
