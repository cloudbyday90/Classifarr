<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <p
    v-if="nextActionLabel"
    class="rounded border px-3 py-2 text-sm"
    :class="readiness?.ready
      ? 'border-green-800/70 bg-green-950/30 text-green-100'
      : 'border-amber-700/70 bg-amber-950/30 text-amber-100'"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <span class="font-semibold">Automation readiness:</span>
    {{ nextActionLabel }}
  </p>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  readiness: {
    type: Object,
    default: null,
  },
})

const nextActionLabel = computed(() => props.readiness?.nextAction?.label || '')
</script>
