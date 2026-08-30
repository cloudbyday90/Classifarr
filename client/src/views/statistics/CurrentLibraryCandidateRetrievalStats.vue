<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    class="space-y-6"
    aria-labelledby="current-library-candidate-retrieval-heading"
  >
    <div>
      <h2
        id="current-library-candidate-retrieval-heading"
        class="text-xl font-semibold"
      >
        Candidate Retrieval Monitoring
      </h2>
      <p class="mt-1 text-sm text-gray-400">
        Aggregate latency, catalog-match, candidate-set, and AI/operator-agreement telemetry for bounded current-library retrieval. It never changes AI, policy, or routing decisions.
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
      Loading candidate retrieval metrics...
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
        :class="readinessClass"
      >
        <p class="text-sm font-medium">
          {{ readinessLabel }}
        </p>
        <p class="mt-1 text-sm text-gray-300">
          {{ readinessMessage }}
        </p>
        <p class="mt-2 text-xs text-gray-400">
          {{ report.window?.days || 0 }} complete UTC days ending {{ report.window?.endDate || '—' }}.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <article class="rounded-lg border border-gray-700 bg-gray-800 p-5">
          <h3 class="text-base font-medium">
            Retrieval health
          </h3>
          <dl class="mt-4 space-y-3 text-sm">
            <MetricRow
              label="Observed lookups"
              :value="report.retrieval?.observationCount || 0"
            />
            <MetricRow
              label="Available"
              :value="formatRate(report.retrieval?.availableCount, report.retrieval?.availabilityRatePercent)"
            />
            <MetricRow
              label="Catalog matches"
              :value="report.retrieval?.matchingObservationCount || 0"
            />
            <MetricRow
              label="Direct catalog matches"
              :value="report.retrieval?.directMatchObservationCount || 0"
            />
            <MetricRow
              label="Unavailable"
              :value="report.retrieval?.unavailableCount || 0"
            />
          </dl>
        </article>

        <article class="rounded-lg border border-gray-700 bg-gray-800 p-5">
          <h3 class="text-base font-medium">
            Operator candidate-set coverage
          </h3>
          <p class="mt-1 text-sm text-gray-400">
            An outside-candidate selection means the bounded candidate set should be reviewed.
            It does not prove a retrieval or AI error.
          </p>
          <dl class="mt-4 space-y-3 text-sm">
            <MetricRow
              label="Attributed operator outcomes"
              :value="report.operatorCandidateSetAttribution?.attributedOperatorOutcomeCount || 0"
            />
            <MetricRow
              label="Confirmed bounded candidate"
              :value="report.operatorCandidateSetAttribution?.confirmedCandidateOutcomeCount || 0"
            />
            <MetricRow
              label="Broader chooser, candidate selected"
              :value="report.operatorCandidateSetAttribution?.changedToCandidateOutcomeCount || 0"
            />
            <MetricRow
              label="Broader chooser, outside candidates"
              :value="report.operatorCandidateSetAttribution?.changedOutsideCandidateOutcomeCount || 0"
            />
            <MetricRow
              label="Routed not applicable"
              :value="report.operatorCandidateSetAttribution?.routedNotApplicableOutcomeCount || 0"
            />
            <MetricRow
              label="Candidate-set selection rate (applicable decisions)"
              :value="formatRate(
                candidateSetSelectionCount,
                report.operatorCandidateSetAttribution?.candidateSetSelectionRatePercent,
              )"
            />
            <MetricRow
              label="Without attribution"
              :value="report.operatorCandidateSetAttribution?.unattributedResolvedOutcomeCount || 0"
            />
          </dl>
        </article>

        <article class="rounded-lg border border-gray-700 bg-gray-800 p-5">
          <h3 class="text-base font-medium">
            AI proposal and operator agreement
          </h3>
          <p class="mt-1 text-sm text-gray-400">
            Agreement means the operator later selected the same destination as the bounded AI proposal. It is not a correctness rate.
          </p>
          <dl class="mt-4 space-y-3 text-sm">
            <MetricRow
              label="AI proposals"
              :value="report.operatorAgreement?.proposalCount || 0"
            />
            <MetricRow
              label="Resolved proposals"
              :value="report.operatorAgreement?.resolvedProposalCount || 0"
            />
            <MetricRow
              label="Same destination"
              :value="formatRate(report.operatorAgreement?.agreedProposalCount, report.operatorAgreement?.agreementRatePercent)"
            />
            <MetricRow
              label="Operator selected alternative"
              :value="report.operatorAgreement?.alternativeProposalCount || 0"
            />
            <MetricRow
              label="Awaiting operator resolution"
              :value="report.operatorAgreement?.pendingProposalCount || 0"
            />
          </dl>
        </article>
      </div>

      <article
        class="rounded-lg border p-5"
        :class="candidateSetPolicyReviewClass"
      >
        <h3 class="text-base font-medium">
          Candidate-set policy review
        </h3>
        <p class="mt-2 text-sm font-medium">
          {{ candidateSetPolicyReviewLabel }}
        </p>
        <p class="mt-1 text-sm text-gray-300">
          {{ candidateSetPolicyReviewMessage }}
        </p>
        <dl class="mt-4 space-y-3 text-sm">
          <MetricRow
            label="Applicable attributed decisions"
            :value="formatProgress(
              candidateSetPolicyReview?.applicableDecisionCount,
              candidateSetPolicyReview?.minimumApplicableDecisionCount,
            )"
          />
          <MetricRow
            label="Outside-candidate selections"
            :value="formatRate(
              candidateSetPolicyReview?.outsideCandidateOutcomeCount,
              candidateSetPolicyReview?.outsideCandidateRatePercent,
            )"
          />
          <MetricRow
            label="Review threshold"
            :value="`${candidateSetPolicyReview?.minimumOutsideCandidateOutcomeCount || 0} selections at ${candidateSetPolicyReview?.minimumOutsideCandidateRatePercent || 0}%`"
          />
        </dl>
      </article>

      <article class="rounded-lg border border-gray-700 bg-gray-800 p-5">
        <h3 class="text-base font-medium">
          Lookup latency distribution
        </h3>
        <p class="mt-1 text-sm text-gray-400">
          Fixed latency bands keep this monitoring low-cardinality and content-free.
        </p>
        <ul class="mt-4 space-y-2 text-sm">
          <li
            v-for="band in report.retrieval?.latencyBands || []"
            :key="band.id"
            class="flex justify-between gap-3 rounded border border-gray-700 bg-gray-900/50 px-3 py-2"
          >
            <span class="text-gray-300">{{ band.label }}</span>
            <span class="font-medium text-white">{{ band.count }} ({{ band.ratePercent }}%)</span>
          </li>
        </ul>
      </article>
    </template>
  </section>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, ref } from 'vue'
import api from '../../api'

const MetricRow = defineComponent({
  name: 'CurrentLibraryCandidateRetrievalMetricRow',
  props: {
    label: { type: String, required: true },
    value: { type: [String, Number], required: true },
  },
  setup(props) {
    return () => h('div', { class: 'flex justify-between gap-3' }, [
      h('dt', { class: 'text-gray-300' }, props.label),
      h('dd', { class: 'font-medium text-white' }, String(props.value)),
    ])
  },
})

const loading = ref(true)
const errorMessage = ref('')
const report = ref(null)

const readinessStatus = computed(() => report.value?.readiness?.statusId || 'insufficient_data')
const readinessLabel = computed(() => ({
  observing: 'Candidate retrieval observations are available',
  insufficient_data: 'Candidate retrieval needs more observations',
}[readinessStatus.value] || 'Candidate retrieval monitoring is unavailable'))
const readinessMessage = computed(() => ({
  observing: 'Aggregate retrieval and proposal-resolution observations are available. Review them before considering semantic retrieval changes.',
  insufficient_data: 'No current-library retrieval observations have been recorded in this completed UTC-day window yet.',
}[readinessStatus.value] || 'Candidate retrieval monitoring is currently unavailable.'))
const readinessClass = computed(() => ({
  observing: 'border-blue-700/60 bg-blue-950/20',
  insufficient_data: 'border-gray-700 bg-gray-800',
}[readinessStatus.value] || 'border-gray-700 bg-gray-800'))
const candidateSetPolicyReview = computed(() => report.value?.candidateSetPolicyReview || null)
const candidateSetPolicyReviewStatus = computed(() =>
  candidateSetPolicyReview.value?.statusId || 'insufficient_data')
const candidateSetPolicyReviewLabel = computed(() => ({
  insufficient_data: 'Candidate-set review needs more applicable decisions',
  candidate_set_supported: 'No material candidate-set gap observed',
  candidate_set_review_recommended: 'Review deterministic candidate-set evidence',
}[candidateSetPolicyReviewStatus.value] || 'Candidate-set review is unavailable'))
const candidateSetPolicyReviewMessage = computed(() => ({
  insufficient_data: 'Continue normal operator review until the applicable attributed-decision cohort reaches the displayed threshold. Do not infer a candidate-set issue yet.',
  candidate_set_supported: 'The current aggregate evidence does not support a material candidate-set gap. This is not a correctness guarantee.',
  candidate_set_review_recommended: 'Review deterministic candidate eligibility, declared library scope, and ranking evidence. This does not prove an AI or retrieval error and does not change routing.',
}[candidateSetPolicyReviewStatus.value] || 'Candidate-set review is currently unavailable.'))
const candidateSetPolicyReviewClass = computed(() => ({
  insufficient_data: 'border-gray-700 bg-gray-800',
  candidate_set_supported: 'border-blue-700/60 bg-blue-950/20',
  candidate_set_review_recommended: 'border-amber-600/70 bg-amber-950/20',
}[candidateSetPolicyReviewStatus.value] || 'border-gray-700 bg-gray-800'))
const monitoringStatusAnnouncement = computed(() => {
  if (loading.value) return 'Loading candidate retrieval metrics.'
  if (errorMessage.value) return 'Candidate retrieval metrics are currently unavailable.'
  if (!report.value) return 'Candidate retrieval metrics are currently unavailable.'

  return `${readinessLabel.value}. ${candidateSetPolicyReviewLabel.value}.`
})
const candidateSetSelectionCount = computed(() => {
  const attribution = report.value?.operatorCandidateSetAttribution
  return (Number(attribution?.confirmedCandidateOutcomeCount) || 0) +
    (Number(attribution?.changedToCandidateOutcomeCount) || 0)
})

function formatRate(count, percentage) {
  return `${Number(count) || 0} (${Number(percentage) || 0}%)`
}

function formatProgress(count, minimum) {
  return `${Number(count) || 0} / ${Number(minimum) || 0}`
}

async function loadMetrics() {
  loading.value = true
  errorMessage.value = ''

  try {
    report.value = await api.getCurrentLibraryCandidateRetrievalMetrics()
  } catch (_error) {
    errorMessage.value = 'Candidate retrieval metrics are currently unavailable.'
  } finally {
    loading.value = false
  }
}

onMounted(loadMetrics)
</script>
