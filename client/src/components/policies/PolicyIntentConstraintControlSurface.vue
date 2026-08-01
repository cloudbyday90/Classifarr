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
        <fieldset
          v-for="control in primaryControls"
          :key="control.controlId"
          class="space-y-3 rounded-lg border p-3"
          :class="control.canBlockAutomaticApplication ? 'border-amber-700/70 bg-amber-950/20' : 'border-blue-800/70 bg-blue-950/20'"
        >
          <legend class="px-1 text-sm font-semibold text-white">
            {{ control.label }}
          </legend>
          <p class="text-xs text-gray-300">
            {{ control.description }}
          </p>
          <p
            class="rounded border px-2 py-1 text-[11px]"
            :class="control.canBlockAutomaticApplication ? 'border-amber-700/70 text-amber-100' : 'border-blue-800/70 text-blue-100'"
          >
            {{ control.canBlockAutomaticApplication
              ? 'This is a blocker: it can prevent automatic application.'
              : 'This is advisory: it does not become a hard block by default.' }}
          </p>

          <label
            class="block text-xs font-medium text-gray-200"
            :for="valueInputId(control.controlId)"
          >
            {{ control.valueLabel }}
          </label>
          <select
            :id="valueInputId(control.controlId)"
            :value="draftValues[control.controlId] || ''"
            class="w-full rounded-sm border border-gray-700 bg-background px-2 py-1 text-sm text-white"
            :aria-describedby="`${controlDescriptionId(control.controlId)} policy-intent-constraint-controls-status`"
            @change="setDraftValue(control.controlId, $event.target.value)"
          >
            <option value="">
              {{ control.valueEmptyLabel }}
            </option>
            <option
              v-for="option in control.options"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <p
            :id="controlDescriptionId(control.controlId)"
            class="text-[11px] text-gray-500"
          >
            {{ control.requiresExplicitOperatorAction
              ? 'Confirm the value below before staging it.'
              : 'Staging this warning creates a local draft only.' }}
          </p>

          <label
            v-if="control.requiresExplicitOperatorAction"
            class="flex cursor-pointer items-start gap-2 rounded border border-gray-700 bg-background px-2 py-2 text-xs text-gray-200"
            :for="confirmationInputId(control.controlId)"
          >
            <input
              :id="confirmationInputId(control.controlId)"
              v-model="confirmations[control.controlId]"
              type="checkbox"
              class="mt-0.5"
            >
            <span>{{ control.confirmationLabel }}</span>
          </label>

          <button
            type="button"
            class="rounded-sm border px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            :class="control.canBlockAutomaticApplication
              ? 'border-amber-600 text-amber-100 hover:bg-amber-950/40'
              : 'border-cyan-700 text-cyan-100 hover:bg-cyan-950/40'"
            :disabled="!canStage(control)"
            :aria-label="stageActionLabel(control)"
            @click="stageControl(control)"
          >
            {{ control.actionLabel }}
          </button>

          <ul
            v-if="control.stagedValues.length"
            class="space-y-1 border-t border-gray-700 pt-2 text-xs text-gray-300"
            :aria-label="`Staged ${control.label.toLowerCase()} values`"
          >
            <li
              v-for="value in control.stagedValues"
              :key="`${control.controlId}:${value}`"
            >
              Staged: {{ value }}
            </li>
          </ul>
        </fieldset>
      </div>

      <fieldset
        v-for="control in reviewControls"
        :key="control.controlId"
        class="space-y-3 rounded-lg border border-blue-800/70 bg-blue-950/20 p-3"
      >
        <legend class="px-1 text-sm font-semibold text-white">
          {{ control.label }}
        </legend>
        <p class="text-xs text-gray-300">
          {{ control.description }}
        </p>

        <label
          class="block text-xs font-medium text-gray-200"
          :for="valueInputId(control.controlId)"
        >
          {{ control.valueLabel }}
        </label>
        <select
          :id="valueInputId(control.controlId)"
          :value="draftValues[control.controlId] || ''"
          class="w-full rounded-sm border border-gray-700 bg-background px-2 py-1 text-sm text-white"
          :aria-describedby="`${controlDescriptionId(control.controlId)} policy-intent-constraint-controls-status`"
          @change="setDraftValue(control.controlId, $event.target.value)"
        >
          <option value="">
            {{ control.valueEmptyLabel }}
          </option>
          <option
            v-for="option in control.options"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
        <p
          :id="controlDescriptionId(control.controlId)"
          class="text-[11px] text-gray-500"
        >
          Staging this warning creates a local draft only.
        </p>

        <button
          type="button"
          class="rounded-sm border border-cyan-700 px-3 py-1 text-xs text-cyan-100 hover:bg-cyan-950/40 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!canStage(control)"
          :aria-label="stageActionLabel(control)"
          @click="stageControl(control)"
        >
          {{ control.actionLabel }}
        </button>

        <ul
          v-if="control.stagedValues.length"
          class="space-y-1 border-t border-gray-700 pt-2 text-xs text-gray-300"
          :aria-label="`Staged ${control.label.toLowerCase()} values`"
        >
          <li
            v-for="value in control.stagedValues"
            :key="`${control.controlId}:${value}`"
          >
            Staged: {{ value }}
          </li>
        </ul>
      </fieldset>

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
import { computed, reactive } from 'vue'
import HardLimitControl from './HardLimitControl.vue'
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
})

const emit = defineEmits({
  'draft-command-plan': plan => Boolean(plan?.commands?.length),
  'clear-constraint-draft': () => true,
})

const draftValues = reactive({})
const confirmations = reactive({})

const surface = computed(() => buildPolicyIntentConstraintControlSurface({
  constraintDecisionModel: props.constraintDecisionModel,
  constraintValueEligibility: props.constraintValueEligibility,
  constraintDraftCommands: props.constraintDraftCommands,
}))

const primaryControls = computed(() => surface.value.controls.filter(control => (
  control.controlId !== 'hard_limit' && control.controlId !== 'review_warning'
)))
const reviewControls = computed(() => surface.value.controls.filter(control => (
  control.controlId === 'review_warning'
)))

const valueInputId = controlId => `policy-intent-constraint-${controlId}-value`
const confirmationInputId = controlId => `policy-intent-constraint-${controlId}-confirmation`
const controlDescriptionId = controlId => `policy-intent-constraint-${controlId}-description`

function setDraftValue(controlId, value) {
  if (draftValues[controlId] === value) return

  draftValues[controlId] = value
  confirmations[controlId] = false
}

function canStage(control) {
  const value = typeof draftValues[control.controlId] === 'string'
    ? draftValues[control.controlId].trim()
    : ''

  return Boolean(value) && (
    !control.requiresExplicitOperatorAction || confirmations[control.controlId] === true
  )
}

function stageActionLabel(control) {
  if (!draftValues[control.controlId]?.trim()) {
    return `${control.actionLabel}: choose an approved value first.`
  }

  if (control.requiresExplicitOperatorAction && confirmations[control.controlId] !== true) {
    return `${control.actionLabel}: confirm this explicit operator choice first.`
  }

  return control.actionLabel
}

function stageControl(control) {
  if (!canStage(control)) return

  const plan = buildPolicyIntentConstraintCommandPlan({
    constraintDecisionModel: props.constraintDecisionModel,
    constraintValueEligibility: props.constraintValueEligibility,
    selection: {
      controlId: control.controlId,
      value: draftValues[control.controlId],
      explicitOperatorAction: true,
    },
  })
  if (!plan) return

  emit('draft-command-plan', plan)
  draftValues[control.controlId] = ''
  confirmations[control.controlId] = false
}
</script>
