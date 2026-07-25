<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <p
    v-if="status?.message"
    :id="status.id"
    ref="statusElement"
    class="rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 focus:ring-offset-background"
    :class="statusClass"
    :role="status.role"
    :aria-live="status.role === 'alert' ? 'assertive' : 'polite'"
    aria-atomic="true"
    tabindex="-1"
  >
    {{ status.message }}
  </p>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  status: {
    type: Object,
    default: null,
  },
})

const statusClass = computed(() => {
  if (props.status?.tone === 'success') {
    return 'border-green-800/70 bg-green-950/30 text-green-100'
  }

  if (props.status?.tone === 'warning') {
    return 'border-amber-700/70 bg-amber-950/30 text-amber-100'
  }

  return 'border-blue-800/70 bg-blue-950/30 text-blue-100'
})

const statusElement = ref(null)

const focus = () => {
  statusElement.value?.focus?.({ preventScroll: true })
}

defineExpose({ focus })
</script>
