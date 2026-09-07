<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div
    class="table-scroll"
    tabindex="0"
    role="region"
    :aria-label="regionLabel"
  >
    <table>
      <caption>{{ caption }}</caption>
      <thead>
        <tr>
          <th scope="col">
            {{ dateHeading }}
          </th>
          <th scope="col">
            Events
          </th>
          <th scope="col">
            Captured
          </th>
          <th scope="col">
            Unrecorded
          </th>
          <th scope="col">
            Invalid
          </th>
          <th scope="col">
            Unsupported
          </th>
          <th scope="col">
            Capture coverage
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="day in days"
          :key="day.date"
        >
          <th scope="row">
            <time :datetime="day.date">{{ dateLabel(day.date) }}</time>
            <span
              v-if="day.is_partial"
              class="partial"
            >Today (partial)</span>
          </th>
          <td>{{ number(day.events) }}</td>
          <td>{{ number(day.captured_events) }}</td>
          <td>{{ number(day.unrecorded_events) }}</td>
          <td>{{ number(day.invalid_events) }}</td>
          <td>{{ number(day.unsupported_events) }}</td>
          <td>{{ percent(day.capture_coverage) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { evidenceNumber as number } from '../../utils/evidenceCoverageLabels'
import { provenanceDateLabel as dateLabel, provenancePercent as percent } from '../../utils/provenanceTrendDisplay'
defineProps({
  days: { type: Array, required: true }, caption: { type: String, required: true },
  regionLabel: { type: String, required: true }, dateHeading: { type: String, required: true },
})
</script>

<style scoped>
.table-scroll { overflow-x: auto; margin-top: 1.25rem; }
.table-scroll:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
table { width: 100%; border-collapse: collapse; }
caption { text-align: left; font-weight: 600; margin-bottom: 0.5rem; }
th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #4b5563; }
thead th { vertical-align: bottom; }
tbody th { min-width: 10rem; font-weight: 500; }
.partial { display: block; color: #d1d5db; font-size: 0.875rem; }
</style>
