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
      <ProvenanceTrendTable
        :days="trend.days"
        caption="Original method capture by stored history date"
        region-label="Daily provenance coverage table"
        date-heading="History date"
      />
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
import ProvenanceTrendTable from './ProvenanceTrendTable.vue'
import { isProvenanceTrend, provenanceDateLabel as dateLabel, provenancePercent as percent } from '../../utils/provenanceTrendDisplay'
import { evidenceNumber as number } from '../../utils/evidenceCoverageLabels'

const props = defineProps({ trend: { type: Object, default: null } })
const available = computed(() => isProvenanceTrend(props.trend, 'stored_database_calendar',
  ['older_events', 'future_events', 'undated_events']))
</script>

<style scoped>
h3 { margin-top: 1.5rem; font-size: 1.1rem; font-weight: 600; }
p { margin: 0.75rem 0; color: #d1d5db; }
</style>
