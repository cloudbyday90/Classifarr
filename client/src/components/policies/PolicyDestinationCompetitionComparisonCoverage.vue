<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    v-if="coverage"
    class="space-y-2 rounded border p-3"
    :class="coverage.additionalActiveCompetitorsExcluded
      ? 'border-amber-800/70 bg-amber-950/20'
      : 'border-emerald-800/70 bg-emerald-950/20'"
    aria-labelledby="policy-destination-competition-coverage-title"
  >
    <div class="space-y-1">
      <h4
        id="policy-destination-competition-coverage-title"
        class="text-sm font-semibold"
        :class="coverage.additionalActiveCompetitorsExcluded ? 'text-amber-100' : 'text-emerald-100'"
      >
        {{ coverage.additionalActiveCompetitorsExcluded
          ? 'Comparison coverage is capped'
          : 'Comparison coverage is complete' }}
      </h4>
      <p class="text-sm text-gray-300">
        {{ coverage.additionalActiveCompetitorsExcluded
          ? 'One or more additional active same-media-type destinations were excluded by the fixed comparison cap. Do not treat absence of shared eligibility as a complete destination-safety conclusion.'
          : 'Every active same-media-type destination fit within the fixed comparison cap. This remains a bounded historic preview, not a routing guarantee.' }}
      </p>
    </div>

    <p class="text-xs text-gray-400">
      {{ coverage.comparedActiveCompetitorPolicyCount }} active
      {{ coverage.comparedActiveCompetitorPolicyCount === 1 ? 'destination was' : 'destinations were' }} compared,
      with a cap of {{ coverage.maximumCompetitorPolicyCount }}. Exact totals, identities,
      configurations, and the server-only cap check remain private.
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  coverage: {
    type: Object,
    default: null,
  },
})

function asNonNegativeInteger(value) {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : null
}

function asSafeCoverage(value) {
  if (!value || typeof value !== 'object') return null

  const comparedActiveCompetitorPolicyCount = asNonNegativeInteger(
    value.comparedActiveCompetitorPolicyCount,
  )
  const maximumCompetitorPolicyCount = asNonNegativeInteger(value.maximumCompetitorPolicyCount)
  if (
    comparedActiveCompetitorPolicyCount === null ||
    maximumCompetitorPolicyCount === null ||
    comparedActiveCompetitorPolicyCount > maximumCompetitorPolicyCount ||
    typeof value.additionalActiveCompetitorsExcluded !== 'boolean'
  ) {
    return null
  }

  return {
    comparedActiveCompetitorPolicyCount,
    maximumCompetitorPolicyCount,
    additionalActiveCompetitorsExcluded: value.additionalActiveCompetitorsExcluded,
  }
}

const coverage = computed(() => asSafeCoverage(props.coverage))
</script>
