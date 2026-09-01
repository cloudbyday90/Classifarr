<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    v-if="presentation.isRecommended"
    class="mt-4 rounded border border-amber-700/70 bg-amber-950/10 p-3"
    aria-labelledby="capability-metrics-error-log-handoff-heading"
  >
    <p class="text-xs font-medium uppercase tracking-wide text-amber-200">
      Diagnostic next step
    </p>
    <h4
      id="capability-metrics-error-log-handoff-heading"
      class="mt-1 font-medium text-gray-100"
    >
      {{ presentation.heading }}
    </h4>
    <p class="mt-2 text-sm text-gray-200">
      {{ presentation.message }}
    </p>
    <p class="mt-2 text-xs text-gray-400">
      It does not run a provider test, retry work, change settings, or affect classification and routing.
    </p>
    <RouterLink
      :to="presentation.location"
      class="mt-3 inline-flex rounded border border-amber-500/80 px-3 py-2 text-sm font-medium text-amber-100 hover:bg-amber-900/30 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-gray-950"
    >
      {{ presentation.actionLabel }}
    </RouterLink>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { buildCapabilityMetricsErrorLogHandoffPresentation } from '@/utils/capabilityMetricsErrorLogHandoffPresentation'

const props = defineProps({
  report: {
    type: Object,
    default: () => null,
  },
})

const presentation = computed(() => buildCapabilityMetricsErrorLogHandoffPresentation(props.report))
</script>
