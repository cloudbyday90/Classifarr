<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="space-y-4"
    aria-labelledby="ai-readiness-heading"
  >
    <div
      class="space-y-3 rounded-lg border p-4"
      :class="readinessPresentation.className"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      :aria-busy="loading || testing || refreshing"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <p class="text-xs font-medium uppercase tracking-wide text-blue-200">
            AI readiness
          </p>
          <h3
            id="ai-readiness-heading"
            class="font-semibold text-gray-100"
          >
            {{ readinessPresentation.label }}
          </h3>
        </div>
        <span
          class="rounded-full border px-2.5 py-1 text-xs font-medium"
          :class="readinessPresentation.badgeClassName"
        >
          {{ readinessPresentation.badgeLabel }}
        </span>
      </div>

      <p class="text-sm text-gray-200">
        {{ readinessPresentation.message }}
      </p>

      <ul
        v-if="readinessPresentation.guidance.length > 0"
        class="list-disc space-y-1 pl-5 text-sm text-gray-300"
      >
        <li
          v-for="guidance in readinessPresentation.guidance"
          :key="guidance"
        >
          {{ guidance }}
        </li>
      </ul>

      <p class="text-xs text-gray-400">
        <span v-if="testing">Testing the saved configuration. No media will be routed.</span>
        <span v-else-if="refreshing">Checking saved AI readiness…</span>
        <span v-else-if="lastUpdatedAt">Last checked {{ formattedLastUpdatedAt }}. {{ automaticUpdateMessage }}</span>
        <span v-else>{{ automaticUpdateMessage }}</span>
      </p>

      <Button
        v-if="requiresVerificationTest"
        variant="primary"
        :disabled="loading || testing"
        @click="emit('test')"
      >
        <span v-if="testing">Testing saved Ollama…</span>
        <span v-else>{{ verificationActionLabel }}</span>
      </Button>
    </div>

    <details
      data-testid="ai-readiness-diagnostics"
      class="rounded-lg border border-gray-700 bg-gray-800/30"
      @toggle="handleDiagnosticsToggle"
    >
      <summary class="cursor-pointer px-4 py-3 text-sm font-medium text-gray-200 hover:text-white">
        Diagnostics and update controls
      </summary>
      <div class="space-y-4 border-t border-gray-700 px-4 py-4">
        <p class="text-sm text-gray-400">
          Diagnostics are advisory. They do not change saved AI settings, run a model test, or route media.
        </p>

        <div class="flex flex-wrap items-center gap-3">
          <Button
            variant="outline-solid"
            size="sm"
            :aria-pressed="autoRefreshEnabled"
            @click="emit('toggle-auto-refresh')"
          >
            {{ autoRefreshEnabled ? 'Pause automatic updates' : 'Resume automatic updates' }}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            :disabled="loading || refreshing"
            @click="emit('refresh')"
          >
            <span v-if="loading || refreshing">Checking…</span>
            <span v-else>Refresh now</span>
          </Button>
          <RouterLink
            :to="{ name: 'Statistics', query: { tab: 'verification' } }"
            class="inline-flex items-center rounded-lg border border-blue-700 px-3 py-1.5 text-sm font-medium text-blue-200 hover:bg-blue-950/40 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            Open aggregate monitoring
          </RouterLink>
        </div>

        <p class="text-xs text-gray-500">
          {{ automaticUpdateMessage }} Automatic refresh reads only the server-owned saved capability.
        </p>

        <slot name="diagnostics" />
      </div>
    </details>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import Button from '@/components/common/Button.vue'

const props = defineProps({
  capability: {
    type: Object,
    default: () => null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  testing: {
    type: Boolean,
    default: false,
  },
  refreshing: {
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

const emit = defineEmits(['diagnostics-toggle', 'refresh', 'test', 'toggle-auto-refresh'])

const OLLAMA_STATUS_DETAILS = Object.freeze({
  verification_ready: Object.freeze({
    badgeLabel: 'Ready',
    badgeClassName: 'border-green-700/70 bg-green-950/30 text-green-200',
    className: 'border-green-800/70 bg-green-950/10',
  }),
  not_checked: Object.freeze({
    badgeLabel: 'Needs verification',
    badgeClassName: 'border-amber-700/70 bg-amber-950/30 text-amber-100',
    className: 'border-amber-800/70 bg-amber-950/10',
  }),
  classification_only: Object.freeze({
    badgeLabel: 'Classification only',
    badgeClassName: 'border-amber-700/70 bg-amber-950/30 text-amber-100',
    className: 'border-amber-800/70 bg-amber-950/10',
  }),
  unavailable: Object.freeze({
    badgeLabel: 'Unavailable',
    badgeClassName: 'border-red-700/70 bg-red-950/30 text-red-100',
    className: 'border-red-800/70 bg-red-950/10',
  }),
  model_changed: Object.freeze({
    badgeLabel: 'Needs verification',
    badgeClassName: 'border-amber-700/70 bg-amber-950/30 text-amber-100',
    className: 'border-amber-800/70 bg-amber-950/10',
  }),
})
const DEFAULT_STATUS_DETAIL = Object.freeze({
  badgeLabel: 'Status unavailable',
  badgeClassName: 'border-gray-600 bg-gray-800 text-gray-200',
  className: 'border-gray-700 bg-gray-800/50',
})
const SAVED_CAPABILITY_STATUS_DETAILS = Object.freeze({
  verification_ready: OLLAMA_STATUS_DETAILS.verification_ready,
  budget_fallback_advisory: Object.freeze({
    badgeLabel: 'Ready with advisory',
    badgeClassName: 'border-green-700/70 bg-green-950/30 text-green-200',
    className: 'border-green-800/70 bg-green-950/10',
  }),
  primary_path_ineligible: OLLAMA_STATUS_DETAILS.not_checked,
  primary_and_fallback_ineligible: OLLAMA_STATUS_DETAILS.not_checked,
})
const TESTABLE_STATUS_IDS = new Set(['not_checked', 'classification_only', 'unavailable', 'model_changed'])

const ollamaCapability = computed(() => {
  const capability = props.capability?.ollamaVerificationCapability
  if (!capability || typeof capability !== 'object') return null

  const statusId = typeof capability.statusId === 'string'
    ? capability.statusId
    : 'not_checked'

  return {
    statusId,
    label: typeof capability.label === 'string'
      ? capability.label
      : 'Ollama verification status unavailable',
    message: typeof capability.message === 'string'
      ? capability.message
      : 'Classifarr could not read the saved Ollama verification state.',
    guidance: Array.isArray(capability.guidance)
      ? capability.guidance.filter((entry) => typeof entry === 'string').slice(0, 3)
      : [],
    testable: capability.testable === true,
  }
})

const readinessPresentation = computed(() => {
  if (ollamaCapability.value) {
    return {
      ...(OLLAMA_STATUS_DETAILS[ollamaCapability.value.statusId] || DEFAULT_STATUS_DETAIL),
      label: ollamaCapability.value.label,
      message: ollamaCapability.value.message,
      guidance: ollamaCapability.value.guidance,
    }
  }

  const label = typeof props.capability?.label === 'string'
    ? props.capability.label
    : 'AI readiness is unavailable'
  const message = typeof props.capability?.message === 'string'
    ? props.capability.message
    : 'Classifarr could not read the saved AI capability.'
  const guidance = Array.isArray(props.capability?.guidance)
    ? props.capability.guidance.filter((entry) => typeof entry === 'string').slice(0, 3)
    : ['Open diagnostics and refresh the saved capability.']
  const statusDetail = SAVED_CAPABILITY_STATUS_DETAILS[props.capability?.statusId]
    || DEFAULT_STATUS_DETAIL

  return {
    ...statusDetail,
    label,
    message,
    guidance,
  }
})

const requiresVerificationTest = computed(() => (
  ollamaCapability.value?.testable === true
  && TESTABLE_STATUS_IDS.has(ollamaCapability.value.statusId)
))

const verificationActionLabel = computed(() => (
  ollamaCapability.value?.statusId === 'model_changed'
    ? 'Re-test saved Ollama verification'
    : 'Test saved Ollama verification'
))

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

function handleDiagnosticsToggle(event) {
  emit('diagnostics-toggle', event.currentTarget.open === true)
}
</script>
