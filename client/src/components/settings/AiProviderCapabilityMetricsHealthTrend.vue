<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    class="mt-4 rounded border p-3"
    :class="presentation.className"
    aria-labelledby="capability-metrics-health-trend-heading"
    :aria-busy="loading"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <p class="text-xs font-medium uppercase tracking-wide text-blue-200">
          Fixed three-day trend
        </p>
        <h4
          id="capability-metrics-health-trend-heading"
          class="font-medium text-gray-100"
        >
          {{ presentation.label }}
        </h4>
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

    <dl class="mt-3 grid gap-2 lg:grid-cols-3">
      <div
        v-for="period in presentation.periods"
        :key="period.id"
        class="rounded border border-gray-700 bg-gray-900/30 px-3 py-2"
      >
        <dt class="text-xs text-gray-400">
          {{ period.label }}
        </dt>
        <dd class="mt-1 text-sm text-gray-100">
          <span class="font-medium">{{ period.activeMetricStreamCount }}</span> streams ·
          <span class="font-medium">{{ period.persistenceFailureCount }}</span> warnings
        </dd>
      </div>
    </dl>

    <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-300">
      <li
        v-for="guidance in presentation.guidance"
        :key="guidance"
      >
        {{ guidance }}
      </li>
    </ul>

    <p class="mt-3 text-xs text-gray-400">
      Completed UTC days keep the comparison stable. It updates automatically while this page is visible.
    </p>

    <p
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
import { buildAiProviderCapabilityMetricsHealthTrendPresentation } from '@/utils/aiProviderCapabilityMetricsHealthTrendPresentation'

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

const presentation = computed(() => buildAiProviderCapabilityMetricsHealthTrendPresentation(props.report))
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
      statusAnnouncement.value = `Capability telemetry trend changed: ${presentation.value.label}.`
      initialStatusId = nextStatusId
    }
  },
  { immediate: true },
)
</script>
