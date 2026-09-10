<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    id="policy-native-purpose-bootstrap"
    class="rounded border border-indigo-700/70 bg-gray-950/30 p-3 text-sm"
    aria-labelledby="policy-native-purpose-bootstrap-title"
  >
    <h5
      id="policy-native-purpose-bootstrap-title"
      class="font-medium text-indigo-50"
    >
      What belongs in {{ libraryLabel }}?
    </h5>
    <p
      id="policy-native-purpose-bootstrap-description"
      class="mt-1 text-indigo-100"
    >
      These are observed suggestions from the current library contents. Select only the terms that define this destination; showing a term does not make it declared purpose or semantic proof.
    </p>

    <fieldset
      v-for="group in groups"
      :key="group.id"
      class="mt-4 rounded border border-gray-700 bg-gray-900/30 p-3"
      :aria-describedby="'purpose-bootstrap-group-' + group.id"
    >
      <legend class="px-1 font-medium text-indigo-100">
        {{ signalLabel(group.signalType) }} that define this library
      </legend>
      <div
        class="mt-2 flex flex-wrap gap-2"
      >
        <button
          v-for="term in group.terms"
          :key="term.value"
          type="button"
          class="rounded border px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          :class="term.selected
            ? 'border-indigo-400 bg-indigo-900/50 text-indigo-50'
            : 'border-gray-600 bg-gray-950/40 text-gray-300 hover:border-gray-400'"
          :aria-pressed="term.selected"
          :data-purpose-term="term.value"
          @click="toggleTerm(group.id, term.value, !term.selected)"
        >
          {{ term.value }}
          <span class="sr-only">{{ term.selected ? ' selected' : ' not selected' }}</span>
        </button>
      </div>
      <p
        :id="'purpose-bootstrap-group-' + group.id"
        class="mt-2 text-xs text-indigo-200"
      >
        Selected terms become the identity-purpose draft. Unselected observed terms are not retained by this draft.
      </p>
      <label class="mt-3 grid gap-1 text-sm text-indigo-100">
        <span>Add {{ singularSignalLabel(group.signalType) }} term</span>
        <span class="flex flex-wrap gap-2">
          <input
            v-model="draftTerms[group.id]"
            type="text"
            class="min-w-0 flex-1 rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-white"
            :aria-label="`Add ${singularSignalLabel(group.signalType)} term`"
            :disabled="busy"
            autocomplete="off"
            @keydown.enter.prevent="addTerms(group.id)"
          >
          <button
            type="button"
            class="rounded border border-indigo-400 px-3 py-1.5 font-medium text-indigo-100 hover:bg-indigo-900/40 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="busy || !draftTerms[group.id]?.trim()"
            @click="addTerms(group.id)"
          >
            Add term
          </button>
        </span>
      </label>
    </fieldset>

    <p
      v-if="errorMessage"
      class="mt-3 rounded border border-red-500/50 bg-red-950/30 p-3 text-red-100"
      role="alert"
    >
      {{ errorMessage }}
    </p>

    <p class="mt-4 text-indigo-100">
      <template v-if="selectedTermCount > 0">
        {{ selectedTermCount }} selected identity term{{ selectedTermCount === 1 ? '' : 's' }}. Saving creates a revision and never routes media automatically.
      </template>
      <template v-else>
        Choose at least one identity term before saving a library purpose.
      </template>
    </p>
    <button
      type="button"
      class="mt-3 rounded border border-gray-500 px-3 py-1.5 font-medium text-gray-100 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="busy"
      @click="emit('show-advanced')"
    >
      Edit advanced rules
    </button>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  addNativePurposeBootstrapTerms,
  buildNativePurposeBootstrapGroups,
  updateNativePurposeBootstrapSelection,
} from '@/utils/policyNativeIntentPurposeBootstrap'

defineOptions({
  name: 'PolicyNativeIntentPurposeBootstrap',
})

const props = defineProps({
  suggestionCommand: {
    type: Object,
    required: true,
  },
  modelValue: {
    type: Array,
    required: true,
  },
  libraryName: {
    type: String,
    default: '',
  },
  busy: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits({
  'update:modelValue': rules => Array.isArray(rules),
  'show-advanced': () => true,
})

const draftTerms = ref({})
const errorMessage = ref('')
const groups = computed(() => buildNativePurposeBootstrapGroups({
  suggestionCommand: props.suggestionCommand,
  selectedRules: props.modelValue,
}) || [])
const libraryLabel = computed(() => props.libraryName.trim() || 'this library')
const selectedTermCount = computed(() => groups.value.reduce((count, group) => (
  count + group.terms.filter(term => term.selected).length
), 0))

function signalLabel(signalType) {
  return {
    genres: 'Genres',
    keywords: 'Keywords',
    studios: 'Studios',
  }[signalType] || 'Terms'
}

function singularSignalLabel(signalType) {
  return {
    genres: 'genre',
    keywords: 'keyword',
    studios: 'studio',
  }[signalType] || 'purpose'
}

function updateDraft(nextRules) {
  if (!Array.isArray(nextRules)) {
    errorMessage.value = 'Classifarr could not update the purpose draft. Open advanced rules to review the current declaration.'
    return false
  }

  errorMessage.value = ''
  emit('update:modelValue', nextRules)
  return true
}

function toggleTerm(groupId, term, selected) {
  if (props.busy) return

  updateDraft(updateNativePurposeBootstrapSelection({
    suggestionCommand: props.suggestionCommand,
    selectedRules: props.modelValue,
    groupId,
    term,
    selected,
  }))
}

function addTerms(groupId) {
  if (props.busy) return

  const value = draftTerms.value[groupId]
  const updated = updateDraft(addNativePurposeBootstrapTerms({
    suggestionCommand: props.suggestionCommand,
    selectedRules: props.modelValue,
    groupId,
    terms: value,
  }))
  if (updated) draftTerms.value[groupId] = ''
}
</script>
