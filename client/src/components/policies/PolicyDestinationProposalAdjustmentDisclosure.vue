<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    v-if="hasAdjustableOptions"
    class="mt-5 rounded border border-gray-700 bg-gray-900/40 p-4"
    :aria-labelledby="disclosureHeadingId"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h4
          :id="disclosureHeadingId"
          class="text-sm font-semibold text-white"
        >
          Fine-tune this proposal
        </h4>
        <p
          :id="disclosureDescriptionId"
          class="mt-1 text-sm text-gray-400"
        >
          Optional. The proposed library meaning is used unless you narrow eligible values.
        </p>
      </div>
      <button
        type="button"
        class="rounded border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-100 hover:border-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-950"
        :aria-expanded="expanded"
        :aria-controls="expanded ? disclosureContentId : undefined"
        :aria-describedby="disclosureDescriptionId"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Hide adjustments' : 'Adjust this policy' }}
      </button>
    </div>

    <div
      v-if="expanded"
      :id="disclosureContentId"
      class="mt-4 space-y-5 border-t border-gray-700 pt-4"
    >
      <fieldset v-if="hasAdjustablePurposeGenres">
        <legend class="text-sm font-semibold text-white">
          Keep these proposed genres
        </legend>
        <p class="mt-1 text-sm leading-6 text-gray-300">
          Proposed from the current library profile. At least one genre is required.
        </p>
        <div class="mt-3 space-y-2">
          <label
            v-for="option in purposeGenreOptions"
            :key="option.value"
            class="flex items-start gap-3 rounded border border-gray-700 px-3 py-2 text-sm text-gray-100"
          >
            <input
              v-model="selectedPurposeGenreValues"
              type="checkbox"
              :value="option.value"
              :disabled="isLastSelectedOption(option.value, selectedPurposeGenreValues)"
              class="mt-1 h-4 w-4 rounded border-gray-500 bg-gray-950 text-primary focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
            <span>
              <span class="font-medium">{{ option.value }}</span>
              <span class="ml-2 text-xs text-gray-400">Current library profile</span>
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset v-if="hasAdjustableHelpfulStudios">
        <legend class="text-sm font-semibold text-white">
          Keep these helpful studios
        </legend>
        <p class="mt-1 text-sm leading-6 text-gray-300">
          Proposed from the current library profile. At least one studio is required. These are
          helpful preferences, not destination identity.
        </p>
        <div class="mt-3 space-y-2">
          <label
            v-for="option in helpfulStudioOptions"
            :key="option.value"
            class="flex items-start gap-3 rounded border border-gray-700 px-3 py-2 text-sm text-gray-100"
          >
            <input
              v-model="selectedHelpfulStudioValues"
              type="checkbox"
              :value="option.value"
              :disabled="isLastSelectedOption(option.value, selectedHelpfulStudioValues)"
              class="mt-1 h-4 w-4 rounded border-gray-500 bg-gray-950 text-primary focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
            <span>
              <span class="font-medium">{{ option.value }}</span>
              <span class="ml-2 text-xs text-gray-400">Current library profile</span>
            </span>
          </label>
        </div>
      </fieldset>

      <p class="text-sm leading-6 text-gray-300">
        Custom values, templates, limits, review behavior, and routing are unchanged.
      </p>
      <button
        type="button"
        class="rounded border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-100 hover:border-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-950 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="selectionMatchesProposal"
        @click="restoreProposalValues"
      >
        Restore proposed values
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, useId, watch } from 'vue'
import {
  POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS,
  buildPolicyAuthoringProposalAdjustmentCommands,
  normalizePolicyAuthoringProposalAdjustmentCommands,
  normalizePolicyAuthoringProposalHelpfulStudioOptions,
  normalizePolicyAuthoringProposalPurposeGenreOptions,
} from '@/utils/policyAuthoringProposalAdjustment'

const props = defineProps({
  genreOptions: {
    type: Array,
    default: () => [],
  },
  helpfulStudioOptions: {
    type: Array,
    default: () => [],
  },
  adjustmentCommands: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:adjustment-commands'])
const disclosureInstanceId = useId()
const disclosureHeadingId = `policy-destination-adjustment-heading-${disclosureInstanceId}`
const disclosureDescriptionId = `policy-destination-adjustment-description-${disclosureInstanceId}`
const disclosureContentId = `policy-destination-adjustment-content-${disclosureInstanceId}`
const expanded = ref(false)
const selectedPurposeGenreValues = ref([])
const selectedHelpfulStudioValues = ref([])
const purposeGenreOptions = computed(() => normalizePolicyAuthoringProposalPurposeGenreOptions(props.genreOptions))
const helpfulStudioOptions = computed(() => normalizePolicyAuthoringProposalHelpfulStudioOptions(props.helpfulStudioOptions))
const proposedPurposeGenreValues = computed(() => purposeGenreOptions.value.map(option => option.value))
const proposedHelpfulStudioValues = computed(() => helpfulStudioOptions.value.map(option => option.value))
const hasAdjustablePurposeGenres = computed(() => purposeGenreOptions.value.length > 1)
const hasAdjustableHelpfulStudios = computed(() => helpfulStudioOptions.value.length > 1)
const hasAdjustableOptions = computed(() => (
  hasAdjustablePurposeGenres.value || hasAdjustableHelpfulStudios.value
))
const selectionMatchesProposal = computed(() => (
  valuesMatch(selectedPurposeGenreValues.value, proposedPurposeGenreValues.value) &&
  valuesMatch(selectedHelpfulStudioValues.value, proposedHelpfulStudioValues.value)
))

function valuesMatch(left, right) {
  return left.length === right.length && left.every(value => right.includes(value))
}

function selectionFromCommands(commands, commandId, proposedValues) {
  const normalizedCommands = normalizePolicyAuthoringProposalAdjustmentCommands(commands)
  const command = normalizedCommands?.find(entry => entry.commandId === commandId)
  if (!command || !command.values.every(value => proposedValues.includes(value))) return [...proposedValues]

  return [...command.values]
}

function restoreProposalValues() {
  selectedPurposeGenreValues.value = [...proposedPurposeGenreValues.value]
  selectedHelpfulStudioValues.value = [...proposedHelpfulStudioValues.value]
}

function isLastSelectedOption(value, selectedValues) {
  return selectedValues.length === 1 && selectedValues[0] === value
}

function adjustmentCommandsMatch(left, right) {
  if (left === null || right === null || left.length !== right.length) return false

  return left.every((command, index) => (
    command.commandId === right[index].commandId &&
    valuesMatch(command.values, right[index].values)
  ))
}

watch([
  proposedPurposeGenreValues,
  proposedHelpfulStudioValues,
  () => props.adjustmentCommands,
], () => {
  selectedPurposeGenreValues.value = selectionFromCommands(
    props.adjustmentCommands,
    POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_PURPOSE_GENRES,
    proposedPurposeGenreValues.value
  )
  selectedHelpfulStudioValues.value = selectionFromCommands(
    props.adjustmentCommands,
    POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_HELPFUL_STUDIOS,
    proposedHelpfulStudioValues.value
  )
}, { immediate: true })

watch([selectedPurposeGenreValues, selectedHelpfulStudioValues], ([purposeGenres, helpfulStudios]) => {
  const commands = buildPolicyAuthoringProposalAdjustmentCommands({
    purposeGenreOptions: purposeGenreOptions.value,
    selectedPurposeGenreValues: purposeGenres,
    helpfulStudioOptions: helpfulStudioOptions.value,
    selectedHelpfulStudioValues: helpfulStudios,
  })

  const currentCommands = normalizePolicyAuthoringProposalAdjustmentCommands(props.adjustmentCommands)
  if (commands !== null && !adjustmentCommandsMatch(commands, currentCommands)) {
    emit('update:adjustment-commands', commands)
  }
}, { deep: true })
</script>
