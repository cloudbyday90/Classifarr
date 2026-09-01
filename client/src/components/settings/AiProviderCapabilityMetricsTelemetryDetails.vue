<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <details
    v-if="hasDetails"
    class="mt-4 rounded border border-gray-700 bg-gray-900/20 p-3"
    data-testid="capability-metrics-telemetry-details"
  >
    <summary
      id="capability-metrics-telemetry-details-summary"
      class="cursor-pointer text-sm font-medium text-gray-100"
    >
      Review safe telemetry warning details
    </summary>
    <div
      class="mt-3"
      aria-labelledby="capability-metrics-telemetry-details-summary"
      :aria-busy="isLoading"
    >
      <p class="text-sm text-gray-300">
        These automatically refreshed aggregates add context to the current health state. They cannot diagnose the database or change AI, policies, RAG, classification, retries, or routing.
      </p>

      <AiProviderCapabilityMetricsFailureBreakdown
        :report="failureBreakdown"
        :loading="failureBreakdownLoading"
      />

      <AiProviderCapabilityMetricsFailureCategoryCoverage
        :report="failureCategoryCoverage"
        :loading="failureCategoryCoverageLoading"
      />

      <AiProviderCapabilityMetricsFailureRecency
        :report="failureRecency"
        :loading="failureRecencyLoading"
      />
    </div>
  </details>
</template>

<script setup>
import { computed } from 'vue'
import AiProviderCapabilityMetricsFailureBreakdown from '@/components/settings/AiProviderCapabilityMetricsFailureBreakdown.vue'
import AiProviderCapabilityMetricsFailureCategoryCoverage from '@/components/settings/AiProviderCapabilityMetricsFailureCategoryCoverage.vue'
import AiProviderCapabilityMetricsFailureRecency from '@/components/settings/AiProviderCapabilityMetricsFailureRecency.vue'
import { buildAiProviderCapabilityMetricsFailureBreakdownPresentation } from '@/utils/aiProviderCapabilityMetricsFailureBreakdownPresentation'
import { buildAiProviderCapabilityMetricsFailureCategoryCoveragePresentation } from '@/utils/aiProviderCapabilityMetricsFailureCategoryCoveragePresentation'
import { buildAiProviderCapabilityMetricsFailureRecencyPresentation } from '@/utils/aiProviderCapabilityMetricsFailureRecencyPresentation'

const props = defineProps({
  failureBreakdown: {
    type: Object,
    default: () => null,
  },
  failureBreakdownLoading: {
    type: Boolean,
    default: false,
  },
  failureCategoryCoverage: {
    type: Object,
    default: () => null,
  },
  failureCategoryCoverageLoading: {
    type: Boolean,
    default: false,
  },
  failureRecency: {
    type: Object,
    default: () => null,
  },
  failureRecencyLoading: {
    type: Boolean,
    default: false,
  },
})

const hasDetails = computed(() => (
  buildAiProviderCapabilityMetricsFailureBreakdownPresentation(props.failureBreakdown).isVisible
  || buildAiProviderCapabilityMetricsFailureCategoryCoveragePresentation(props.failureCategoryCoverage).isVisible
  || buildAiProviderCapabilityMetricsFailureRecencyPresentation(props.failureRecency).isVisible
))

const isLoading = computed(() => (
  props.failureBreakdownLoading
  || props.failureCategoryCoverageLoading
  || props.failureRecencyLoading
))
</script>
