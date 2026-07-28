<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="mt-4 rounded border p-3"
    :class="toneClass"
    role="status"
    aria-live="polite"
    aria-atomic="true"
    aria-labelledby="policy-native-profile-recovery-title"
  >
    <p
      id="policy-native-profile-recovery-title"
      class="text-xs font-semibold uppercase tracking-wide"
    >
      Profile recovery
    </p>
    <p class="mt-1 font-medium">
      {{ recovery.label }}
    </p>
    <p class="mt-1 text-sm opacity-90">
      {{ recovery.message }}
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({
  name: 'PolicyNativeProfileRecoveryStatus',
})

const props = defineProps({
  recovery: {
    type: Object,
    default: () => ({
      stateId: 'checking',
      label: 'Checking recovery',
      message: 'Classifarr is checking automatic profile recovery status.',
    }),
  },
})

const toneClass = computed(() => {
  if (props.recovery?.stateId === 'not_required') {
    return 'border-green-800/70 bg-green-950/30 text-green-100'
  }

  if (['scheduled', 'queued', 'processing'].includes(props.recovery?.stateId)) {
    return 'border-blue-800/70 bg-blue-950/30 text-blue-100'
  }

  if (props.recovery?.stateId === 'awaiting_automatic_probe') {
    return 'border-amber-800/70 bg-amber-950/30 text-amber-100'
  }

  return 'border-gray-700 bg-gray-900/30 text-gray-200'
})
</script>
