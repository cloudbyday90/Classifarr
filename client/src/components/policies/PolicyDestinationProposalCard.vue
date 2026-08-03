<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <article
    class="mt-5 rounded-lg border border-green-700/70 bg-gray-950/30 p-5"
    aria-labelledby="policy-destination-proposal-heading"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-green-200">
          Server-prepared destination
        </p>
        <h3
          id="policy-destination-proposal-heading"
          class="mt-1 text-lg font-semibold text-white"
        >
          {{ proposal.title }}
        </h3>
      </div>
      <span class="rounded-full border border-amber-600/70 bg-amber-950/40 px-3 py-1 text-xs font-semibold text-amber-100">
        Proposed, not saved
      </span>
    </div>

    <section class="mt-5 rounded border border-gray-700 bg-gray-900/40 p-4">
      <h4 class="text-sm font-semibold text-white">
        Observed library context
      </h4>
      <p class="mt-1 text-sm leading-6 text-gray-300">
        {{ proposal.observedContext.summary }}
      </p>
      <p
        v-if="proposal.observedContext.available && proposal.observedContext.current"
        class="mt-2 text-sm text-gray-200"
      >
        <template v-if="proposal.observedContext.itemCount !== null">
          {{ proposal.observedContext.itemCount }} items currently observed.
        </template>
        <template v-if="proposal.observedContext.suggestionCount !== null">
          {{ proposal.observedContext.suggestionCount }} current destination signals support this proposal.
        </template>
      </p>
    </section>

    <section class="mt-5">
      <h4 class="text-sm font-semibold text-white">
        Proposed purpose
      </h4>
      <p class="mt-1 text-sm text-gray-400">
        This is the policy intent Classifarr will save only after the server checks this proposal again.
      </p>
      <ul
        v-if="proposal.purpose.length > 0"
        class="mt-3 space-y-2"
      >
        <li
          v-for="(rule, index) in proposal.purpose"
          :key="`${rule.signalType}-${rule.operator}-${index}`"
          class="rounded border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-100"
        >
          {{ formatRule(rule) }}
        </li>
      </ul>
      <p
        v-else
        class="mt-3 text-sm text-gray-300"
      >
        No purpose signals are available in this safe proposal.
      </p>
    </section>

    <section class="mt-5 grid gap-3 sm:grid-cols-3">
      <div class="rounded border border-gray-700 bg-gray-900/40 p-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Helpful matches
        </p>
        <p class="mt-1 text-sm text-white">
          {{ proposal.helpfulHints.length }} proposed
        </p>
      </div>
      <div class="rounded border border-gray-700 bg-gray-900/40 p-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Hard limits
        </p>
        <p class="mt-1 text-sm text-white">
          {{ proposal.hardLimitCount }} proposed
        </p>
      </div>
      <div class="rounded border border-gray-700 bg-gray-900/40 p-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Avoid rules
        </p>
        <p class="mt-1 text-sm text-white">
          {{ proposal.avoidCount }} proposed
        </p>
      </div>
    </section>

    <div
      v-if="feedback"
      class="mt-5 rounded border px-4 py-3 text-sm"
      :class="feedbackClass"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ feedback.message }}
    </div>

    <div class="mt-5 flex flex-wrap items-center gap-3">
      <button
        v-if="!completedPolicy"
        type="button"
        class="rounded bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-950 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="loading"
        :aria-busy="loading"
        aria-describedby="policy-destination-proposal-action-help"
        @click="$emit('admit')"
      >
        {{ loading ? 'Creating policy...' : 'Create policy' }}
      </button>
      <p
        v-else
        class="text-sm font-medium text-green-200"
      >
        Policy created: {{ completedPolicy.name }}
      </p>
      <p
        id="policy-destination-proposal-action-help"
        class="text-sm text-gray-400"
      >
        {{ loading
          ? 'Classifarr is creating this policy. Wait for the server result before trying again.'
          : 'Creating a policy does not expose or change the observed library values in this card.' }}
      </p>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import {
  POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS,
} from '@/utils/policyAuthoringActionFeedback'

const props = defineProps({
  proposal: {
    type: Object,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  feedback: {
    type: Object,
    default: null,
  },
  completedPolicy: {
    type: Object,
    default: null,
  },
})

defineEmits(['admit'])

const feedbackClass = computed(() => {
  switch (props.feedback?.statusId) {
    case POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.SUCCEEDED:
      return 'border-green-700/70 bg-green-950/40 text-green-100'
    case POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.PENDING:
      return 'border-primary/70 bg-primary/10 text-primary-100'
    case POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.REJECTED:
    case POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.UNAVAILABLE:
    case POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.STALE:
      return 'border-amber-600/70 bg-amber-950/40 text-amber-100'
    default:
      return 'border-red-700/70 bg-red-950/40 text-red-100'
  }
})

function formatRule(rule) {
  const values = rule.values.join(', ')
  return values ? `${rule.signalType} ${rule.operator}: ${values}` : `${rule.signalType} ${rule.operator}`
}
</script>
