<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    v-if="presentation.isVisible"
    class="mt-4 rounded border border-blue-700/70 bg-blue-950/10 p-3"
    aria-labelledby="capability-metrics-category-coverage-heading"
    :aria-busy="loading"
  >
    <p class="text-xs font-medium uppercase tracking-wide text-blue-200">
      Telemetry contract coverage
    </p>
    <h4
      id="capability-metrics-category-coverage-heading"
      class="mt-1 font-medium text-gray-100"
    >
      {{ presentation.heading }}
    </h4>
    <p class="mt-2 text-sm text-gray-200">
      {{ presentation.message }}
    </p>

    <dl class="mt-3 grid gap-2 sm:grid-cols-3">
      <div
        v-for="period in presentation.periods"
        :key="period.id"
        class="rounded border border-gray-700 bg-gray-900/30 px-3 py-2"
      >
        <dt class="text-xs text-gray-400">
          {{ period.label }}
        </dt>
        <dd class="mt-1 font-medium text-gray-100">
          <span v-if="period.safeCategoryCoveragePercent !== null">
            {{ period.safeCategoryCoveragePercent }}% safely categorized
          </span>
          <span v-else>No warnings</span>
        </dd>
        <p class="mt-1 text-xs text-gray-400">
          {{ period.safeCategoryFailureCount }} of {{ period.totalFailureCount }} warnings
        </p>
      </div>
    </dl>

    <p class="mt-3 text-xs text-gray-400">
      Completed UTC-day aggregates exclude the in-progress day. No provider, model, media, endpoint, error text, stack, raw SQLSTATE, or log record is shown.
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { buildAiProviderCapabilityMetricsFailureCategoryCoveragePresentation } from '@/utils/aiProviderCapabilityMetricsFailureCategoryCoveragePresentation'

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
  buildAiProviderCapabilityMetricsFailureCategoryCoveragePresentation(props.report)
))
</script>
