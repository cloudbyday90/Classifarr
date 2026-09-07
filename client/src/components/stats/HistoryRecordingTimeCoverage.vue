<template>
  <section
    class="recording-time-coverage"
    aria-label="History recording times"
  >
    <h3>History recording times</h3>
    <template v-if="available">
      <p>
        {{ number(coverage.recorded_events) }} of {{ number(coverage.events) }} retained history events
        have a known recording time. {{ number(coverage.unknown_events) }} have an unknown recording time.
      </p>
      <p>
        Recording times are kept across time zones. Unknown times have not been estimated from older dates.
        The daily view below still uses stored calendar dates.
        Recording-time coverage does not measure classification accuracy.
      </p>
    </template>
    <p v-else>
      Recording-time coverage is unavailable.
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { evidenceNumber as number } from '../../utils/evidenceCoverageLabels'

const props = defineProps({
  coverage: { type: Object, default: null },
  historyEvents: { type: Number, required: true },
})
const available = computed(() => {
  const value = props.coverage
  return value && ['events', 'recorded_events', 'unknown_events'].every(key =>
    Number.isSafeInteger(value[key]) && value[key] >= 0) &&
    value.events === props.historyEvents && value.recorded_events + value.unknown_events === value.events
})
</script>

<style scoped>
.recording-time-coverage { margin-top: 1.5rem; }
h3 { font-size: 1.1rem; font-weight: 600; }
p { margin: 0.75rem 0; color: #d1d5db; }
</style>
