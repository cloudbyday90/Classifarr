<template>
  <section
    class="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4"
    aria-labelledby="policy-change-review-history-summary-heading"
  >
    <div>
      <h3
        id="policy-change-review-history-summary-heading"
        class="text-lg font-medium"
      >
        Policy-change review activity
      </h3>
      <p class="mt-1 text-sm text-gray-400">
        A compact summary of completed review activity. It does not retain individual decisions, policies, media, outcomes, actors, AI, or RAG data.
      </p>
    </div>

    <div
      class="rounded-md border border-gray-700 bg-gray-900/40 p-4"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <template v-if="presentation">
        <p
          class="font-medium"
          :class="presentation.statusClass"
        >
          {{ presentation.heading }}
        </p>
        <p class="mt-1 text-sm text-gray-300">
          {{ presentation.message }}
        </p>
      </template>
      <p
        v-else-if="loading"
        class="text-sm text-gray-400"
      >
        Loading completed policy-change review activity…
      </p>
      <p
        v-else
        class="text-sm text-gray-400"
      >
        Policy-change review activity will refresh automatically while this page is open.
      </p>
    </div>

    <p
      v-if="error"
      class="rounded-md bg-red-900/30 p-3 text-sm text-red-300"
      role="alert"
    >
      {{ error }}
    </p>

    <section
      v-if="consistencyPresentation"
      class="rounded-md border border-gray-700 bg-gray-900/40 p-4"
      aria-labelledby="policy-change-review-history-consistency-heading"
    >
      <h4
        id="policy-change-review-history-consistency-heading"
        class="text-sm font-medium text-gray-200"
      >
        Review-process consistency
      </h4>
      <p
        class="mt-2 font-medium"
        :class="consistencyPresentation.statusClass"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ consistencyPresentation.heading }}
      </p>
      <p class="mt-1 text-sm text-gray-300">
        {{ consistencyPresentation.message }}
      </p>
    </section>

    <div
      v-if="summary?.historyAvailable"
      class="space-y-4"
    >
      <div
        v-for="period in presentedPeriods"
        :key="period.label"
        class="overflow-x-auto rounded-md border border-gray-700"
      >
        <table class="w-full text-left text-sm">
          <caption class="px-3 pt-3 text-left text-sm font-medium text-gray-200">
            {{ period.label }}
          </caption>
          <thead class="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th
                scope="col"
                class="px-3 py-2"
              >
                Reviewed conclusion
              </th>
              <th
                scope="col"
                class="px-3 py-2"
              >
                Recorded
              </th>
              <th
                scope="col"
                class="px-3 py-2"
              >
                Revised
              </th>
              <th
                scope="col"
                class="px-3 py-2"
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="conclusion in period.conclusionSummaries"
              :key="conclusion.decisionId"
              class="border-b border-gray-700 last:border-b-0"
            >
              <th
                scope="row"
                class="px-3 py-3 font-medium text-gray-200"
              >
                {{ conclusion.decisionLabel }}
              </th>
              <td class="px-3 py-3 text-gray-300">
                {{ conclusion.recordedCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ conclusion.revisedCount }}
              </td>
              <td class="px-3 py-3 text-gray-200">
                {{ conclusion.totalCount }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import api from '@/api'
import {
  getPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryPresentation,
  normalizePolicyCandidateCorrectionPolicyChangeReviewHistorySummary,
  presentPolicyCandidateCorrectionPolicyChangeReviewHistoryPeriod,
} from '@/utils/policyCandidateCorrectionPolicyChangeReviewHistorySummaryPresentation'
import {
  getPolicyCandidateCorrectionPolicyChangeReviewHistoryConsistencyPresentation,
} from '@/utils/policyCandidateCorrectionPolicyChangeReviewHistoryConsistencyPresentation'

const summary = ref(null)
const loading = ref(false)
const error = ref(null)
let refreshTimer = null

const presentation = computed(() => (
  getPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryPresentation(summary.value?.statusId)
))
const consistencyPresentation = computed(() => (
  getPolicyCandidateCorrectionPolicyChangeReviewHistoryConsistencyPresentation(summary.value?.consistency?.statusId)
))
const presentedPeriods = computed(() => (
  summary.value?.periods
    ?.map(presentPolicyCandidateCorrectionPolicyChangeReviewHistoryPeriod)
    .filter(Boolean) || []
))

function pageIsVisible() {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}

async function loadSummary({ background = false } = {}) {
  if (!background) loading.value = true
  error.value = null
  try {
    const normalized = normalizePolicyCandidateCorrectionPolicyChangeReviewHistorySummary(
      await api.getPolicyCandidateCorrectionPolicyChangeReviewHistorySummary(),
    )
    if (!normalized) throw new Error('Policy-change review history summary returned an unexpected response.')
    summary.value = normalized
  } catch (loadError) {
    console.error('Failed to load policy-change review history summary:', loadError)
    if (!background) {
      summary.value = null
      error.value = 'Unable to load the policy-change review history summary. No policy, AI, RAG, or routing change was made.'
    }
  } finally {
    if (!background) loading.value = false
  }
}

function onVisibilityChange() {
  if (pageIsVisible()) loadSummary({ background: true })
}

onMounted(() => {
  loadSummary()
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibilityChange)
  refreshTimer = setInterval(() => {
    if (pageIsVisible()) loadSummary({ background: true })
  }, 5 * 60 * 1000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>
