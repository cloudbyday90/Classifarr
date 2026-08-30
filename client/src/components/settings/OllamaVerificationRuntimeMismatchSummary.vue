<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    class="space-y-4"
    aria-live="polite"
    aria-labelledby="ollama-runtime-mismatch-summary-heading"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h3
          id="ollama-runtime-mismatch-summary-heading"
          class="font-medium text-gray-200"
        >
          Runtime model integrity
        </h3>
        <p class="text-sm text-gray-400">
          Aggregate observations only. No model, endpoint, item, or error details are retained here.
        </p>
      </div>
      <Button
        v-if="showRefresh"
        variant="secondary"
        size="sm"
        :disabled="loading"
        @click="$emit('refresh')"
      >
        {{ loading ? 'Refreshing…' : 'Refresh status' }}
      </Button>
    </div>

    <div
      v-if="loading && !report"
      class="text-sm text-gray-400"
    >
      Loading runtime observations…
    </div>

    <div
      v-else
      class="space-y-4"
    >
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <div class="text-xs font-medium uppercase tracking-wide text-gray-400">
            Observed mismatches
          </div>
          <div
            data-testid="model-digest-mismatch-count"
            class="mt-1 text-2xl font-semibold text-amber-300"
          >
            {{ mismatchCount }}
          </div>
        </div>
        <div class="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <div class="text-xs font-medium uppercase tracking-wide text-gray-400">
            Last observed
          </div>
          <div
            data-testid="model-digest-mismatch-last-observed"
            class="mt-1 text-sm text-gray-200"
          >
            {{ formattedLastObservedAt }}
          </div>
        </div>
      </div>

      <p
        v-if="!hasObservations"
        class="text-sm text-green-300"
      >
        No strict-Ollama model-digest mismatches have been observed.
      </p>
      <p
        v-else
        class="text-sm text-amber-200"
      >
        If verification is marked as changed, confirm the intended local model and run Test Ollama Verification.
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
  showRefresh: {
    type: Boolean,
    default: true,
  },
})

defineEmits(['refresh'])

const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+$/

const mismatchCount = computed(() => {
  const value = String(props.report?.modelDigestMismatchCount ?? '').trim()
  return NON_NEGATIVE_DECIMAL_PATTERN.test(value)
    ? value.replace(/^0+(?=\d)/, '')
    : '0'
})

const lastObservedAt = computed(() => {
  const value = props.report?.lastObservedAt
  const timestamp = value ? new Date(value) : null
  return timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null
})

const formattedLastObservedAt = computed(() => (
  lastObservedAt.value ? lastObservedAt.value.toLocaleString() : 'Not observed'
))

const hasObservations = computed(() => (
  mismatchCount.value !== '0' || Boolean(lastObservedAt.value)
))
</script>
