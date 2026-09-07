<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <dl
    v-if="available"
    class="lifecycle-counts"
  >
    <div
      v-for="[field, label] in fields"
      :key="field"
    >
      <dt>{{ label }}</dt>
      <dd>{{ formatter.format(counts[field]) }}</dd>
    </div>
  </dl>
  <p
    v-else
    class="unavailable"
  >
    History lifecycle is unavailable.
  </p>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ counts: { type: Object, required: true } })
const fields = [
  ['completed_events', 'Completed'], ['pending_events', 'Pending decision'],
  ['retry_events', 'Retry pending'], ['other_events', 'Other'],
]
const formatter = new Intl.NumberFormat()
// A mixed-version deployment must not turn absent counts into zero.
const available = computed(() => {
  const values = fields.map(([field]) => props.counts[field])
  return Number.isSafeInteger(props.counts.events) && props.counts.events >= 0 &&
    values.every(value => Number.isSafeInteger(value) && value >= 0) &&
    values.reduce((sum, value) => sum + value, 0) === props.counts.events
})
</script>

<style scoped>
.lifecycle-counts { display: flex; flex-wrap: wrap; gap: 0.4rem 1.5rem; margin-top: 0.5rem; font-size: 0.875rem; color: #d1d5db; }
.lifecycle-counts > div { display: flex; gap: 0.5rem; }
dd { font-weight: 600; margin: 0; font-variant-numeric: tabular-nums; }
.unavailable { margin-top: 0.5rem; font-size: 0.875rem; color: #d1d5db; }
</style>
