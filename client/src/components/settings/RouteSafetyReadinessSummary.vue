<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="rounded-lg border p-4"
    :class="presentation.className"
    aria-labelledby="route-safety-readiness-heading"
    :aria-busy="loading"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <p class="text-xs font-medium uppercase tracking-wide text-blue-200">
          Routing safeguards
        </p>
        <h3
          id="route-safety-readiness-heading"
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

    <dl
      v-if="presentation.primaryGates.length > 0"
      class="mt-4 grid gap-2 sm:grid-cols-3"
      aria-label="Most frequent primary route safeguards"
    >
      <div
        v-for="gate in presentation.primaryGates"
        :key="gate.id"
        class="rounded border border-gray-700 bg-gray-900/30 px-3 py-2"
      >
        <dt class="text-xs text-gray-400">
          {{ gate.label }}
        </dt>
        <dd class="mt-1 text-lg font-semibold text-gray-100">
          {{ formatCount(gate.count) }}
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

    <p class="mt-3 text-xs text-gray-400">
      <span v-if="loading">Refreshing aggregate route-safety status…</span>
      <span v-else-if="lastUpdatedAt">Last refreshed {{ formattedLastUpdatedAt }}. {{ automaticUpdateMessage }}</span>
      <span v-else>{{ automaticUpdateMessage }}</span>
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
import { buildRouteSafetyReadinessPresentation } from '@/utils/routeSafetyReadinessPresentation'

const props = defineProps({
  report: {
    type: Object,
    default: () => null,
  },
  loading: {
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

const presentation = computed(() => buildRouteSafetyReadinessPresentation(props.report))
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
      statusAnnouncement.value = `Route-safety readiness changed: ${presentation.value.label}.`
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

function formatCount(value) {
  return Number(value).toLocaleString()
}
</script>
