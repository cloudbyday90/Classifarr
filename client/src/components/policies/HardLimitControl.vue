<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <fieldset
    v-if="hardLimitControl"
    class="space-y-3 rounded-lg border border-amber-700/70 bg-amber-950/20 p-3"
  >
    <legend class="px-1 text-sm font-semibold text-white">
      {{ hardLimitControl.label }}
    </legend>
    <p class="text-xs text-gray-300">
      {{ hardLimitControl.description }}
    </p>
    <p class="rounded border border-amber-700/70 px-2 py-1 text-[11px] text-amber-100">
      This is a blocker: it can prevent automatic application.
    </p>

    <label
      class="block text-xs font-medium text-gray-200"
      for="policy-intent-constraint-hard_limit-value"
    >
      {{ hardLimitControl.valueLabel }}
    </label>
    <select
      id="policy-intent-constraint-hard_limit-value"
      :value="draftValue"
      class="w-full rounded-sm border border-gray-700 bg-background px-2 py-1 text-sm text-white"
      :aria-describedby="describedBy"
      @change="setDraftValue($event.target.value)"
    >
      <option value="">
        {{ hardLimitControl.valueEmptyLabel }}
      </option>
      <option
        v-for="option in hardLimitControl.options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
    <p
      id="policy-intent-constraint-hard_limit-description"
      class="text-[11px] text-gray-500"
    >
      Confirm the value below before staging it.
    </p>

    <label
      class="flex cursor-pointer items-start gap-2 rounded border border-gray-700 bg-background px-2 py-2 text-xs text-gray-200"
      for="policy-intent-constraint-hard_limit-confirmation"
    >
      <input
        id="policy-intent-constraint-hard_limit-confirmation"
        v-model="confirmed"
        type="checkbox"
        class="mt-0.5"
      >
      <span>{{ hardLimitControl.confirmationLabel }}</span>
    </label>

    <button
      type="button"
      class="rounded-sm border border-amber-600 px-3 py-1 text-xs text-amber-100 hover:bg-amber-950/40 disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="!canStage"
      :aria-label="stageActionLabel"
      @click="stageHardLimit"
    >
      {{ hardLimitControl.actionLabel }}
    </button>

    <ul
      v-if="hardLimitControl.stagedValues.length"
      class="space-y-1 border-t border-gray-700 pt-2 text-xs text-gray-300"
      aria-label="Staged hard limit values"
    >
      <li
        v-for="value in hardLimitControl.stagedValues"
        :key="`hard_limit:${value}`"
      >
        Staged: {{ value }}
      </li>
    </ul>
  </fieldset>
</template>

<script setup>
import { computed, ref } from 'vue'
import { buildPolicyIntentConstraintCommandPlan } from '@/utils/policyIntentConstraintDraft'
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
  statusId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits({
  'draft-command-plan': plan => Boolean(plan?.commands?.length),
})

const draftValue = ref('')
const confirmed = ref(false)

const hardLimitControl = computed(() => {
  const surface = buildPolicyIntentConstraintControlSurface({
    constraintDecisionModel: props.constraintDecisionModel,
    constraintValueEligibility: props.constraintValueEligibility,
    constraintDraftCommands: props.constraintDraftCommands,
  })

  const control = surface.available
    ? surface.controls.find(candidate => candidate.controlId === 'hard_limit')
    : null

  return control?.canBlockAutomaticApplication === true &&
    control.requiresExplicitOperatorAction === true
    ? control
    : null
})

const canStage = computed(() => Boolean(draftValue.value.trim()) && confirmed.value === true)
const describedBy = computed(() => [
  'policy-intent-constraint-hard_limit-description',
  typeof props.statusId === 'string' ? props.statusId.trim() : '',
].filter(Boolean).join(' '))
const stageActionLabel = computed(() => {
  const actionLabel = hardLimitControl.value?.actionLabel || 'Stage hard limit'

  if (!draftValue.value.trim()) {
    return `${actionLabel}: choose an approved value first.`
  }

  if (confirmed.value !== true) {
    return `${actionLabel}: confirm this explicit operator choice first.`
  }

  return actionLabel
})

function setDraftValue(value) {
  if (draftValue.value === value) return

  draftValue.value = value
  confirmed.value = false
}

function stageHardLimit() {
  if (!hardLimitControl.value || !canStage.value) return

  const plan = buildPolicyIntentConstraintCommandPlan({
    constraintDecisionModel: props.constraintDecisionModel,
    constraintValueEligibility: props.constraintValueEligibility,
    selection: {
      controlId: hardLimitControl.value.controlId,
      value: draftValue.value,
      explicitOperatorAction: true,
    },
  })
  if (!plan?.commands?.length) return

  emit('draft-command-plan', plan)
  draftValue.value = ''
  confirmed.value = false
}
</script>
