<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    v-if="selectableCandidates.length > 0 || acceptedCandidateList.length > 0"
    class="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3"
    aria-labelledby="policy-observed-suggestions-title"
  >
    <h6
      id="policy-observed-suggestions-title"
      class="text-sm font-semibold text-white"
    >
      What should define this destination?
    </h6>
    <p
      :id="descriptionId"
      class="mt-1 text-xs text-gray-300"
    >
      These are values already observed in {{ libraryName }}. Select only the values that should define this destination going forward.
    </p>

    <fieldset
      v-if="availableCandidates.length > 0"
      class="mt-3"
      :aria-describedby="`${descriptionId} ${selectionStatusId}`"
    >
      <legend class="text-xs font-medium text-gray-100">
        Select all that apply
      </legend>
      <div class="mt-2 space-y-2">
        <label
          v-for="candidate in availableCandidates"
          :key="candidate.candidateId"
          class="flex cursor-pointer items-start gap-2 rounded border border-gray-700 bg-background px-3 py-2 text-sm text-gray-100 hover:border-gray-500"
        >
          <input
            :id="inputId(candidate)"
            v-model="selectedCandidateIds"
            class="mt-0.5 h-4 w-4 rounded border-gray-500 bg-background text-primary focus:ring-primary"
            type="checkbox"
            :value="candidate.candidateId"
          >
          <span>
            <span class="font-medium">{{ candidate.label }}</span>
            <span class="ml-1 text-xs text-gray-400">
              {{ evidenceLabel(candidate) }}
            </span>
            <span class="mt-0.5 block text-xs text-gray-400">
              {{ candidate.explanation }}
            </span>
          </span>
        </label>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="outline-solid"
          :disabled="selectedCandidateIds.length === 0"
          @click="acceptSelectedCandidates"
        >
          Use selected values
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
      v-else-if="acceptedCandidateList.length === 0"
      class="mt-3 text-xs text-gray-400"
    >
      No additional observed values are available to accept.
    </p>

    <section
      v-if="acceptedCandidateList.length > 0"
      class="mt-4 border-t border-gray-700 pt-3"
      aria-labelledby="policy-accepted-suggestions-title"
    >
      <h6
        id="policy-accepted-suggestions-title"
        class="text-xs font-medium text-gray-100"
      >
        Declared destination values
      </h6>
      <p class="mt-1 text-xs text-gray-400">
        These values will become the native purpose rules when this new policy is created.
      </p>
      <ul class="mt-2 flex flex-wrap gap-2">
        <li
          v-for="candidate in acceptedCandidateList"
          :key="candidate.candidateId"
          class="inline-flex items-center gap-2 rounded border border-green-800/70 bg-green-950/30 px-2 py-1 text-xs text-green-100"
        >
          <span>{{ candidate.label }}</span>
          <button
            class="rounded px-1 text-green-100 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-primary"
            type="button"
            :aria-label="`Remove ${candidate.label} from declared destination values`"
            @click="removeCandidate(candidate)"
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
import {
  buildObservedSuggestionCommandPlan,
  normalizeAcceptedCandidates,
} from '@/utils/policyObservedSuggestionDraft'

const props = defineProps({
  acceptedCandidates: {
    type: Array,
    default: () => [],
  },
  candidates: {
    type: Array,
    default: () => [],
  },
  libraryName: {
    type: String,
    default: 'this library',
  },
})

const emit = defineEmits({
  'draft-command-plan': plan => Boolean(plan?.commands?.length),
})

const selectedCandidateIds = ref([])
const descriptionId = 'policy-observed-suggestion-description'
const selectionStatusId = 'policy-observed-suggestion-status'

const selectableCandidates = computed(() => normalizeAcceptedCandidates(props.candidates))
const acceptedCandidateList = computed(() => normalizeAcceptedCandidates(props.acceptedCandidates))
const acceptedCandidateIds = computed(() => new Set(
  acceptedCandidateList.value.map(candidate => candidate.candidateId)
))
const availableCandidates = computed(() => selectableCandidates.value.filter(
  candidate => !acceptedCandidateIds.value.has(candidate.candidateId)
))

const selectionStatus = computed(() => {
  const selectedCount = selectedCandidateIds.value.length
  const acceptedCount = acceptedCandidateList.value.length

  if (selectedCount > 0) {
    return `${selectedCount} ${selectedCount === 1 ? 'value' : 'values'} selected. They are not policy rules until you use them.`
  }

  if (acceptedCount > 0) {
    return `${acceptedCount} ${acceptedCount === 1 ? 'value is' : 'values are'} declared for this new policy.`
  }

  return 'No observed values selected.'
})

watch(availableCandidates, (nextCandidates) => {
  const availableIds = new Set(nextCandidates.map(candidate => candidate.candidateId))
  selectedCandidateIds.value = selectedCandidateIds.value.filter(id => availableIds.has(id))
}, { immediate: true })

const inputId = candidate => `policy-observed-suggestion-${candidate.candidateId.replace(/[^A-Za-z0-9_-]/g, '-')}`

const evidenceLabel = candidate => {
  const count = Number(candidate.evidenceCount) || 0
  return `${count} ${count === 1 ? 'item' : 'items'} currently here`
}

const acceptSelectedCandidates = () => {
  const candidateIds = new Set(selectedCandidateIds.value)
  const plan = buildObservedSuggestionCommandPlan({
    commandId: 'add_signal_value',
    candidates: availableCandidates.value.filter(candidate => candidateIds.has(candidate.candidateId)),
  })
  if (!plan?.commands?.length) return

  emit('draft-command-plan', plan)
  selectedCandidateIds.value = []
}

const removeCandidate = (candidate) => {
  const plan = buildObservedSuggestionCommandPlan({
    commandId: 'remove_signal_value',
    candidates: [candidate],
  })
  if (plan?.commands?.length) {
    emit('draft-command-plan', plan)
  }
}
</script>
