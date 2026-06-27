<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <span
          class="text-xl leading-none"
          aria-hidden="true"
        >⚠️</span>
        <div class="space-y-2">
          <div class="font-medium text-amber-200">
            Legacy preset attachments were auto-dropped after upgrade
          </div>
          <p class="text-sm text-amber-100/90">
            {{ notice.summary }}
          </p>
          <p
            v-if="notice.preview"
            class="text-xs text-amber-100/80"
          >
            {{ notice.preview }}
          </p>
        </div>
      </div>
      <button
        type="button"
        class="shrink-0 text-xs px-2 py-1 rounded-sm border border-amber-400/40 text-amber-200 hover:bg-amber-500/10"
        @click="$emit('dismiss')"
      >
        Dismiss
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  notice: {
    type: Object,
    required: true,
  },
})

defineEmits({
  dismiss: null,
})
</script>
