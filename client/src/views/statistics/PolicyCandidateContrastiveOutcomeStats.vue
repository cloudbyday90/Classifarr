<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    class="space-y-6"
    aria-labelledby="policy-candidate-contrastive-outcome-heading"
  >
    <div>
      <h2
        id="policy-candidate-contrastive-outcome-heading"
        class="text-xl font-semibold"
      >
        Inventory Contrast Monitoring
      </h2>
      <p class="mt-1 text-sm text-gray-400">
        Aggregate-only comparison of the prior cross-library identity check and later validated operator actions. It never exposes media, library, candidate, destination, provider, or actor identity.
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
      Loading inventory contrast metrics...
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
            label="Checks observed"
            :value="report.summary.observationCount"
          />
          <MetricRow
            label="Attributed outcomes"
            :value="report.summary.attributedOutcomeCount"
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
      </article>

      <article class="overflow-x-auto rounded-lg border border-gray-700 bg-gray-800 p-5">
        <h3 class="text-base font-medium">
          Contrastive status and operator outcome
        </h3>
        <p class="mt-1 text-sm text-gray-400">
          A changed destination can remain inside the original policy candidate set. An outside-candidate selection flags only a policy-candidate-set review opportunity; it does not prove a retrieval, AI, or routing error.
        </p>
        <table class="mt-4 min-w-full text-left text-sm">
          <caption class="sr-only">
            Aggregate contrastive identity-check observations and later validated operator outcomes.
          </caption>
          <thead class="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Contrastive status
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Observed
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Attributed
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
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="bucket in report.buckets"
              :key="bucket.statusId"
              class="border-b border-gray-700/70 last:border-b-0"
            >
              <th
                scope="row"
                class="px-3 py-3 font-medium text-white"
              >
                {{ bucket.label }}
              </th>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.observationCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.attributedOutcomeCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.confirmedCandidateOutcomeCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.changedToCandidateOutcomeCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.changedOutsideCandidateOutcomeCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ formatRate(
                  bucket.changedToCandidateOutcomeCount + bucket.changedOutsideCandidateOutcomeCount,
                  bucket.changedSelectionRatePercent,
                ) }}
              </td>
            </tr>
          </tbody>
        </table>
      </article>

      <p class="text-sm text-gray-400">
        This view is descriptive. Do not treat a contrastive status as an automatic route, a model verdict, or a correctness measurement.
      </p>
    </template>
  </section>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, ref } from 'vue'

import api from '@/api'
import {
  normalizePolicyCandidateContrastiveOutcomeMetricsReport,
} from '@/utils/policyCandidateContrastiveOutcomeMetricsPresentation'

const MetricRow = defineComponent({
  name: 'PolicyCandidateContrastiveOutcomeMetricRow',
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
  if (loading.value) return 'Loading inventory contrast metrics.'
  if (errorMessage.value || !report.value) return 'Inventory contrast metrics are currently unavailable.'

  return report.value.readiness.label
})

function formatRate(count, percentage) {
  return `${Number(count) || 0} (${Number(percentage) || 0}%)`
}

async function loadMetrics() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.getPolicyCandidateContrastiveOutcomeMetrics()
    report.value = normalizePolicyCandidateContrastiveOutcomeMetricsReport(response)
    if (!report.value) {
      errorMessage.value = 'Inventory contrast metrics are currently unavailable.'
    }
  } catch (_error) {
    errorMessage.value = 'Inventory contrast metrics are currently unavailable.'
  } finally {
    loading.value = false
  }
}

onMounted(loadMetrics)
</script>
