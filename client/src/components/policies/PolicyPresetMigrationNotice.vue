<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div
    class="rounded-lg border border-primary/40 bg-primary/10 p-4 space-y-2"
    role="status"
    aria-atomic="true"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start">
        <div class="space-y-2">
          <p class="text-sm text-gray-200">
            {{ notice.summary }}
          </p>
          <p
            v-if="notice.preview"
            class="text-xs text-gray-400"
          >
            {{ notice.preview }}
          </p>
        </div>
      </div>
      <button
        type="button"
        class="shrink-0 text-xs px-2 py-1 rounded-sm border border-primary/40 text-primary hover:bg-primary/10"
        @click="$emit('dismiss')"
      >
        Hide migration update
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
