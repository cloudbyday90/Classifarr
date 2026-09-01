<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    v-if="presentation.isVisible"
    class="mt-4 rounded border border-amber-700/70 bg-amber-950/10 p-3"
    aria-labelledby="capability-metrics-failure-breakdown-heading"
    :aria-busy="loading"
  >
    <p class="text-xs font-medium uppercase tracking-wide text-amber-200">
      Diagnostic summary
    </p>
    <h4
      id="capability-metrics-failure-breakdown-heading"
      class="mt-1 font-medium text-gray-100"
    >
      {{ presentation.heading }}
    </h4>
    <p class="mt-2 text-sm text-gray-200">
      {{ presentation.message }}
    </p>

    <details
      v-if="presentation.stages.length || presentation.sqlstateCategories.length"
      class="mt-3 rounded border border-gray-700 bg-gray-900/30 p-3"
    >
      <summary class="cursor-pointer text-sm font-medium text-gray-100">
        View safe category counts
      </summary>
      <dl class="mt-3 grid gap-2 sm:grid-cols-2">
        <div
          v-for="stage in presentation.stages"
          :key="stage.id"
          class="rounded border border-gray-700 px-3 py-2"
        >
          <dt class="text-xs text-gray-400">
            Stage · {{ stage.label }}
          </dt>
          <dd class="mt-1 font-medium text-gray-100">
            {{ stage.count }}
          </dd>
        </div>
        <div
          v-for="category in presentation.sqlstateCategories"
          :key="category.id"
          class="rounded border border-gray-700 px-3 py-2"
        >
          <dt class="text-xs text-gray-400">
            Database condition · {{ category.label }}
          </dt>
          <dd class="mt-1 font-medium text-gray-100">
            {{ category.count }}
          </dd>
        </div>
      </dl>
    </details>

    <p class="mt-3 text-xs text-gray-400">
      No provider, model, media, endpoint, raw SQLSTATE, error text, or stack is shown here.
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { buildAiProviderCapabilityMetricsFailureBreakdownPresentation } from '@/utils/aiProviderCapabilityMetricsFailureBreakdownPresentation'

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
  buildAiProviderCapabilityMetricsFailureBreakdownPresentation(props.report)
))
</script>
