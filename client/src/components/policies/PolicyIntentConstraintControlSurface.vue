<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="space-y-4 rounded-lg border border-gray-700 bg-background-light p-3"
    aria-labelledby="policy-intent-constraint-controls-title"
  >
    <div>
      <h5
        id="policy-intent-constraint-controls-title"
        class="text-sm font-semibold text-white"
      >
        Optional destination boundaries
      </h5>
      <p class="mt-1 text-xs text-gray-400">
        Add an explicit boundary only when you want Classifarr to enforce, down-rank, or review a condition.
      </p>
    </div>

    <p
      v-if="!surface.available"
      class="rounded border border-amber-700/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-100"
      role="alert"
    >
      {{ surface.message }}
    </p>

    <template v-else>
      <p
        id="policy-intent-constraint-controls-status"
        class="rounded border border-blue-800/70 bg-blue-950/30 px-3 py-2 text-xs text-blue-100"
        role="status"
        aria-live="polite"
      >
        {{ surface.message }}
      </p>

      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <HardLimitControl
          :constraint-decision-model="constraintDecisionModel"
          :constraint-value-eligibility="constraintValueEligibility"
          :constraint-draft-commands="constraintDraftCommands"
          status-id="policy-intent-constraint-controls-status"
          @draft-command-plan="emit('draft-command-plan', $event)"
        />
        <AvoidControl
          :constraint-decision-model="constraintDecisionModel"
          :constraint-value-eligibility="constraintValueEligibility"
          :constraint-draft-commands="constraintDraftCommands"
          status-id="policy-intent-constraint-controls-status"
          @draft-command-plan="emit('draft-command-plan', $event)"
        />
        <ReviewTriggerControl
          :constraint-decision-model="constraintDecisionModel"
          :constraint-value-eligibility="constraintValueEligibility"
          :constraint-draft-commands="constraintDraftCommands"
          status-id="policy-intent-constraint-controls-status"
          @draft-command-plan="emit('draft-command-plan', $event)"
        />
      </div>

      <div
        v-if="surface.stagedCommandCount > 0"
        class="flex flex-col gap-2 rounded border border-gray-700 bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="text-xs text-gray-300">
          {{ surface.stagedCommandCount }} local {{ surface.stagedCommandCount === 1 ? 'constraint is' : 'constraints are' }} staged and not saved.
        </p>
        <button
          type="button"
          class="self-start rounded-sm border border-gray-600 px-3 py-1 text-xs text-gray-200 hover:bg-gray-800 sm:self-auto"
          @click="emit('clear-constraint-draft')"
        >
          Clear staged constraints
        </button>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import AvoidControl from './AvoidControl.vue'
import HardLimitControl from './HardLimitControl.vue'
import ReviewTriggerControl from './ReviewTriggerControl.vue'
import { buildPolicyIntentConstraintControlSurface } from '@/utils/policyIntentConstraintControlSurface'

const props = defineProps({
  constraintDecisionModel: {
    type: Object,
    default: null,
  },
  constraintValueEligibility: {
    type: Object,
    default: null,
  },
  constraintDraftCommands: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits({
  'draft-command-plan': plan => Boolean(plan?.commands?.length),
  'clear-constraint-draft': () => true,
})

const surface = computed(() => buildPolicyIntentConstraintControlSurface({
  constraintDecisionModel: props.constraintDecisionModel,
  constraintValueEligibility: props.constraintValueEligibility,
  constraintDraftCommands: props.constraintDraftCommands,
}))
</script>
