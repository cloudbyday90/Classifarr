<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <article
    v-if="recommendation"
    class="rounded-lg border border-amber-700/60 bg-amber-950/20 p-5"
    aria-labelledby="policy-candidate-broad-declared-policy-review-heading"
  >
    <h3
      id="policy-candidate-broad-declared-policy-review-heading"
      class="text-base font-medium text-amber-100"
    >
      {{ recommendation.heading }}
    </h3>
    <p class="mt-2 text-sm font-medium text-amber-100">
      {{ recommendation.label }}
    </p>
    <p class="mt-1 text-sm text-gray-300">
      {{ recommendation.message }}
    </p>
    <details class="mt-4 rounded border border-amber-700/50 bg-gray-900/40 p-3 text-sm">
      <summary class="cursor-pointer font-medium text-gray-100">
        {{ recommendation.disclosureLabel }}
      </summary>
      <dl class="mt-3 grid grid-cols-1 gap-3 text-gray-300 sm:grid-cols-2">
        <div>
          <dt class="font-medium text-white">
            Current 28-day period
          </dt>
          <dd class="mt-1 text-gray-400">
            {{ periodSummary(recommendation.current) }}
          </dd>
        </div>
        <div>
          <dt class="font-medium text-white">
            Previous 28-day period
          </dt>
          <dd class="mt-1 text-gray-400">
            {{ periodSummary(recommendation.previous) }}
          </dd>
        </div>
      </dl>
    </details>
    <p class="mt-4 text-xs text-gray-400">
      {{ recommendation.safeguard }}
    </p>
  </article>
</template>

<script setup>
import { computed } from 'vue'

import {
  formatPolicyCandidateCorrectionConfidenceInterval,
} from '@/utils/policyCandidateCorrectionCalibrationReadinessPresentation'
import {
  getPolicyCandidateCorrectionBroadDeclaredPolicyRecommendation,
} from '@/utils/policyCandidateCorrectionBroadDeclaredPolicyRecommendationPresentation'

const props = defineProps({
  longHorizonTrend: {
    type: Object,
    default: null,
  },
})

const recommendation = computed(() => (
  getPolicyCandidateCorrectionBroadDeclaredPolicyRecommendation(props.longHorizonTrend)
))

function periodSummary(period) {
  return `${period.window.startDate} to ${period.window.endDate}: ${period.changedSelectionOutcomeCount} of ${period.applicableDecisionCount} changed (${period.changedSelectionRatePercent}%). ${formatPolicyCandidateCorrectionConfidenceInterval(period.changedSelectionConfidenceInterval)}`
}
</script>
