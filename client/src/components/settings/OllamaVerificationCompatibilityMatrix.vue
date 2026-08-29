<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    class="space-y-4"
    aria-labelledby="ollama-verification-compatibility-matrix-heading"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h3
          id="ollama-verification-compatibility-matrix-heading"
          class="font-medium text-gray-200"
        >
          Local model compatibility check
        </h3>
        <p class="text-sm text-gray-400">
          Tests up to six installed local models with the same media-free strict-output contract. This is advisory; the saved capability test remains the strict-verification authority.
        </p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        :disabled="running"
        @click="$emit('run')"
      >
        {{ running ? 'Running…' : 'Run compatibility check' }}
      </Button>
    </div>

    <p class="text-xs text-gray-500">
      Results are shown only for this response. Provider settings, prompts, outputs, raw errors, and media are not retained.
    </p>

    <div
      v-if="report"
      class="space-y-3 rounded-lg border border-gray-700 bg-gray-800/50 p-4"
    >
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span
          data-testid="compatibility-matrix-state"
          class="font-medium text-gray-100"
        >
          {{ state.label }}
        </span>
        <span class="text-gray-400">Ollama version: {{ ollamaVersion }}</span>
        <span
          v-if="omittedModelCount > 0"
          class="text-amber-300"
        >
          {{ omittedModelCount }} installed model{{ omittedModelCount === 1 ? '' : 's' }} not tested in this run.
        </span>
        <span
          v-if="skippedAlternativeModelCount > 0"
          class="text-amber-300"
        >
          {{ skippedAlternativeModelCount }} alternative model{{ skippedAlternativeModelCount === 1 ? '' : 's' }} skipped by the resource-boundary check.
        </span>
      </div>
      <p class="text-sm text-gray-300">
        {{ state.message }}
      </p>

      <p
        v-if="configurationCoverage"
        class="rounded border px-3 py-2 text-sm"
        :class="configurationCoverage.className"
        role="status"
        aria-atomic="true"
        data-testid="compatibility-matrix-configuration-coverage"
      >
        <span class="font-medium">{{ configurationCoverage.label }}.</span>
        {{ configurationCoverage.message }}
      </p>

      <ul
        v-if="outcomes.length > 0"
        class="divide-y divide-gray-700 rounded border border-gray-700"
      >
        <li
          v-for="outcome in outcomes"
          :key="outcome.modelName"
          class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm"
        >
          <span class="font-medium text-gray-100">{{ outcome.modelName }}</span>
          <span class="text-gray-400">Build: {{ outcome.modelBuildId || 'Unavailable' }}</span>
          <span :class="outcome.className">{{ outcome.label }}</span>
          <span class="text-xs text-gray-500">{{ formatCheckedAt(outcome.checkedAt) }}</span>
        </li>
      </ul>
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
  running: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['run'])

const MAX_OUTCOMES = 6
const SAFE_MODEL_NAME_PATTERN = /^[\p{L}\p{N}._:/+-]{1,255}$/u
const SAFE_BUILD_ID_PATTERN = /^[a-f0-9]{12}$/i
const SAFE_VERSION_PATTERN = /^[0-9A-Za-z._-]{1,64}$/
const STATE_DETAILS = Object.freeze({
  not_applicable: Object.freeze({
    label: 'Ollama is not the saved primary provider',
    message: 'Save Ollama as the primary provider before running this local compatibility check.',
  }),
  unavailable: Object.freeze({
    label: 'Local Ollama is unavailable',
    message: 'The saved local Ollama service could not be reached. Confirm it is running, then try again.',
  }),
  no_local_models: Object.freeze({
    label: 'No eligible local models found',
    message: 'No installed local model was available for this check. Cloud-tagged models are not used.',
  }),
  completed: Object.freeze({
    label: 'Compatibility check complete',
    message: 'Compare results, then run the saved capability test again after any local Ollama or model change.',
  }),
})
const OUTCOME_DETAILS = Object.freeze({
  verification_ready: Object.freeze({ label: 'Strict output ready', className: 'text-green-400' }),
  classification_only: Object.freeze({ label: 'Classification only', className: 'text-amber-300' }),
  unavailable: Object.freeze({ label: 'Unavailable', className: 'text-red-300' }),
})
const DEFAULT_STATE = Object.freeze({
  label: 'Compatibility result unavailable',
  message: 'The returned compatibility result was not recognized.',
})
const CONFIGURATION_COVERAGE_STATE_IDS = new Set(['completed', 'no_local_models'])
const CONFIGURATION_COVERAGE_DETAILS = Object.freeze({
  included: Object.freeze({
    label: 'Saved model included',
    message: 'Its probe result appears below. Retest the saved capability before relying on strict verification.',
    className: 'border-green-800 bg-green-950/20 text-green-200',
  }),
  notIncluded: Object.freeze({
    label: 'Saved model was not found among eligible local models',
    message: 'Confirm the saved model and tag are installed locally, then run this check and the saved capability test again.',
    className: 'border-amber-800 bg-amber-950/20 text-amber-100',
  }),
})

function normalizeSafeModelName(value) {
  const name = String(value ?? '').trim()
  return SAFE_MODEL_NAME_PATTERN.test(name) ? name : null
}

function normalizeBuildId(value) {
  const buildId = String(value ?? '').trim().toLowerCase()
  return SAFE_BUILD_ID_PATTERN.test(buildId) ? buildId : null
}

function normalizeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

function normalizeTimestamp(value) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

const state = computed(() => STATE_DETAILS[props.report?.stateId] || DEFAULT_STATE)
const ollamaVersion = computed(() => {
  const version = String(props.report?.ollamaVersion ?? '').trim()
  return SAFE_VERSION_PATTERN.test(version) ? version : 'Unavailable'
})
const omittedModelCount = computed(() => normalizeCount(props.report?.omittedModelCount))
const skippedAlternativeModelCount = computed(() => (
  normalizeCount(props.report?.skippedAlternativeModelCount)
))
const configurationCoverage = computed(() => {
  const report = props.report
  if (!CONFIGURATION_COVERAGE_STATE_IDS.has(report?.stateId)
    || typeof report?.configuredModelIncluded !== 'boolean') {
    return null
  }

  return report.configuredModelIncluded
    ? CONFIGURATION_COVERAGE_DETAILS.included
    : CONFIGURATION_COVERAGE_DETAILS.notIncluded
})
const outcomes = computed(() => {
  const responseOutcomes = Array.isArray(props.report?.outcomes) ? props.report.outcomes : []
  return responseOutcomes.slice(0, MAX_OUTCOMES).flatMap((outcome) => {
    const modelName = normalizeSafeModelName(outcome?.modelName)
    const detail = OUTCOME_DETAILS[outcome?.statusId]
    if (!modelName || !detail) return []

    return [{
      modelName,
      modelBuildId: normalizeBuildId(outcome?.modelBuildId),
      checkedAt: normalizeTimestamp(outcome?.checkedAt),
      ...detail,
    }]
  })
})

function formatCheckedAt(value) {
  return value ? value.toLocaleString() : 'Time unavailable'
}
</script>
