<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-2">
    <label class="block">
      <span class="text-[11px] font-medium text-gray-400">
        {{ inputLabel }}
      </span>
      <select
        v-model="selectedValue"
        class="mt-1 w-full px-2 py-1 bg-background border border-gray-700 rounded-sm text-xs"
      >
        <option value="">
          {{ section.addLabel }}
        </option>
        <option
          v-for="option in optionStates"
          :key="section.key + '-' + option.value"
          :value="option.value"
          :disabled="option.disabled"
          :title="option.reason"
        >
          {{ option.label }}{{ option.disabled ? ` (${option.reason})` : '' }}
        </option>
      </select>
    </label>

    <p
      v-if="availabilityMessage"
      class="text-[11px] text-gray-500"
    >
      {{ availabilityMessage }}
    </p>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="px-2 py-1 border border-primary/60 rounded-sm text-xs text-primary hover:bg-primary/10 disabled:opacity-50 disabled:hover:bg-transparent"
        :disabled="!selectedValue || selectedOptionDisabled"
        @click="emitSelectedValue"
      >
        {{ buttonLabel }}
      </button>
      <button
        v-if="section.hasClearAction"
        type="button"
        class="px-2 py-1 border border-gray-600 rounded-sm text-xs text-gray-300 hover:bg-gray-700"
        @click="emit('clear-section', section.key)"
      >
        Clear max rating
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

const props = defineProps({
  section: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits({
  'add-value': payload => Boolean(payload?.sectionKey && payload?.value),
  'clear-section': sectionKey => typeof sectionKey === 'string' && sectionKey.length > 0,
})

const selectedValue = ref('')

const isHardLimit = computed(() => props.section.key === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS)

const optionStates = computed(() => {
  if (Array.isArray(props.section.optionStates)) return props.section.optionStates

  return (props.section.options || [])
    .filter(Boolean)
    .map(option => ({
      value: String(option),
      label: String(option),
      disabled: false,
      reason: '',
    }))
})

const enabledOptions = computed(() => optionStates.value.filter(option => !option.disabled))

const selectedOptionDisabled = computed(() => {
  const selectedOption = optionStates.value.find(option => option.value === selectedValue.value)
  return Boolean(selectedOption?.disabled)
})

const availabilityMessage = computed(() => {
  if (optionStates.value.length === 0) return 'No rating options are available for this policy yet.'
  if (enabledOptions.value.length === 0) return isHardLimit.value
    ? 'The available max rating is already configured.'
    : 'All available avoid ratings are already configured in this section.'
  return ''
})

const inputLabel = computed(() => isHardLimit.value
  ? 'Maximum allowed rating'
  : 'Rating to avoid')

const buttonLabel = computed(() => isHardLimit.value
  ? 'Set max rating'
  : 'Add avoid rating')

const emitSelectedValue = () => {
  if (!selectedValue.value || selectedOptionDisabled.value) return

  emit('add-value', {
    sectionKey: props.section.key,
    value: selectedValue.value,
  })
  selectedValue.value = ''
}
</script>
