<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="space-y-4"
    aria-labelledby="verification-capability-summary-heading"
  >
    <div
      class="space-y-2"
      role="status"
      aria-atomic="true"
      :aria-busy="loading"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-blue-200">
        Current saved capability
      </p>
      <h3
        id="verification-capability-summary-heading"
        class="font-medium text-gray-100"
      >
        {{ capability.label }}
      </h3>
      <p class="text-sm text-gray-300">
        {{ capability.message }}
      </p>
      <ul
        v-if="capability.guidance.length > 0"
        class="list-disc space-y-1 pl-5 text-sm text-gray-400"
      >
        <li
          v-for="guidance in capability.guidance"
          :key="guidance"
        >
          {{ guidance }}
        </li>
      </ul>
    </div>

    <div
      v-if="ollamaCapability"
      class="space-y-2 rounded-lg border border-blue-900/70 bg-blue-950/20 p-4"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-blue-200">
        Saved Ollama verification
      </p>
      <h4 class="font-medium text-gray-100">
        {{ ollamaCapability.label }}
      </h4>
      <p class="text-sm text-gray-300">
        {{ ollamaCapability.message }}
      </p>
      <ul
        v-if="ollamaCapability.guidance.length > 0"
        class="list-disc space-y-1 pl-5 text-sm text-gray-400"
      >
        <li
          v-for="guidance in ollamaCapability.guidance"
          :key="guidance"
        >
          {{ guidance }}
        </li>
      </ul>
      <p
        v-if="ollamaCapability.checkedAt"
        class="text-xs text-gray-500"
      >
        Last tested: {{ formatCheckedAt(ollamaCapability.checkedAt) }}
      </p>

      <div
        v-if="requiresModelChangeRemediation"
        class="space-y-3 rounded-md border border-amber-700/70 bg-amber-950/20 p-3"
        aria-labelledby="ollama-model-change-remediation-heading"
      >
        <div class="space-y-1">
          <p
            id="ollama-model-change-remediation-heading"
            class="text-xs font-medium uppercase tracking-wide text-amber-200"
          >
            Recommended next step
          </p>
          <p class="text-sm text-amber-100">
            Run one test against the saved Ollama configuration to restore strict verification. This never retries automatically, routes media, or changes routing.
          </p>
          <p
            v-if="runtimeMismatchContext.hasObservations"
            class="text-xs text-amber-200/80"
          >
            Aggregate context: {{ runtimeMismatchContext.message }}
          </p>
        </div>
        <Button
          v-if="ollamaCapability.testable"
          variant="primary"
          :disabled="loading || testing"
          @click="emit('test')"
        >
          <span v-if="testing">Re-testing saved Ollama...</span>
          <span v-else>Re-test saved Ollama verification</span>
        </Button>
      </div>
    </div>

    <p class="text-xs text-gray-500">
      Refresh reads the saved state only. Testing sends one fixed, media-free JSON-schema request to the saved Ollama model and never routes media.
    </p>

    <div class="flex flex-wrap gap-3">
      <RouterLink
        :to="{ name: 'Statistics', query: { tab: 'verification' } }"
        class="inline-flex items-center rounded-lg border border-blue-700 px-3 py-2 text-sm font-medium text-blue-200 hover:bg-blue-950/40 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        Review Aggregate Readiness
      </RouterLink>
      <Button
        v-if="ollamaCapability?.testable && !requiresModelChangeRemediation"
        variant="primary"
        :disabled="loading || testing"
        @click="emit('test')"
      >
        <span v-if="testing">Testing Ollama...</span>
        <span v-else>Test Ollama Verification</span>
      </Button>
      <Button
        variant="secondary"
        :disabled="loading"
        @click="emit('refresh')"
      >
        <span v-if="loading">Refreshing...</span>
        <span v-else>Refresh Status</span>
      </Button>
    </div>
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
  runtimeMismatchSummary: {
    type: Object,
    default: () => null,
  },
})

const emit = defineEmits(['refresh', 'test'])

const capability = computed(() => ({
  label: typeof props.capability?.label === 'string'
    ? props.capability.label
    : 'Current verification status unavailable',
  message: typeof props.capability?.message === 'string'
    ? props.capability.message
    : 'Classifarr could not read the saved strict-verification capability.',
  guidance: Array.isArray(props.capability?.guidance)
    ? props.capability.guidance.filter((entry) => typeof entry === 'string').slice(0, 3)
    : ['Refresh the status after confirming the saved AI settings.'],
}))

const ollamaCapability = computed(() => {
  const capability = props.capability?.ollamaVerificationCapability
  if (!capability || typeof capability !== 'object') return null

  return {
    label: typeof capability.label === 'string'
      ? capability.label
      : 'Ollama verification status unavailable',
    message: typeof capability.message === 'string'
      ? capability.message
      : 'Classifarr could not read the saved Ollama verification state.',
    guidance: Array.isArray(capability.guidance)
      ? capability.guidance.filter((entry) => typeof entry === 'string').slice(0, 3)
      : [],
    checkedAt: typeof capability.checkedAt === 'string' ? capability.checkedAt : null,
    statusId: capability.statusId === 'model_changed' ? 'model_changed' : null,
    testable: capability.testable === true,
  }
})

const requiresModelChangeRemediation = computed(() => (
  ollamaCapability.value?.statusId === 'model_changed'
))

const runtimeMismatchContext = computed(() => {
  const countValue = String(props.runtimeMismatchSummary?.modelDigestMismatchCount ?? '').trim()
  const mismatchCount = /^\d+$/.test(countValue)
    ? countValue.replace(/^0+(?=\d)/, '')
    : '0'
  const observedAtValue = props.runtimeMismatchSummary?.lastObservedAt
  const observedAt = typeof observedAtValue === 'string' && Number.isFinite(Date.parse(observedAtValue))
    ? formatCheckedAt(observedAtValue)
    : null
  const hasObservations = mismatchCount !== '0' || observedAt !== null
  const observationLabel = mismatchCount === '1' ? 'mismatch' : 'mismatches'

  return {
    hasObservations,
    message: observedAt
      ? `${mismatchCount} runtime ${observationLabel}; last observed ${observedAt}.`
      : `${mismatchCount} runtime ${observationLabel} observed.`,
  }
})

function formatCheckedAt(value) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toLocaleString()
    : 'Unknown'
}
</script>
