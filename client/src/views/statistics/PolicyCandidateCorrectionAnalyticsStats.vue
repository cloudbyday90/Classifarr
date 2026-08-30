<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    class="space-y-6"
    aria-labelledby="policy-candidate-correction-analytics-heading"
  >
    <div>
      <h2
        id="policy-candidate-correction-analytics-heading"
        class="text-xl font-semibold"
      >
        Policy Correction Analytics
      </h2>
      <p class="mt-1 text-sm text-gray-400">
        Aggregate-only comparison of the original leading evidence state and later validated operator confirmation or destination change. It never exposes media, library, candidate, destination, provider, model, RAG text, or actor identity.
      </p>
    </div>

    <p
      class="sr-only"
      role="status"
      aria-atomic="true"
    >
      {{ monitoringStatusAnnouncement }}
    </p>

    <div
      v-if="loading"
      class="rounded-lg border border-gray-700 bg-gray-800 p-6 text-sm text-gray-400"
    >
      Loading policy correction analytics...
    </div>

    <div
      v-else-if="errorMessage"
      class="rounded-lg border border-red-700/60 bg-red-950/30 p-6 text-sm text-red-200"
      role="alert"
    >
      {{ errorMessage }}
    </div>

    <template v-else-if="report">
      <article
        class="rounded-lg border p-5"
        :class="readinessClass"
      >
        <h3 class="text-base font-medium">
          {{ report.readiness.label }}
        </h3>
        <p class="mt-1 text-sm text-gray-300">
          {{ report.readiness.message }}
        </p>
        <dl class="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <MetricRow
            label="Validated outcomes"
            :value="report.summary.outcomeCount"
          />
          <MetricRow
            label="Confirmed leading candidate"
            :value="report.summary.confirmedLeaderOutcomeCount"
          />
          <MetricRow
            label="Changed destination (applicable decisions)"
            :value="formatRate(
              report.summary.changedSelectionOutcomeCount,
              report.summary.changedSelectionRatePercent,
            )"
          />
        </dl>
        <p class="mt-3 text-xs text-gray-400">
          {{ report.window.days }} complete UTC days ending {{ report.window.endDate || '—' }}.
        </p>

        <div class="mt-5 border-t border-gray-700 pt-4">
          <h4 class="text-sm font-medium text-white">
            Overall selection-change review readiness
          </h4>
          <p
            class="mt-1 text-sm"
            :class="overallCalibrationReadinessPresentation.className"
          >
            {{ overallCalibrationReadinessPresentation.label }}
          </p>
          <p class="mt-1 text-sm text-gray-300">
            {{ overallCalibrationReadinessPresentation.message }}
          </p>
          <dl class="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <MetricRow
              label="Applicable decisions"
              :value="report.calibrationReadiness.applicableDecisionCount"
            />
            <MetricRow
              label="Changed selection"
              :value="formatRate(
                report.calibrationReadiness.changedSelectionOutcomeCount,
                report.calibrationReadiness.changedSelectionRatePercent,
              )"
            />
            <MetricRow
              label="Uncertainty"
              :value="formatConfidenceInterval(
                report.calibrationReadiness.changedSelectionConfidenceInterval,
              )"
            />
          </dl>
          <p class="mt-3 text-xs text-gray-400">
            Scores are not probabilities. This fixed 20% review floor evaluates later operator selection changes, not score correctness.
          </p>
        </div>
      </article>

      <article class="overflow-x-auto rounded-lg border border-gray-700 bg-gray-800 p-5">
        <h3 class="text-base font-medium">
          Score-margin outcome association
        </h3>
        <p class="mt-1 text-sm text-gray-400">
          The score margin is the original rounded difference between the leading and runner-up policy candidates. It is not a confidence guarantee.
        </p>
        <table class="mt-4 min-w-full text-left text-sm">
          <caption class="sr-only">
            Aggregate original policy-score margin bands and later validated operator outcomes.
          </caption>
          <thead class="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Margin band
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Outcomes
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Confirmed leader
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Changed, candidate set
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Outside candidate set
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Changed destination
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Review readiness
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Uncertainty
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="bucket in report.marginBuckets"
              :key="bucket.marginBandId"
              class="border-b border-gray-700/70 last:border-b-0"
            >
              <th
                scope="row"
                class="px-3 py-3 font-medium text-white"
              >
                {{ bucket.label }}
                <span class="block text-xs font-normal text-gray-400">{{ bucket.description }}</span>
              </th>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.outcomeCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.confirmedLeaderOutcomeCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.changedToCandidateOutcomeCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.changedOutsideCandidatesOutcomeCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ formatRate(bucket.changedSelectionOutcomeCount, bucket.changedSelectionRatePercent) }}
              </td>
              <td class="px-3 py-3">
                <span :class="calibrationReadinessPresentation(bucket).className">
                  {{ calibrationReadinessPresentation(bucket).label }}
                </span>
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ formatConfidenceInterval(bucket.calibrationReadiness.changedSelectionConfidenceInterval) }}
              </td>
            </tr>
          </tbody>
        </table>
      </article>

      <article class="overflow-x-auto rounded-lg border border-gray-700 bg-gray-800 p-5">
        <h3 class="text-base font-medium">
          Original evidence-state outcome association
        </h3>
        <p class="mt-1 text-sm text-gray-400">
          Each row is one fixed state from the original leading candidate. A changed destination is a review signal, not proof that one source caused an error.
        </p>
        <table
          v-if="report.evidenceSourceStateBuckets.length"
          class="mt-4 min-w-full text-left text-sm"
        >
          <caption class="sr-only">
            Aggregate original leading-candidate evidence states and later validated operator outcomes.
          </caption>
          <thead class="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Evidence source
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Original state
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Outcomes
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Confirmed leader
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Changed destination
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Review readiness
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Uncertainty
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="bucket in report.evidenceSourceStateBuckets"
              :key="`${bucket.evidenceSourceId}:${bucket.evidenceStateId}`"
              class="border-b border-gray-700/70 last:border-b-0"
            >
              <th
                scope="row"
                class="px-3 py-3 font-medium text-white"
              >
                {{ bucket.sourceLabel }}
              </th>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.stateLabel }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.outcomeCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.confirmedLeaderOutcomeCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ formatRate(bucket.changedSelectionOutcomeCount, bucket.changedSelectionRatePercent) }}
              </td>
              <td class="px-3 py-3">
                <span :class="calibrationReadinessPresentation(bucket).className">
                  {{ calibrationReadinessPresentation(bucket).label }}
                </span>
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ formatConfidenceInterval(bucket.calibrationReadiness.changedSelectionConfidenceInterval) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-else
          class="mt-4 text-sm text-gray-400"
        >
          No fixed evidence-source outcomes are available in this completed UTC-day window yet.
        </p>
      </article>

      <p class="text-sm text-gray-400">
        Review a representative cohort before adjusting any policy threshold, evidence weight, RAG behavior, or AI configuration. This view has no tuning or routing control.
      </p>
    </template>
  </section>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, ref } from 'vue'

import api from '@/api'
import {
  normalizePolicyCandidateCorrectionAnalyticsMetricsReport,
} from '@/utils/policyCandidateCorrectionAnalyticsPresentation'
import {
  formatPolicyCandidateCorrectionConfidenceInterval,
  getPolicyCandidateCorrectionCalibrationReadinessPresentation,
} from '@/utils/policyCandidateCorrectionCalibrationReadinessPresentation'

const MetricRow = defineComponent({
  name: 'PolicyCandidateCorrectionAnalyticsMetricRow',
  props: {
    label: { type: String, required: true },
    value: { type: [String, Number], required: true },
  },
  setup(props) {
    return () => h('div', { class: 'rounded border border-gray-700 bg-gray-900/50 px-3 py-2' }, [
      h('dt', { class: 'text-gray-400' }, props.label),
      h('dd', { class: 'mt-1 font-medium text-white' }, String(props.value)),
    ])
  },
})

const loading = ref(true)
const errorMessage = ref('')
const report = ref(null)

const readinessClass = computed(() => ({
  observing: 'border-blue-700/60 bg-blue-950/20',
  insufficient_data: 'border-gray-700 bg-gray-800',
}[report.value?.readiness?.statusId] || 'border-gray-700 bg-gray-800'))
const monitoringStatusAnnouncement = computed(() => {
  if (loading.value) return 'Loading policy correction analytics.'
  if (errorMessage.value || !report.value) return 'Policy correction analytics are currently unavailable.'

  return `${report.value.readiness.label}. ${overallCalibrationReadinessPresentation.value.label}.`
})

const overallCalibrationReadinessPresentation = computed(() => (
  getPolicyCandidateCorrectionCalibrationReadinessPresentation(
    report.value?.calibrationReadiness?.statusId,
  ) || getPolicyCandidateCorrectionCalibrationReadinessPresentation('insufficient_data')
))

function formatRate(count, percentage) {
  return `${Number(count) || 0} (${Number(percentage) || 0}%)`
}

function calibrationReadinessPresentation(bucket) {
  return getPolicyCandidateCorrectionCalibrationReadinessPresentation(
    bucket?.calibrationReadiness?.statusId,
  ) || getPolicyCandidateCorrectionCalibrationReadinessPresentation('insufficient_data')
}

function formatConfidenceInterval(interval) {
  return formatPolicyCandidateCorrectionConfidenceInterval(interval)
}

async function loadMetrics() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.getPolicyCandidateCorrectionAnalyticsMetrics()
    report.value = normalizePolicyCandidateCorrectionAnalyticsMetricsReport(response)
    if (!report.value) {
      errorMessage.value = 'Policy correction analytics are currently unavailable.'
    }
  } catch (_error) {
    errorMessage.value = 'Policy correction analytics are currently unavailable.'
  } finally {
    loading.value = false
  }
}

onMounted(loadMetrics)
</script>
