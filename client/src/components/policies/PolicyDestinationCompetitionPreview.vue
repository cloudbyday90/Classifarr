<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    id="policy-destination-competition-preview"
    class="space-y-3 rounded-md border border-sky-800/70 bg-sky-950/20 p-4"
    aria-labelledby="policy-destination-competition-preview-title"
  >
    <div class="space-y-1">
      <h3
        id="policy-destination-competition-preview-title"
        class="text-sm font-semibold text-sky-100"
      >
        Preview destination competition
      </h3>
      <p class="text-sm text-gray-300">
        Compare this unsaved draft with anonymous active destinations for the same media type.
        Results are aggregate eligibility counts only: no destination names, AI calls, saving, or routing.
      </p>
    </div>

    <button
      type="button"
      class="btn btn-secondary"
      :disabled="!available || loading"
      @click="emit('preview')"
    >
      {{ loading ? 'Comparing destinations...' : 'Preview destination competition' }}
    </button>

    <p
      v-if="!available"
      class="text-sm text-gray-400"
    >
      Save this policy once before previewing destination competition.
    </p>

    <p
      v-if="error"
      class="text-sm text-red-300"
      role="alert"
    >
      {{ error }}
    </p>

    <div
      v-if="preview"
      class="space-y-3 rounded border border-sky-700/70 bg-gray-950/40 p-3"
      role="status"
    >
      <div>
        <p class="text-sm font-semibold text-white">
          {{ preview.guidance?.title || 'Destination comparison complete' }}
        </p>
        <p class="mt-1 text-sm text-gray-300">
          {{ preview.guidance?.description }}
        </p>
      </div>

      <dl class="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-gray-400">
            Historic items evaluated
          </dt>
          <dd class="font-medium text-white">
            {{ sample.evaluatedItemCount }}
            <span class="font-normal text-gray-400">
              of {{ sample.maximumItems }} maximum
            </span>
          </dd>
        </div>
        <div>
          <dt class="text-gray-400">
            Active destinations considered
          </dt>
          <dd class="font-medium text-white">
            {{ competitors.activePolicyCount }}
            <span class="font-normal text-gray-400">
              of {{ competitors.maximumPolicyCount }} maximum
            </span>
          </dd>
        </div>
        <div>
          <dt class="text-gray-400">
            Proposed eligible
          </dt>
          <dd class="font-medium text-white">
            {{ proposed.eligibleItemCount }}
          </dd>
        </div>
        <div>
          <dt class="text-gray-400">
            Proposed only eligible
          </dt>
          <dd class="font-medium text-emerald-200">
            {{ competition.proposedUncontestedEligibleItemCount }}
          </dd>
        </div>
        <div>
          <dt class="text-gray-400">
            Shared eligible
          </dt>
          <dd class="font-medium text-amber-200">
            {{ competition.proposedSharedEligibleItemCount }}
          </dd>
        </div>
        <div>
          <dt class="text-gray-400">
            Competitor only eligible
          </dt>
          <dd class="font-medium text-gray-100">
            {{ competition.competitorOnlyEligibleItemCount }}
          </dd>
        </div>
      </dl>

      <p
        v-if="competitors.policyLimitReached"
        class="text-xs text-amber-200"
      >
        The active-destination cap was reached, so additional destinations may not be represented.
      </p>

      <PolicyDestinationCompetitionSharedEligibilityExplanation
        :explanation="preview.sharedEligibilityExplanation"
      />

      <p class="text-xs text-gray-400">
        Shared eligibility is not a policy ranking, AI result, or final routing decision.
        Historic records and destination identities remain on the server.
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import PolicyDestinationCompetitionSharedEligibilityExplanation from '@/components/policies/PolicyDestinationCompetitionSharedEligibilityExplanation.vue'

const props = defineProps({
  preview: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  available: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits({
  preview: () => true,
})

function nonNegativeCount(value) {
  const count = Number(value)
  return Number.isFinite(count) && count >= 0 ? count : 0
}

const sample = computed(() => ({
  evaluatedItemCount: nonNegativeCount(props.preview?.sample?.evaluatedItemCount),
  maximumItems: nonNegativeCount(props.preview?.sample?.maximumItems),
}))

const competitors = computed(() => ({
  activePolicyCount: nonNegativeCount(props.preview?.competitors?.activePolicyCount),
  maximumPolicyCount: nonNegativeCount(props.preview?.competitors?.maximumPolicyCount),
  policyLimitReached: props.preview?.competitors?.policyLimitReached === true,
}))

const proposed = computed(() => ({
  eligibleItemCount: nonNegativeCount(props.preview?.proposed?.eligibleItemCount),
}))

const competition = computed(() => ({
  proposedUncontestedEligibleItemCount: nonNegativeCount(
    props.preview?.competition?.proposedUncontestedEligibleItemCount,
  ),
  proposedSharedEligibleItemCount: nonNegativeCount(
    props.preview?.competition?.proposedSharedEligibleItemCount,
  ),
  competitorOnlyEligibleItemCount: nonNegativeCount(
    props.preview?.competition?.competitorOnlyEligibleItemCount,
  ),
}))
</script>
