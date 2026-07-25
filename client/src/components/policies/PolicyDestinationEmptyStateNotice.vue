<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="mt-3 rounded border border-amber-700/70 bg-amber-950/30 px-3 py-2 text-sm text-amber-100"
    :aria-labelledby="headingId"
  >
    <h6
      :id="headingId"
      class="font-semibold"
    >
      {{ emptyState.label }}
    </h6>
    <p
      :id="descriptionId"
      class="mt-1 text-xs text-amber-100"
    >
      {{ emptyState.description }}
    </p>
    <template v-if="isGuidanceOnly">
      <p class="mt-2 text-xs text-amber-100">
        <span class="font-semibold">Next:</span>
        {{ nextAction.label }}
      </p>
      <p class="mt-2 text-xs text-amber-100">
        Classifarr will not guess a destination from sparse evidence. The next declared-intent control is introduced separately from this read-only state.
      </p>
    </template>
    <template v-else>
      <Button
        class="mt-3"
        size="sm"
        variant="outline-solid"
        :disabled="actionDisabled"
        :aria-describedby="actionDescriptionIds"
        @click="emitNextAction"
      >
        {{ actionButtonLabel }}
      </Button>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import Button from '@/components/common/Button.vue'

const props = defineProps({
  emptyState: {
    type: Object,
    required: true,
  },
  activeActionId: {
    type: String,
    default: '',
  },
  activeActionStatusId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits({
  'next-action': emptyState => Boolean(emptyState?.stateId && emptyState?.nextAction?.actionId),
})

const headingId = computed(() => `policy-destination-empty-state-${props.emptyState.stateId}-title`)
const descriptionId = computed(() => `policy-destination-empty-state-${props.emptyState.stateId}-description`)
const nextAction = computed(() => props.emptyState?.nextAction || {})
const isGuidanceOnly = computed(() => nextAction.value.mode === 'guidance')
const isActionBusy = computed(() => (
  Boolean(props.activeActionId) && props.activeActionId === nextAction.value.actionId
))
const actionDisabled = computed(() => Boolean(props.activeActionId))
const actionButtonLabel = computed(() => (
  isActionBusy.value
    ? nextAction.value.busyLabel || nextAction.value.label || 'Working on library setup...'
    : nextAction.value.label || ''
))
const actionDescriptionIds = computed(() => [
  descriptionId.value,
  actionDisabled.value ? props.activeActionStatusId : null,
].filter(Boolean).join(' '))

const emitNextAction = () => {
  if (actionDisabled.value) return
  emit('next-action', props.emptyState)
}
</script>
