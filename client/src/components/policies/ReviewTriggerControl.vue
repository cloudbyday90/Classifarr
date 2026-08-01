<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <fieldset
    v-if="reviewTriggerControl"
    class="space-y-3 rounded-lg border border-blue-800/70 bg-blue-950/20 p-3"
  >
    <legend class="px-1 text-sm font-semibold text-white">
      {{ reviewTriggerControl.label }}
    </legend>
    <p class="text-xs text-gray-300">
      {{ reviewTriggerControl.description }}
    </p>
    <p class="rounded border border-blue-800/70 px-2 py-1 text-[11px] text-blue-100">
      This is a review condition: it asks for review and does not block automatic application.
    </p>

    <label
      class="block text-xs font-medium text-gray-200"
      for="policy-intent-constraint-review_warning-value"
    >
      {{ reviewTriggerControl.valueLabel }}
    </label>
    <select
      id="policy-intent-constraint-review_warning-value"
      :value="draftValue"
      class="w-full rounded-sm border border-gray-700 bg-background px-2 py-1 text-sm text-white"
      :aria-describedby="describedBy"
      @change="setDraftValue($event.target.value)"
    >
      <option value="">
        {{ reviewTriggerControl.valueEmptyLabel }}
      </option>
      <option
        v-for="option in reviewTriggerControl.options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
    <p
      id="policy-intent-constraint-review_warning-description"
      class="text-[11px] text-gray-500"
    >
      Staging this warning creates a local draft only.
    </p>

    <button
      type="button"
      class="rounded-sm border border-cyan-700 px-3 py-1 text-xs text-cyan-100 hover:bg-cyan-950/40 disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="!canStage"
      :aria-label="stageActionLabel"
      @click="stageReviewTrigger"
    >
      {{ reviewTriggerControl.actionLabel }}
    </button>

    <ul
      v-if="reviewTriggerControl.stagedValues.length"
      class="space-y-1 border-t border-gray-700 pt-2 text-xs text-gray-300"
      aria-label="Staged review warning values"
    >
      <li
        v-for="value in reviewTriggerControl.stagedValues"
        :key="`review_warning:${value}`"
      >
        Staged: {{ value }}
      </li>
    </ul>
  </fieldset>
</template>

<script setup>
import { computed } from 'vue'
import { usePolicyIntentConstraintControl } from '@/composables/usePolicyIntentConstraintControl'

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
  statusId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits({
  'draft-command-plan': plan => Boolean(plan?.commands?.length),
})

const {
  control,
  draftValue,
  canStage,
  stageActionLabel,
  setDraftValue,
  reset,
  buildCommandPlan,
} = usePolicyIntentConstraintControl({
  controlId: 'review_warning',
  constraintProps: props,
})

const reviewTriggerControl = computed(() => (
  control.value?.canBlockAutomaticApplication === false &&
  control.value.requiresExplicitOperatorAction === false
    ? control.value
    : null
))
const describedBy = computed(() => [
  'policy-intent-constraint-review_warning-description',
  typeof props.statusId === 'string' ? props.statusId.trim() : '',
].filter(Boolean).join(' '))

function stageReviewTrigger() {
  if (!reviewTriggerControl.value || !canStage.value) return

  const plan = buildCommandPlan()
  if (!plan) return

  emit('draft-command-plan', plan)
  reset()
}
</script>
