<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    class="space-y-4"
    aria-live="polite"
    aria-labelledby="ollama-verification-outcome-history-heading"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h3
          id="ollama-verification-outcome-history-heading"
          class="font-medium text-gray-200"
        >
          Saved test outcome trend
        </h3>
        <p class="text-sm text-gray-400">
          Fixed 30-day aggregates only. Provider settings, test inputs, outputs, errors, and media are not retained.
        </p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        :disabled="loading"
        @click="$emit('refresh')"
      >
        {{ loading ? 'Refreshing…' : 'Refresh history' }}
      </Button>
    </div>

    <div
      v-if="loading && !report"
      class="text-sm text-gray-400"
    >
      Loading saved test history…
    </div>

    <div
      v-else
      class="space-y-4"
    >
      <div class="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <p class="text-xs font-medium uppercase tracking-wide text-blue-200">
          Trend signal
        </p>
        <p
          data-testid="verification-outcome-signal-label"
          class="mt-1 text-lg font-semibold text-gray-100"
        >
          {{ signal.label }}
        </p>
        <p class="mt-1 text-sm text-gray-300">
          {{ signal.message }}
        </p>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div
          v-for="outcome in outcomes"
          :key="outcome.statusId"
          class="rounded-lg border border-gray-700 bg-gray-800/50 p-4"
        >
          <div class="text-xs font-medium uppercase tracking-wide text-gray-400">
            {{ outcome.label }}
          </div>
          <div
            :data-testid="`verification-outcome-count-${outcome.statusId}`"
            class="mt-1 text-2xl font-semibold text-gray-100"
          >
            {{ outcome.count }}
          </div>
          <div class="mt-1 text-xs text-gray-400">
            Last: {{ formatLastObservedAt(outcome.lastObservedAt) }}
          </div>
        </div>
      </div>

      <p class="text-xs text-gray-500">
        {{ totalTests }} saved test{{ totalTests === '1' ? '' : 's' }} in the last 30 days. Current saved capability—not this trend—controls strict verification.
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import Button from '@/components/common/Button.vue'

const props = defineProps({
  report: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['refresh'])

const NON_NEGATIVE_DECIMAL_PATTERN = /^\d{1,19}$/
const OUTCOME_DETAILS = Object.freeze([
  Object.freeze({ statusId: 'verification_ready', label: 'Strict verification ready' }),
  Object.freeze({ statusId: 'classification_only', label: 'Classification only' }),
  Object.freeze({ statusId: 'unavailable', label: 'Provider unavailable' }),
])
const DEFAULT_SIGNAL = Object.freeze({
  label: 'No recent tests',
  message: 'No saved Ollama verification tests were recorded in the last 30 days. Run Test Ollama Verification to establish a baseline.',
})
const SIGNAL_DETAILS = Object.freeze({
  no_tests: DEFAULT_SIGNAL,
  consistently_ready: Object.freeze({
    label: 'Consistently ready',
    message: 'Every recorded test in this window was ready for strict verification. The current saved capability remains the routing authority.',
  }),
  intermittent: Object.freeze({
    label: 'Mixed test outcomes',
    message: 'Both ready and non-ready outcomes were recorded. Check local Ollama availability and model state, then run the saved test again; history is advisory.',
  }),
  classification_only: Object.freeze({
    label: 'Strict output remains unavailable',
    message: 'Recorded tests could support general classification but not strict candidate-bound verification. The current saved capability remains blocked until a successful test.',
  }),
  unavailable: Object.freeze({
    label: 'Provider availability needs attention',
    message: 'Recorded tests could not reach or use the saved Ollama configuration. Confirm the local service and run the saved test again.',
  }),
  mixed_nonready: Object.freeze({
    label: 'Non-ready outcomes vary',
    message: 'Recorded tests were not ready and included both structured-output and availability failures. Resolve the current saved test before relying on strict verification.',
  }),
})

function normalizeCount(value) {
  const normalized = String(value ?? '').trim()
  return NON_NEGATIVE_DECIMAL_PATTERN.test(normalized)
    ? normalized.replace(/^0+(?=\d)/, '')
    : '0'
}

function normalizeTimestamp(value) {
  const timestamp = value ? new Date(value) : null
  return timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null
}

const outcomes = computed(() => {
  const reportOutcomes = Array.isArray(props.report?.outcomes) ? props.report.outcomes : []
  const reportByStatusId = new Map(reportOutcomes.map(outcome => [outcome?.statusId, outcome]))

  return OUTCOME_DETAILS.map((detail) => {
    const outcome = reportByStatusId.get(detail.statusId)
    return {
      ...detail,
      count: normalizeCount(outcome?.count),
      lastObservedAt: normalizeTimestamp(outcome?.lastObservedAt),
    }
  })
})

const signal = computed(() => {
  return SIGNAL_DETAILS[props.report?.signal?.id] || DEFAULT_SIGNAL
})

const totalTests = computed(() => normalizeCount(props.report?.totalTests))

function formatLastObservedAt(value) {
  return value ? value.toLocaleString() : 'Not observed'
}
</script>
