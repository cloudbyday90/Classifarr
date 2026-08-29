<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    id="policy-cohort-simulation"
    class="space-y-3 rounded-md border border-violet-800/70 bg-violet-950/20 p-4"
    aria-labelledby="policy-cohort-simulation-title"
  >
    <div class="space-y-1">
      <h3
        id="policy-cohort-simulation-title"
        class="text-sm font-semibold text-violet-100"
      >
        Preview recent cohort impact
      </h3>
      <p class="text-sm text-gray-300">
        Compare the saved policy with this unsaved draft against a bounded recent deterministic cohort.
        Results are aggregate eligibility counts only: no titles, AI calls, saving, or routing.
      </p>
    </div>

    <button
      type="button"
      class="btn btn-secondary"
      :disabled="!available || loading"
      @click="emit('simulate')"
    >
      {{ loading ? 'Simulating cohort...' : 'Preview cohort impact' }}
    </button>

    <p
      v-if="!available"
      class="text-sm text-gray-400"
    >
      Save this policy once before previewing a proposed draft.
    </p>

    <p
      v-if="error"
      class="text-sm text-red-300"
      role="alert"
    >
      {{ error }}
    </p>

    <div
      v-if="simulation"
      class="space-y-3 rounded border border-violet-700/70 bg-gray-950/40 p-3"
      role="status"
    >
      <div>
        <p class="text-sm font-semibold text-white">
          {{ simulation.guidance?.title || 'Cohort preview complete' }}
        </p>
        <p class="mt-1 text-sm text-gray-300">
          {{ simulation.guidance?.description }}
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
            Lookback window
          </dt>
          <dd class="font-medium text-white">
            {{ sample.windowDays }} days
          </dd>
        </div>
        <div>
          <dt class="text-gray-400">
            Currently eligible
          </dt>
          <dd class="font-medium text-white">
            {{ comparison.baseline.eligible }}
          </dd>
        </div>
        <div>
          <dt class="text-gray-400">
            Proposed eligible
          </dt>
          <dd class="font-medium text-white">
            {{ comparison.proposed.eligible }}
          </dd>
        </div>
        <div>
          <dt class="text-gray-400">
            Newly eligible
          </dt>
          <dd class="font-medium text-emerald-200">
            {{ comparison.transitions.newlyEligible }}
          </dd>
        </div>
        <div>
          <dt class="text-gray-400">
            No longer eligible
          </dt>
          <dd class="font-medium text-amber-200">
            {{ comparison.transitions.noLongerEligible }}
          </dd>
        </div>
      </dl>

      <p class="text-xs text-gray-400">
        Eligibility is one deterministic policy stage, not an AI prediction or final routing decision.
        The historic records and draft remain on the server.
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  simulation: {
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
  simulate: () => true,
})

function nonNegativeCount(value) {
  const count = Number(value)
  return Number.isFinite(count) && count >= 0 ? count : 0
}

const sample = computed(() => ({
  evaluatedItemCount: nonNegativeCount(props.simulation?.sample?.evaluatedItemCount),
  maximumItems: nonNegativeCount(props.simulation?.sample?.maximumItems),
  windowDays: nonNegativeCount(props.simulation?.sample?.windowDays),
}))

const comparison = computed(() => ({
  baseline: {
    eligible: nonNegativeCount(props.simulation?.comparison?.baseline?.eligible),
  },
  proposed: {
    eligible: nonNegativeCount(props.simulation?.comparison?.proposed?.eligible),
  },
  transitions: {
    newlyEligible: nonNegativeCount(props.simulation?.comparison?.transitions?.newlyEligible),
    noLongerEligible: nonNegativeCount(props.simulation?.comparison?.transitions?.noLongerEligible),
  },
}))
</script>
