<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <button
    type="button"
    class="px-2 py-1 border border-primary/60 rounded-sm text-xs text-primary hover:bg-primary/10 disabled:opacity-50 disabled:hover:bg-transparent"
    :disabled="!readinessState.canSubmit"
    :title="readinessState.reason"
    :aria-label="accessibleLabel"
    @click="emitActivate"
  >
    {{ label }}
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  readiness: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits({
  activate: () => true,
})

const readinessState = computed(() => ({
  canSubmit: Boolean(props.readiness?.canSubmit),
  reason: props.readiness?.reason || '',
}))

const accessibleLabel = computed(() => {
  if (readinessState.value.canSubmit || !readinessState.value.reason) {
    return props.label
  }

  return `${props.label}: ${readinessState.value.reason}`
})

const emitActivate = () => {
  if (!readinessState.value.canSubmit) return
  emit('activate')
}
</script>
