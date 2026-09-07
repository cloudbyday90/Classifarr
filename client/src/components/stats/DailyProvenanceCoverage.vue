<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="daily-provenance">
    <h3>Daily provenance coverage</h3>
    <p
      v-if="!available"
      role="status"
    >
      Daily provenance coverage is unavailable. Counts have not been estimated.
    </p>
    <template v-else>
      <p>
        {{ number(trend.totals.captured_events) }} of {{ number(trend.totals.events) }} events have a captured original method
        ({{ percent(trend.totals.capture_coverage) }}).
        Last {{ trend.day_count }} calendar days: {{ dateLabel(trend.start_date) }} through {{ dateLabel(trend.end_date) }},
        including today so far. Database calendar: {{ trend.time_zone }}.
      </p>
      <p>
        Dates follow stored creation timestamps. Today is partial; its volume is not a full day's total.
        Zero means no retained events for that date; N/A means no events to measure.
        These counts describe capture availability, not classifier accuracy. Retention and deletions can change earlier counts.
      </p>
      <div
        class="table-scroll"
        tabindex="0"
        role="region"
        aria-label="Daily provenance coverage table"
      >
        <table>
          <caption>Original method capture by stored history date</caption>
          <thead>
            <tr>
              <th scope="col">
                History date
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
              v-for="day in trend.days"
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
      <p>
        Outside this window: {{ number(trend.excluded.older_events) }} older,
        {{ number(trend.excluded.future_events) }} at or after the capture cutoff,
        {{ number(trend.excluded.undated_events) }} without a usable date.
        Window events plus these exclusions equal retained history. This is another view of the same events.
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { evidenceNumber as number } from '../../utils/evidenceCoverageLabels'

const props = defineProps({ trend: { type: Object, default: null } })
const fields = ['events', 'captured_events', 'unrecorded_events', 'invalid_events', 'unsupported_events']
const available = computed(() => props.trend?.timestamp_basis === 'stored_database_calendar'
  && props.trend.day_count === 14 && props.trend.days?.length === 14 && props.trend.excluded
  && [props.trend.totals, ...props.trend.days].every(row => row
    && fields.every(field => Number.isSafeInteger(row[field]) && row[field] >= 0)
    && fields.slice(1).reduce((sum, field) => sum + row[field], 0) === row.events))
const dateFormatter = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
// UTC is used only to format the date-only label without moving it into the browser's time zone.
const dateLabel = value => dateFormatter.format(new Date(`${value}T00:00:00Z`))
const percent = value => value == null ? 'N/A' : `${(value * 100).toFixed(1)}%`
</script>

<style scoped>
h3 { margin-top: 1.5rem; font-size: 1.1rem; font-weight: 600; }
p { margin: 0.75rem 0; color: #d1d5db; }
.table-scroll { overflow-x: auto; margin-top: 1.25rem; }
.table-scroll:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
table { width: 100%; border-collapse: collapse; }
caption { text-align: left; font-weight: 600; margin-bottom: 0.5rem; }
th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #4b5563; }
thead th { vertical-align: bottom; }
tbody th { min-width: 10rem; font-weight: 500; }
.partial { display: block; color: #d1d5db; font-size: 0.875rem; }
</style>
