<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <p
      v-if="blockedReason"
      id="policy-builder-save-blocked-reason"
      class="rounded border border-amber-700/70 bg-amber-950/30 px-3 py-2 text-xs font-medium text-amber-200"
      role="status"
      aria-live="polite"
    >
      {{ blockedReason }}
    </p>
    <p
      v-if="visibleFeedback"
      id="policy-builder-save-error"
      class="rounded border px-3 py-2 text-xs"
      :class="feedbackClass"
      role="alert"
      aria-atomic="true"
    >
      <span class="font-semibold">Action needs attention:</span>
      {{ visibleFeedback.message }}
    </p>

    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Button
        variant="ghost"
        @click="emit('defer')"
      >
        {{ boundary.deferLabel || 'Defer for now' }}
      </Button>
      <Button
        variant="primary"
        :disabled="!boundary.canSave || saving"
        :aria-describedby="saveDescriptionIds"
        :aria-busy="saving || undefined"
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
  saveFeedback: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits({
  save: () => true,
  defer: () => true,
})

const blockedReason = computed(() => (
  props.boundary.canSave === false ? props.boundary.disabledReason : ''
))

const visibleFeedback = computed(() => {
  const feedback = props.saveFeedback
  if (!feedback?.message || ['pending', 'succeeded'].includes(feedback.statusId)) return null

  return feedback
})

const feedbackClass = computed(() => (
  visibleFeedback.value?.statusId === 'retryable_error'
    ? 'border-amber-700/70 bg-amber-950/30 text-amber-100'
    : 'border-red-800/70 bg-red-950/30 text-red-100'
))

const saveDescriptionIds = computed(() => {
  const ids = [
    blockedReason.value ? 'policy-builder-save-blocked-reason' : null,
    visibleFeedback.value ? 'policy-builder-save-error' : null,
  ].filter(Boolean)

  return ids.length > 0 ? ids.join(' ') : undefined
})
</script>
