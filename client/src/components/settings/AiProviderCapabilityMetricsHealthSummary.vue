<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    class="rounded-lg border p-4"
    :class="presentation.className"
    aria-labelledby="capability-metrics-health-heading"
    :aria-busy="loading || trendLoading || failureBreakdownLoading || failureCategoryCoverageLoading || failureRecencyLoading"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <p class="text-xs font-medium uppercase tracking-wide text-blue-200">
          Capability telemetry
        </p>
        <h3
          id="capability-metrics-health-heading"
          class="font-semibold text-gray-100"
        >
          {{ presentation.label }}
        </h3>
      </div>
      <span
        class="rounded-full border px-2.5 py-1 text-xs font-medium"
        :class="presentation.badgeClassName"
      >
        {{ presentation.badgeLabel }}
      </span>
    </div>

    <p class="mt-3 text-sm text-gray-200">
      {{ presentation.message }}
    </p>

    <dl class="mt-4 grid gap-2 sm:grid-cols-2">
      <div class="rounded border border-gray-700 bg-gray-900/30 px-3 py-2">
        <dt class="text-xs text-gray-400">
          Active metric streams ({{ presentation.windowHours }}h)
        </dt>
        <dd
          data-testid="capability-metrics-active-streams"
          class="mt-1 text-lg font-semibold text-gray-100"
        >
          {{ presentation.activeMetricStreamCount }}
        </dd>
      </div>
      <div class="rounded border border-gray-700 bg-gray-900/30 px-3 py-2">
        <dt class="text-xs text-gray-400">
          Persistence warnings ({{ presentation.windowHours }}h)
        </dt>
        <dd
          data-testid="capability-metrics-persistence-warnings"
          class="mt-1 text-lg font-semibold text-gray-100"
        >
          {{ presentation.persistenceFailureCount }}
        </dd>
      </div>
    </dl>

    <ul class="mt-4 list-disc space-y-1 pl-5 text-sm text-gray-300">
      <li
        v-for="guidance in presentation.guidance"
        :key="guidance"
      >
        {{ guidance }}
      </li>
    </ul>

    <AiProviderCapabilityMetricsHealthTrend
      :report="trendReport"
      :loading="trendLoading"
    />

    <AiProviderCapabilityMetricsTelemetryDetails
      :failure-breakdown="failureBreakdown"
      :failure-breakdown-loading="failureBreakdownLoading"
      :failure-category-coverage="failureCategoryCoverage"
      :failure-category-coverage-loading="failureCategoryCoverageLoading"
      :failure-recency="failureRecency"
      :failure-recency-loading="failureRecencyLoading"
    />

    <AiProviderCapabilityMetricsErrorLogHandoff :report="trendReport" />

    <p class="mt-3 text-xs text-gray-400">
      <span v-if="loading">Refreshing aggregate capability-telemetry status…</span>
      <span v-else-if="lastUpdatedAt">Last refreshed {{ formattedLastUpdatedAt }}. {{ automaticUpdateMessage }}</span>
      <span v-else>{{ automaticUpdateMessage }}</span>
    </p>

    <p
      data-testid="capability-metrics-health-status"
      class="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ statusAnnouncement }}
    </p>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import AiProviderCapabilityMetricsErrorLogHandoff from '@/components/settings/AiProviderCapabilityMetricsErrorLogHandoff.vue'
import AiProviderCapabilityMetricsHealthTrend from '@/components/settings/AiProviderCapabilityMetricsHealthTrend.vue'
import AiProviderCapabilityMetricsTelemetryDetails from '@/components/settings/AiProviderCapabilityMetricsTelemetryDetails.vue'
import { buildAiProviderCapabilityMetricsHealthPresentation } from '@/utils/aiProviderCapabilityMetricsHealthPresentation'

const props = defineProps({
  report: {
    type: Object,
    default: () => null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  trendReport: {
    type: Object,
    default: () => null,
  },
  trendLoading: {
    type: Boolean,
    default: false,
  },
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
  lastUpdatedAt: {
    type: String,
    default: null,
  },
  autoRefreshEnabled: {
    type: Boolean,
    default: true,
  },
})

const presentation = computed(() => buildAiProviderCapabilityMetricsHealthPresentation(props.report))
const statusAnnouncement = ref('')
let initialStatusId = null

watch(
  () => presentation.value.statusId,
  (nextStatusId) => {
    if (initialStatusId === null) {
      initialStatusId = nextStatusId
      return
    }
    if (nextStatusId !== initialStatusId) {
      statusAnnouncement.value = `Capability telemetry status changed: ${presentation.value.label}.`
      initialStatusId = nextStatusId
    }
  },
  { immediate: true },
)

const automaticUpdateMessage = computed(() => (
  props.autoRefreshEnabled
    ? 'Updates automatically while this page is visible.'
    : 'Automatic updates are paused.'
))

const formattedLastUpdatedAt = computed(() => {
  const timestamp = Date.parse(props.lastUpdatedAt || '')
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toLocaleString()
    : 'just now'
})
</script>
