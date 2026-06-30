<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <p
      id="policy-builder-save-status"
      class="rounded border px-3 py-2 text-xs"
      :class="statusClass"
      role="status"
      aria-live="polite"
    >
      <span class="font-semibold">
        {{ boundary.statusLabel }}:
      </span>
      {{ boundary.statusMessage }}
    </p>

    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Button
        variant="ghost"
        aria-describedby="policy-builder-save-status"
        @click="emit('defer')"
      >
        {{ boundary.deferLabel || 'Defer for now' }}
      </Button>
      <Button
        variant="primary"
        :disabled="!boundary.canSave"
        :title="boundary.canSave ? '' : boundary.disabledReason"
        aria-describedby="policy-builder-save-status"
        @click="emit('save')"
      >
        {{ boundary.saveLabel }}
      </Button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Button from '@/components/common/Button.vue'

const props = defineProps({
  boundary: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits({
  save: () => true,
  defer: () => true,
})

const statusClass = computed(() => {
  if (props.boundary.tone === 'success') {
    return 'border-green-800/70 bg-green-950/30 text-green-200'
  }

  if (props.boundary.tone === 'info') {
    return 'border-blue-800/70 bg-blue-950/30 text-blue-200'
  }

  return 'border-amber-700/70 bg-amber-950/30 text-amber-200'
})
</script>
