<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <p
      v-if="message"
      class="text-sm text-amber-200 border border-amber-400/40 rounded-lg p-3 my-3"
    >
      {{ message }}
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  stats: { type: Object, default: () => ({}) },
  unavailable: { type: Boolean, default: false },
})
const messages = Object.freeze({
  busy: 'New work waits for capacity. Running work continues; Classifarr checks again automatically.',
  memory_pressure: 'New work waits for memory. Running work continues; Classifarr checks again automatically.',
  memory_unknown: 'Memory availability could not be checked. New work waits; Classifarr checks again automatically.',
})
const message = computed(() => {
  if (props.unavailable) return props.stats.resourceWaitReason ? 'Work capacity status is updating.' : ''
  if (props.stats.workerRunning !== true) return ''
  return Object.hasOwn(messages, props.stats.resourceWaitReason) ? messages[props.stats.resourceWaitReason] : ''
})
</script>
