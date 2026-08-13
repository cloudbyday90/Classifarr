<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    class="space-y-6"
    aria-labelledby="candidate-bound-verification-heading"
  >
    <div>
      <h2
        id="candidate-bound-verification-heading"
        class="text-xl font-semibold"
      >
        Candidate Verification Monitoring
      </h2>
      <p class="text-sm text-gray-400 mt-1">
        Aggregate, status-only monitoring for candidate-bound AI verification. It never changes routing or policy decisions.
      </p>
    </div>

    <div
      v-if="loading"
      class="rounded-lg border border-gray-700 bg-gray-800 p-6 text-sm text-gray-400"
      role="status"
    >
      Loading candidate verification metrics...
    </div>

    <div
      v-else-if="errorMessage"
      class="rounded-lg border border-red-700/60 bg-red-950/30 p-6 text-sm text-red-200"
      role="alert"
    >
      {{ errorMessage }}
    </div>

    <template v-else-if="report">
      <div
        class="rounded-lg border p-4"
        :class="driftPanelClass"
        role="status"
      >
        <p class="text-sm font-medium">
          {{ driftLabel }}
        </p>
        <p class="mt-1 text-sm text-gray-300">
          {{ report.driftGuard?.message }}
        </p>
        <p class="mt-2 text-xs text-gray-400">
          Comparing {{ report.window?.days || 0 }} complete UTC days with the preceding period.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <OutcomeSummary
          title="Current window"
          :summary="report.current"
        />
        <OutcomeSummary
          title="Previous window"
          :summary="report.previous"
        />
      </div>

      <div class="rounded-lg border border-gray-700 bg-gray-800 p-5">
        <h3 class="text-base font-medium">
          Monitored change signals
        </h3>
        <p class="mt-1 text-sm text-gray-400">
          Signals are advisory. Review deterministic evidence and provider capability before taking any operational action.
        </p>
        <ul class="mt-4 space-y-3">
          <li
            v-for="signal in report.driftGuard?.signals || []"
            :key="signal.statusId"
            class="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-700 bg-gray-900/50 px-3 py-2 text-sm"
          >
            <span class="font-medium">{{ signal.label }}</span>
            <span
              class="text-xs"
              :class="signalClass(signal.status)"
            >
              {{ signalLabel(signal.status) }}: {{ signal.currentCount }} now, {{ signal.previousCount }} prior ({{ formatSignedPercent(signal.rateChangePercentagePoints) }} pts)
            </span>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, ref } from 'vue'
import api from '../../api'

const OutcomeSummary = defineComponent({
  name: 'CandidateBoundVerificationOutcomeSummary',
  props: {
    title: { type: String, required: true },
    summary: { type: Object, default: () => ({}) },
  },
  setup(props) {
    return () => h('div', { class: 'rounded-lg border border-gray-700 bg-gray-800 p-5' }, [
      h('h3', { class: 'text-base font-medium' }, props.title),
      h('p', { class: 'mt-1 text-sm text-gray-400' }, `${props.summary?.totalOutcomes || 0} recorded verification outcomes`),
      h('ul', { class: 'mt-4 space-y-2 text-sm' }, (props.summary?.statusCounts || []).map(entry => h(
        'li',
        { key: entry.statusId, class: 'flex justify-between gap-3 text-gray-300' },
        [
          h('span', entry.label),
          h('span', { class: 'font-medium text-white' }, `${entry.count} (${entry.ratePercent}%)`),
        ],
      ))),
    ])
  },
})

const loading = ref(true)
const errorMessage = ref('')
const report = ref(null)

const driftStatus = computed(() => report.value?.driftGuard?.statusId || 'insufficient_data')
const driftLabel = computed(() => ({
  stable: 'No elevated verification safety trend',
  elevated: 'Verification safety trend needs review',
  insufficient_data: 'Verification trend needs more data',
}[driftStatus.value] || 'Verification trend unavailable'))
const driftPanelClass = computed(() => ({
  stable: 'border-green-700/60 bg-green-950/20',
  elevated: 'border-amber-600/70 bg-amber-950/20',
  insufficient_data: 'border-gray-700 bg-gray-800',
}[driftStatus.value] || 'border-gray-700 bg-gray-800'))

function signalLabel(status) {
  return {
    stable: 'Stable',
    elevated: 'Elevated',
    insufficient_data: 'Insufficient data',
  }[status] || 'Unavailable'
}

function signalClass(status) {
  return {
    stable: 'text-green-300',
    elevated: 'text-amber-300',
    insufficient_data: 'text-gray-400',
  }[status] || 'text-gray-400'
}

function formatSignedPercent(value) {
  const number = Number(value) || 0
  return `${number >= 0 ? '+' : ''}${number.toFixed(1)}`
}

async function loadMetrics() {
  loading.value = true
  errorMessage.value = ''

  try {
    report.value = await api.getCandidateBoundVerificationMetrics()
  } catch (_error) {
    errorMessage.value = 'Candidate verification metrics are currently unavailable.'
  } finally {
    loading.value = false
  }
}

onMounted(loadMetrics)
</script>
