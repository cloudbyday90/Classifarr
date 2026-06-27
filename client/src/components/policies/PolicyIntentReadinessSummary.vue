<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div
    class="rounded-lg border p-3 text-sm"
    :class="toneClass"
  >
    <div
      class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
      role="status"
      aria-live="polite"
    >
      <div>
        <div class="text-xs font-semibold uppercase tracking-wide opacity-80">
          Policy Readiness
        </div>
        <div class="mt-1 font-semibold">
          {{ summary.label }}
        </div>
        <p class="mt-1 text-xs opacity-90">
          {{ summary.message }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2 text-xs">
        <span class="rounded-full border border-current/30 px-2 py-1">
          {{ summary.warningCount }} warning{{ summary.warningCount === 1 ? '' : 's' }}
        </span>
        <span class="rounded-full border border-current/30 px-2 py-1">
          {{ summary.infoCount }} note{{ summary.infoCount === 1 ? '' : 's' }}
        </span>
      </div>
    </div>

    <ul
      v-if="summary.issues.length > 0"
      class="mt-2 space-y-1 text-xs"
    >
      <li
        v-for="issue in summary.issues"
        :key="issue.sectionKey + ':' + issue.code"
      >
        <button
          type="button"
          class="text-left underline decoration-current/40 underline-offset-2 hover:decoration-current focus:outline-none focus:ring-2 focus:ring-current/60 rounded-sm"
          :aria-label="`Review ${issue.sectionLabel} section`"
          @click="emit('focus-section', issue.sectionKey)"
        >
          <span class="font-medium">{{ issue.sectionLabel }}:</span>
          {{ issue.message }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  summary: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits({
  'focus-section': sectionKey => typeof sectionKey === 'string' && sectionKey.length > 0,
})

const toneClass = computed(() => {
  if (props.summary.tone === 'warning') {
    return 'border-amber-700/70 bg-amber-950/30 text-amber-100'
  }

  if (props.summary.tone === 'info') {
    return 'border-blue-800/70 bg-blue-950/30 text-blue-100'
  }

  return 'border-green-800/70 bg-green-950/30 text-green-100'
})
</script>
