<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    class="rounded-lg border border-blue-500/30 bg-blue-950/20 p-4"
    aria-labelledby="policy-builder-setup-cards-title"
  >
    <div class="mb-4">
      <p class="text-xs uppercase tracking-wider text-blue-200">
        Policy Setup
      </p>
      <h3
        id="policy-builder-setup-cards-title"
        class="text-lg font-semibold text-white"
      >
        Start from destination meaning
      </h3>
      <p class="mt-1 text-sm text-gray-300">
        Use what already exists, declare what should remain true, and let
        Classifarr ask only when the evidence is not safe enough to automate.
      </p>
    </div>

    <ol class="grid gap-3 md:grid-cols-2">
      <li
        v-for="(card, index) in cards"
        :key="card.stepId"
        class="rounded-lg border bg-gray-900/60 p-4"
        :class="cardStateClasses(card.state?.status)"
      >
        <article :aria-labelledby="`policy-builder-setup-card-${card.stepId}`">
          <div class="mb-3 flex items-start justify-between gap-3">
            <h4
              :id="`policy-builder-setup-card-${card.stepId}`"
              class="text-sm font-semibold text-white"
            >
              {{ index + 1 }}. {{ card.heading }}
            </h4>
            <span
              class="rounded-full border px-2 py-1 text-xs font-medium"
              :class="cardStatusBadgeClasses(card.state?.status)"
            >
              {{ card.state?.statusLabel || `Step ${index + 1}` }}
            </span>
          </div>

          <p class="text-sm text-gray-300">
            {{ card.helperText }}
          </p>

          <div class="mt-3 flex flex-wrap gap-2">
            <span
              v-for="term in card.termLabels"
              :key="term"
              class="rounded-full border border-gray-600 px-2 py-1 text-xs text-gray-200"
            >
              {{ term }}
            </span>
          </div>

          <p
            v-if="card.state?.statusMessage"
            class="mt-3 rounded border px-2 py-1 text-xs"
            :class="cardStatusMessageClasses(card.state?.status)"
          >
            {{ card.state.statusMessage }}
          </p>
          <p
            v-else
            class="mt-3 text-xs text-gray-400"
          >
            {{ card.emptyState }}
          </p>
          <p class="mt-2 text-xs text-gray-400">
            {{ card.completionSignal }}
          </p>

          <a
            class="mt-4 inline-flex rounded-md border border-blue-500 px-3 py-2 text-sm font-medium text-blue-100 hover:bg-blue-500/10 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-900"
            :href="`#${card.targetId}`"
          >
            {{ card.primaryActionLabel }}
          </a>
        </article>
      </li>
    </ol>
  </section>
</template>

<script setup>
import { listPolicyBuilderSetupCards } from '@/utils/policyBuilderSetupCards'

defineProps({
  cards: {
    type: Array,
    default: () => listPolicyBuilderSetupCards(),
  },
})

const cardStateClasses = (status) => {
  if (status === 'complete') return 'border-green-800/70'
  if (status === 'needs_action') return 'border-amber-700/70'
  if (status === 'loading') return 'border-blue-700/70'
  return 'border-gray-700'
}

const cardStatusBadgeClasses = (status) => {
  if (status === 'complete') return 'border-green-700 bg-green-900/30 text-green-200'
  if (status === 'needs_action') return 'border-amber-700 bg-amber-900/30 text-amber-200'
  if (status === 'loading') return 'border-blue-700 bg-blue-900/30 text-blue-200'
  return 'border-gray-600 bg-gray-800 text-gray-300'
}

const cardStatusMessageClasses = (status) => {
  if (status === 'complete') return 'border-green-800/70 bg-green-950/30 text-green-200'
  if (status === 'needs_action') return 'border-amber-700/70 bg-amber-950/30 text-amber-200'
  if (status === 'loading') return 'border-blue-800/70 bg-blue-950/30 text-blue-200'
  return 'border-gray-700 bg-gray-900 text-gray-300'
}
</script>
