<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <dl
    v-if="available"
    class="capture-counts"
  >
    <div
      v-for="[field, label] in shownFields"
      :key="field"
    >
      <dt>{{ label }}</dt>
      <dd>{{ formatter.format(counts[field]) }}</dd>
    </div>
  </dl>
  <p
    v-else
    class="capture-unavailable"
  >
    Candidate capture reasons are unavailable.
  </p>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ counts: { type: Object, required: true } })
const fields = [['candidate_no_proposal', 'No proposal'], ['candidate_invalid', 'Invalid evidence'],
  ['candidate_not_applicable', 'Not applicable'], ['candidate_unrecorded', 'Unrecorded']]
const formatter = new Intl.NumberFormat()
const available = computed(() => {
  const values = [props.counts.original_candidates, ...fields.map(([field]) => props.counts[field])]
  return Number.isSafeInteger(props.counts.events) && props.counts.events >= 0 &&
    values.every(value => Number.isSafeInteger(value) && value >= 0) &&
    values.reduce((sum, value) => sum + value, 0) === props.counts.events
})
const shownFields = computed(() => fields.filter(([field]) => props.counts[field] > 0))
</script>

<style scoped>
.capture-counts { display: flex; flex-wrap: wrap; gap: 0.4rem 1.5rem; margin-top: 0.5rem; font-size: 0.875rem; color: #d1d5db; }
.capture-counts > div { display: flex; gap: 0.5rem; }
dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
.capture-unavailable { margin-top: 0.5rem; font-size: 0.875rem; color: #d1d5db; }
</style>
