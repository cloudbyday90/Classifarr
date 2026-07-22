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
    <p class="mt-1 text-xs text-amber-100">
      {{ emptyState.description }}
    </p>
    <p class="mt-2 text-xs text-amber-100">
      <span class="font-semibold">Next:</span>
      {{ emptyState.nextAction.label }}
    </p>
    <p
      v-if="isGuidanceOnly"
      class="mt-2 text-xs text-amber-100"
    >
      Classifarr will not guess a destination from sparse evidence. The next declared-intent control is introduced separately from this read-only state.
    </p>
    <Button
      v-else
      class="mt-3"
      size="sm"
      variant="outline-solid"
      :disabled="busy"
      @click="emit('next-action', emptyState)"
    >
      {{ busy ? busyLabel : emptyState.nextAction.label }}
    </Button>
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
  busy: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits({
  'next-action': emptyState => Boolean(emptyState?.stateId && emptyState?.nextAction?.actionId),
})

const headingId = computed(() => `policy-destination-empty-state-${props.emptyState.stateId}-title`)
const isGuidanceOnly = computed(() => props.emptyState?.nextAction?.mode === 'guidance')
const busyLabel = computed(() => (
  props.emptyState?.nextAction?.mode === 'sync_library'
    ? 'Syncing library...'
    : 'Opening library mapping...'
))
</script>
