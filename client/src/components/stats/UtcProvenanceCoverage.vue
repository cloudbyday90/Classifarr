<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="utc-provenance">
    <h3>UTC provenance coverage</h3>
    <p
      v-if="!available"
      role="status"
    >
      UTC provenance coverage is unavailable. Counts have not been estimated.
    </p>
    <template v-else>
      <p>
        {{ number(trend.totals.captured_events) }} of {{ number(trend.totals.events) }} events with known recording times
        have a captured original method ({{ percent(trend.totals.capture_coverage) }}).
        Last {{ trend.day_count }} UTC days: {{ dateLabel(trend.start_date) }} through {{ dateLabel(trend.end_date) }},
        including today so far.
      </p>
      <p>
        Dates use known recording times in UTC. Unknown times are excluded, without estimating older offsets.
        Today is partial; zero means no retained events with known times on that date. N/A means no events to measure.
        These counts describe capture availability, not classifier accuracy. Retention and deletions can change earlier counts.
      </p>
      <ProvenanceTrendTable
        :days="trend.days"
        caption="Original method capture by UTC recording date"
        region-label="UTC provenance coverage table"
        date-heading="UTC recording date"
      />
      <p>
        Outside this window: {{ number(trend.excluded.older_events) }} older,
        {{ number(trend.excluded.future_events) }} at or after the capture cutoff,
        {{ number(trend.excluded.unknown_events) }} with an unknown recording time.
        Window events plus these exclusions equal retained history. Do not add this view to the calendar view below.
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ProvenanceTrendTable from './ProvenanceTrendTable.vue'
import { evidenceNumber as number } from '../../utils/evidenceCoverageLabels'
import { isProvenanceTrend, provenanceDateLabel as dateLabel, provenancePercent as percent } from '../../utils/provenanceTrendDisplay'
const props = defineProps({ trend: { type: Object, default: null } })
const available = computed(() => props.trend?.time_zone === 'UTC'
  && isProvenanceTrend(props.trend, 'recorded_instant_utc', ['older_events', 'future_events', 'unknown_events']))
</script>

<style scoped>
h3 { margin-top: 1.5rem; font-size: 1.1rem; font-weight: 600; }
p { margin: 0.75rem 0; color: #d1d5db; }
</style>
