<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    v-if="declaredSignals.length > 0"
    class="mt-4 border-t border-gray-700 pt-3"
    aria-labelledby="intent-signal-chip-list-title"
  >
    <p
      id="intent-signal-chip-list-title"
      class="text-xs font-medium text-gray-100"
    >
      Declared destination signals
    </p>
    <p class="mt-1 text-xs text-gray-400">
      These values become native purpose rules only when this new policy is created.
    </p>
    <ul class="mt-2 flex flex-wrap gap-2">
      <li
        v-for="signal in declaredSignals"
        :key="signal.candidateId"
        class="inline-flex items-center gap-2 rounded border border-green-800/70 bg-green-950/30 px-2 py-1 text-xs text-green-100"
      >
        <span>{{ signal.label }}</span>
        <button
          class="rounded px-1 text-green-100 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-primary"
          type="button"
          :aria-label="`Remove ${signal.label} from declared destination signals`"
          @click="removeSignal(signal)"
        >
          Remove
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import {
  buildIntentSignalCommandPlan,
  normalizeIntentSignalCandidates,
} from '@/utils/policyIntentSignalDraft'

const props = defineProps({
  signals: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits({
  'draft-command-plan': plan => Boolean(plan?.commands?.length),
})

const declaredSignals = computed(() => normalizeIntentSignalCandidates(props.signals))

const removeSignal = (signal) => {
  const plan = buildIntentSignalCommandPlan({
    commandId: 'remove_signal_value',
    candidates: [signal],
  })

  if (plan?.commands?.length) {
    emit('draft-command-plan', plan)
  }
}
</script>
