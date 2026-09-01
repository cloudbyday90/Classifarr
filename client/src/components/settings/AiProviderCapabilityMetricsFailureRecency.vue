<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    v-if="presentation.isVisible"
    class="mt-4 rounded border border-blue-700/70 bg-blue-950/10 p-3"
    aria-labelledby="capability-metrics-failure-recency-heading"
    :aria-busy="loading"
  >
    <p class="text-xs font-medium uppercase tracking-wide text-blue-200">
      Telemetry warning recency
    </p>
    <h4
      id="capability-metrics-failure-recency-heading"
      class="mt-1 font-medium text-gray-100"
    >
      {{ presentation.heading }}
    </h4>
    <p class="mt-2 text-sm text-gray-200">
      {{ presentation.message }}
    </p>
    <p class="mt-3 text-xs text-gray-400">
      Three server-defined completed UTC-day aggregates are used. No provider, model, media, endpoint, timestamp, error text, stack, raw SQLSTATE, or log record is shown.
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { buildAiProviderCapabilityMetricsFailureRecencyPresentation } from '@/utils/aiProviderCapabilityMetricsFailureRecencyPresentation'

const props = defineProps({
  report: {
    type: Object,
    default: () => null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const presentation = computed(() => (
  buildAiProviderCapabilityMetricsFailureRecencyPresentation(props.report)
))
</script>
