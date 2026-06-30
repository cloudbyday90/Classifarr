<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <fieldset class="space-y-3">
    <legend class="sr-only">
      {{ section.actionLabel }}
    </legend>

    <div class="space-y-2">
      <label
        v-for="option in optionStates"
        :key="option.value"
        class="flex gap-2 rounded-md border border-gray-700 bg-background px-3 py-2 text-sm"
        :class="option.disabled ? 'opacity-60' : ''"
      >
        <input
          v-model="selectedValues"
          type="checkbox"
          class="mt-1"
          :value="option.value"
          :disabled="option.disabled"
        >
        <span>
          <span class="block text-gray-100">
            {{ option.label }}
          </span>
          <span
            v-if="option.help || option.reason"
            class="block text-xs text-gray-400"
          >
            {{ option.reason || option.help }}
          </span>
        </span>
      </label>
    </div>

    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <button
        type="button"
        class="rounded-sm border border-cyan-700 px-3 py-1 text-xs text-cyan-100 hover:bg-cyan-950/40 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!controlReadiness.canSubmit"
        @click="emitSelectedValues"
      >
        Add review triggers
      </button>
      <p
        v-if="controlReadiness.reason"
        class="text-xs text-gray-400"
      >
        {{ controlReadiness.reason }}
      </p>
    </div>
  </fieldset>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import {
  buildPolicyIntentControlReadiness,
  resolvePolicyIntentOptionStates,
} from '@/utils/policyIntentSectionProjection'

const props = defineProps({
  section: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits({
  'add-value': payload => Boolean(payload?.sectionKey && payload?.value),
})

const selectedValues = ref([])

const optionStates = computed(() => resolvePolicyIntentOptionStates(props.section))

const controlReadiness = computed(() => buildPolicyIntentControlReadiness(props.section.key, {
  selectedValue: selectedValues.value,
  optionStates: optionStates.value,
  optionDiagnostics: props.section.optionDiagnostics,
}))

watch(
  () => props.section.entries,
  () => {
    selectedValues.value = selectedValues.value.filter((value) => {
      const option = optionStates.value.find(candidate => candidate.value === value)
      return option && !option.disabled
    })
  },
  { deep: true },
)

function emitSelectedValues() {
  if (!controlReadiness.value.canSubmit) return

  const values = [...selectedValues.value]
  selectedValues.value = []

  values.forEach(value => {
    emit('add-value', {
      sectionKey: props.section.key,
      value,
    })
  })
}
</script>
