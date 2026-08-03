<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    v-if="options.length > 0"
    class="mt-5 rounded border border-gray-700 bg-gray-900/40 p-4"
    aria-labelledby="policy-destination-adjustment-heading"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h4
          id="policy-destination-adjustment-heading"
          class="text-sm font-semibold text-white"
        >
          Fine-tune this proposal
        </h4>
        <p class="mt-1 text-sm text-gray-400">
          Optional. The proposed library meaning is used unless you narrow its genres.
        </p>
      </div>
      <button
        type="button"
        class="rounded border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-100 hover:border-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-950"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Hide adjustments' : 'Adjust this policy' }}
      </button>
    </div>

    <div
      v-if="expanded"
      class="mt-4 border-t border-gray-700 pt-4"
    >
      <fieldset>
        <legend class="text-sm font-semibold text-white">
          Keep these proposed genres
        </legend>
        <p class="mt-1 text-sm leading-6 text-gray-300">
          Proposed from the current library profile. At least one genre is required. Custom values,
          templates, limits, review behavior, and routing are unchanged.
        </p>
        <div class="mt-3 space-y-2">
          <label
            v-for="option in options"
            :key="option.value"
            class="flex items-start gap-3 rounded border border-gray-700 px-3 py-2 text-sm text-gray-100"
          >
            <input
              v-model="selectedValues"
              type="checkbox"
              :value="option.value"
              :disabled="isLastSelectedOption(option.value)"
              class="mt-1 h-4 w-4 rounded border-gray-500 bg-gray-950 text-primary focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
            <span>
              <span class="font-medium">{{ option.value }}</span>
              <span class="ml-2 text-xs text-gray-400">Current library profile</span>
            </span>
          </label>
        </div>
      </fieldset>
      <button
        type="button"
        class="mt-4 rounded border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-100 hover:border-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-950 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="selectionMatchesProposal"
        @click="restoreProposalGenres"
      >
        Restore proposed genres
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import {
  buildPolicyAuthoringProposalPurposeGenreAdjustmentCommands,
  normalizePolicyAuthoringProposalAdjustmentCommands,
  normalizePolicyAuthoringProposalPurposeGenreOptions,
} from '@/utils/policyAuthoringProposalAdjustment'

const props = defineProps({
  genreOptions: {
    type: Array,
    default: () => [],
  },
  adjustmentCommands: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:adjustment-commands'])
const expanded = ref(false)
const selectedValues = ref([])
const options = computed(() => normalizePolicyAuthoringProposalPurposeGenreOptions(props.genreOptions))
const proposedValues = computed(() => options.value.map(option => option.value))
const selectionMatchesProposal = computed(() => selectedValues.value.length === proposedValues.value.length &&
  selectedValues.value.every(value => proposedValues.value.includes(value)))

function selectionFromCommands(commands) {
  const normalizedCommands = normalizePolicyAuthoringProposalAdjustmentCommands(commands)
  if (normalizedCommands === null || normalizedCommands.length === 0) return [...proposedValues.value]

  const values = normalizedCommands[0].values
  return values.every(value => proposedValues.value.includes(value)) ? [...values] : [...proposedValues.value]
}

function restoreProposalGenres() {
  selectedValues.value = [...proposedValues.value]
}

function isLastSelectedOption(value) {
  return selectedValues.value.length === 1 && selectedValues.value[0] === value
}

function adjustmentCommandsMatch(left, right) {
  if (left === null || right === null || left.length !== right.length) return false
  if (left.length === 0) return true

  return left[0].commandId === right[0].commandId &&
    left[0].values.length === right[0].values.length &&
    left[0].values.every((value, index) => value === right[0].values[index])
}

watch([proposedValues, () => props.adjustmentCommands], () => {
  selectedValues.value = selectionFromCommands(props.adjustmentCommands)
}, { immediate: true })

watch(selectedValues, values => {
  const commands = buildPolicyAuthoringProposalPurposeGenreAdjustmentCommands({
    options: options.value,
    selectedValues: values,
  })

  const currentCommands = normalizePolicyAuthoringProposalAdjustmentCommands(props.adjustmentCommands)
  if (commands !== null && !adjustmentCommandsMatch(commands, currentCommands)) {
    emit('update:adjustment-commands', commands)
  }
}, { deep: true })
</script>
