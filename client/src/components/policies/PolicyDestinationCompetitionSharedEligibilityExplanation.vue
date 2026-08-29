<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    v-if="explanation"
    class="space-y-2 rounded border border-amber-800/70 bg-amber-950/20 p-3"
    aria-labelledby="policy-destination-competition-explanation-title"
  >
    <div class="space-y-1">
      <h4
        id="policy-destination-competition-explanation-title"
        class="text-sm font-semibold text-amber-100"
      >
        Why shared eligibility may occur
      </h4>
      <p class="text-sm text-gray-300">
        {{ explanation.guidance?.description || 'No configured explanation is available.' }}
      </p>
    </div>

    <ul
      v-if="categories.length > 0"
      class="space-y-1 text-sm text-gray-200"
    >
      <li
        v-for="category in categories"
        :key="category.categoryId"
      >
        {{ category.label }} appears in the draft and
        {{ category.configuredCompetitorPolicyCount }} anonymous active
        {{ category.configuredCompetitorPolicyCount === 1 ? 'competitor configuration' : 'competitor configurations' }}.
      </li>
    </ul>

    <p class="text-xs text-gray-400">
      Rule values, policy identities, media records, and individual outcomes remain private.
      This is not a routing, ranking, or AI explanation.
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  explanation: {
    type: Object,
    default: null,
  },
})

function asSafeCategory(category) {
  if (!category || typeof category !== 'object') return null

  const categoryId = typeof category.categoryId === 'string' ? category.categoryId : ''
  const label = typeof category.label === 'string' ? category.label : ''
  const configuredCompetitorPolicyCount = Number(category.configuredCompetitorPolicyCount)
  if (!categoryId || !label || !Number.isInteger(configuredCompetitorPolicyCount) || configuredCompetitorPolicyCount < 1) {
    return null
  }

  return {
    categoryId,
    label,
    configuredCompetitorPolicyCount,
  }
}

const categories = computed(() => (
  Array.isArray(props.explanation?.categories)
    ? props.explanation.categories.map(asSafeCategory).filter(Boolean)
    : []
))
</script>
