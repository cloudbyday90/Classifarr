<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    v-if="showPicker"
    class="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3"
    aria-labelledby="intent-signal-picker-title"
  >
    <h6
      id="intent-signal-picker-title"
      class="text-sm font-semibold text-white"
    >
      What should define this destination?
    </h6>
    <p
      :id="descriptionId"
      class="mt-1 text-xs text-gray-300"
    >
      {{ libraryName }} shows how this destination is used today. Select only the suggested values that should define future matches. Add a specific value only when the library does not provide one.
    </p>

    <section
      v-if="observedEvidenceList.length > 0"
      class="mt-3 rounded border border-gray-700 bg-background px-3 py-2"
      aria-labelledby="intent-signal-observed-evidence-title"
    >
      <p
        id="intent-signal-observed-evidence-title"
        class="text-xs font-medium text-gray-100"
      >
        Already in this library
      </p>
      <p class="mt-1 text-xs text-gray-400">
        This is observed evidence, not a policy rule. Suggested values below require explicit acceptance.
      </p>
      <ul class="mt-2 flex flex-wrap gap-2">
        <li
          v-for="option in observedEvidenceList"
          :key="option.candidateId"
          class="rounded border border-gray-700 bg-background-light px-2 py-1 text-xs text-gray-200"
        >
          <span class="font-medium">{{ option.label }}</span>
          <span class="ml-1 text-gray-400">{{ evidenceLabel(option) }}</span>
        </li>
      </ul>
    </section>

    <fieldset
      v-if="availableOptionGroups.length > 0"
      class="mt-3"
      :aria-describedby="`${descriptionId} ${selectionStatusId}`"
    >
      <legend class="text-xs font-medium text-gray-100">
        Add declared destination signals
      </legend>
      <div class="mt-2 space-y-3">
        <section
          v-for="group in availableOptionGroups"
          :key="group.sourceId"
          class="rounded border border-gray-700 bg-background px-3 py-2"
          :aria-labelledby="group.headingId"
        >
          <p
            :id="group.headingId"
            class="text-xs font-medium text-gray-100"
          >
            {{ group.label }}
          </p>
          <div class="mt-2 space-y-2">
            <label
              v-for="option in group.options"
              :key="option.candidateId"
              class="flex items-start gap-2 rounded border border-gray-700 bg-background-light px-3 py-2 text-sm text-gray-100"
              :class="option.canSelect ? 'cursor-pointer hover:border-gray-500' : 'cursor-not-allowed opacity-80'"
            >
              <input
                :id="inputId(option)"
                v-model="selectedOptionIds"
                class="mt-0.5 h-4 w-4 rounded border-gray-500 bg-background text-primary focus:ring-primary disabled:cursor-not-allowed"
                type="checkbox"
                :value="option.candidateId"
                :disabled="!option.canSelect"
                :aria-describedby="optionDescriptionId(option)"
              >
              <span>
                <span class="font-medium">{{ option.label }}</span>
                <span
                  v-if="option.evidence.count > 0"
                  class="ml-1 text-xs text-gray-400"
                >
                  {{ evidenceLabel(option) }}
                </span>
                <span
                  :id="optionDescriptionId(option)"
                  class="mt-0.5 block text-xs text-gray-400"
                >
                  {{ option.description }}
                </span>
              </span>
            </label>
          </div>
        </section>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="outline-solid"
          :disabled="selectedOptionIds.length === 0"
          @click="addSelectedSignals"
        >
          Add selected signals
        </Button>
        <p
          :id="selectionStatusId"
          class="text-xs text-gray-300"
          role="status"
          aria-live="polite"
        >
          {{ selectionStatus }}
        </p>
      </div>
    </fieldset>

    <p
      v-else-if="acceptedSignalList.length === 0 && !customEntryEnabled"
      class="mt-3 text-xs text-gray-400"
    >
      No additional library-backed values are available to add.
    </p>

    <PolicyIntentCustomSignalEntry
      :input-contract="customEntryInput"
      :busy="customEntryBusy"
      :error="customEntryError"
      :message="customEntryMessage"
      @validate-custom-signal="emit('validate-custom-signal', $event)"
    />

    <section
      v-if="acceptedSignalList.length > 0"
      class="mt-4 border-t border-gray-700 pt-3"
      aria-labelledby="intent-signal-picker-accepted-title"
    >
      <p
        id="intent-signal-picker-accepted-title"
        class="text-xs font-medium text-gray-100"
      >
        Declared destination signals
      </p>
      <p class="mt-1 text-xs text-gray-400">
        These values become native purpose rules only when this new policy is created.
      </p>
      <ul class="mt-2 flex flex-wrap gap-2">
        <li
          v-for="signal in acceptedSignalList"
          :key="signal.candidateId"
          class="inline-flex items-center gap-2 rounded border border-green-800/70 bg-green-950/30 px-2 py-1 text-xs text-green-100"
        >
          <span>{{ signal.label }}</span>
          <button
            class="rounded px-1 text-green-100 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-primary"
            type="button"
            :aria-label="`Remove ${signal.label} from declared destination signals`"
            @click="removeSignal(signal)"
          >
            Remove
          </button>
        </li>
      </ul>
    </section>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import Button from '@/components/common/Button.vue'
import PolicyIntentCustomSignalEntry from './PolicyIntentCustomSignalEntry.vue'
import {
  buildIntentSignalCommandPlan,
  normalizeIntentSignalCandidates,
  normalizeIntentSignalPickerOptions,
} from '@/utils/policyIntentSignalDraft'

const props = defineProps({
  acceptedSignals: {
    type: Array,
    default: () => [],
  },
  observedEvidence: {
    type: Array,
    default: () => [],
  },
  options: {
    type: Array,
    default: () => [],
  },
  libraryName: {
    type: String,
    default: 'This library',
  },
  customEntryInput: {
    type: Object,
    default: null,
  },
  customEntryBusy: {
    type: Boolean,
    default: false,
  },
  customEntryError: {
    type: String,
    default: '',
  },
  customEntryMessage: {
    type: String,
    default: '',
  },
})

const emit = defineEmits({
  'draft-command-plan': plan => Boolean(plan?.commands?.length),
  'validate-custom-signal': payload => Boolean(payload?.signalType && payload?.value && payload?.explanation),
})

const selectedOptionIds = ref([])
const descriptionId = 'intent-signal-picker-description'
const selectionStatusId = 'intent-signal-picker-status'

const observedEvidenceList = computed(() => normalizeIntentSignalPickerOptions(props.observedEvidence)
  .filter(option => option.readOnlyEvidence))
const normalizedOptions = computed(() => normalizeIntentSignalPickerOptions(props.options))
const acceptedSignalList = computed(() => normalizeIntentSignalCandidates(props.acceptedSignals))
const customEntryEnabled = computed(() => props.customEntryInput?.enabled === true)
const acceptedSignalIds = computed(() => new Set(
  acceptedSignalList.value.map(signal => signal.candidateId)
))
const selectableSignalIds = computed(() => new Set(
  normalizeIntentSignalCandidates(normalizedOptions.value).map(signal => signal.candidateId)
))

const availableOptions = computed(() => normalizedOptions.value
  .filter(option => !acceptedSignalIds.value.has(option.candidateId))
  .map(option => ({
    ...option,
    canSelect: selectableSignalIds.value.has(option.candidateId),
    description: option.disabledReason || option.explanation ||
      'This option is not available for native destination setup.',
  })))

const availableOptionGroups = computed(() => {
  const groups = new Map()

  availableOptions.value.forEach((option) => {
    const sourceId = option.sourceId || 'unavailable'
    const group = groups.get(sourceId) || {
      sourceId,
      label: option.sourceLabel || 'Available options',
      headingId: `intent-signal-picker-source-${sourceId.replace(/[^A-Za-z0-9_-]/g, '-')}`,
      options: [],
    }
    group.options.push(option)
    groups.set(sourceId, group)
  })

  return Array.from(groups.values())
})

const showPicker = computed(() => (
  observedEvidenceList.value.length > 0 ||
  availableOptionGroups.value.length > 0 ||
  acceptedSignalList.value.length > 0 ||
  customEntryEnabled.value
))

const selectionStatus = computed(() => {
  const selectedCount = selectedOptionIds.value.length
  const acceptedCount = acceptedSignalList.value.length

  if (selectedCount > 0) {
    return `${selectedCount} ${selectedCount === 1 ? 'signal' : 'signals'} selected. They are not policy rules until you add them.`
  }

  if (acceptedCount > 0) {
    return `${acceptedCount} ${acceptedCount === 1 ? 'signal is' : 'signals are'} declared for this new policy.`
  }

  return 'No destination signals selected.'
})

watch(availableOptions, (nextOptions) => {
  const selectableIds = new Set(nextOptions
    .filter(option => option.canSelect)
    .map(option => option.candidateId))
  selectedOptionIds.value = selectedOptionIds.value.filter(id => selectableIds.has(id))
}, { immediate: true })

const inputId = option => `intent-signal-picker-${option.candidateId.replace(/[^A-Za-z0-9_-]/g, '-')}`
const optionDescriptionId = option => `${inputId(option)}-description`

const evidenceLabel = option => {
  const count = option.evidence.count
  return `${count} ${count === 1 ? 'item' : 'items'} currently here`
}

const addSelectedSignals = () => {
  const selectedIds = new Set(selectedOptionIds.value)
  const plan = buildIntentSignalCommandPlan({
    commandId: 'add_signal_value',
    candidates: availableOptions.value.filter(option => selectedIds.has(option.candidateId)),
  })
  if (!plan?.commands?.length) return

  emit('draft-command-plan', plan)
  selectedOptionIds.value = []
}

const removeSignal = (signal) => {
  const plan = buildIntentSignalCommandPlan({
    commandId: 'remove_signal_value',
    candidates: [signal],
  })
  if (plan?.commands?.length) {
    emit('draft-command-plan', plan)
  }
}
</script>
