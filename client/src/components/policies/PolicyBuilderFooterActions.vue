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
      <span
        v-if="blockedReason"
        id="policy-builder-save-blocked-reason"
        class="mt-1 block font-medium"
      >
        <span class="font-semibold">Next:</span>
        {{ blockedReason }}
      </span>
    </p>
    <p
      v-if="saveError"
      id="policy-builder-save-error"
      class="rounded border border-red-800/70 bg-red-950/30 px-3 py-2 text-xs text-red-100"
      role="alert"
    >
      <span class="font-semibold">Unable to save policy:</span>
      {{ saveError }}
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
        :disabled="!boundary.canSave || saving"
        :aria-describedby="saveDescriptionIds"
        @click="emit('save')"
      >
        {{ saving ? 'Saving policy...' : boundary.saveLabel }}
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
  saving: {
    type: Boolean,
    default: false,
  },
  saveError: {
    type: String,
    default: '',
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

const blockedReason = computed(() => (
  props.boundary.canSave === false ? props.boundary.disabledReason : ''
))

const saveDescriptionIds = computed(() => [
  'policy-builder-save-status',
  props.saveError ? 'policy-builder-save-error' : null,
].filter(Boolean).join(' '))
</script>
