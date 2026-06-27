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
      v-if="optionDiagnosticMessage"
      class="text-[11px] text-gray-500"
    >
      {{ optionDiagnosticMessage }}
    </p>

    <button
      type="button"
      class="px-2 py-1 border border-primary/60 rounded-sm text-xs text-primary hover:bg-primary/10 disabled:opacity-50 disabled:hover:bg-transparent"
      :disabled="!controlReadiness.canSubmit"
      :title="controlReadiness.reason"
      :aria-label="controlButtonAriaLabel"
      @click="emitSelectedValue"
    >
      {{ buttonLabel }}
    </button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'
import { buildPolicyIntentControlReadiness } from '@/utils/policyIntentSectionProjection'

const props = defineProps({
  section: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits({
  'add-value': payload => Boolean(payload?.sectionKey && payload?.value),
})

const selectedValue = ref('')

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

const controlReadiness = computed(() => {
  return buildPolicyIntentControlReadiness(props.section.key, {
    selectedValue: selectedValue.value,
    optionStates: optionStates.value,
    optionDiagnostics: props.section.optionDiagnostics,
  })
})

const optionDiagnosticMessage = computed(() => props.section.optionDiagnostics?.message || '')

const inputLabel = computed(() => {
  if (props.section.key === POLICY_INTENT_BUCKETS.IDENTITY) return 'Genre that defines this library'
  if (props.section.key === POLICY_INTENT_BUCKETS.COMPATIBILITY) return 'Genre that can support a match'
  if (props.section.key === POLICY_INTENT_BUCKETS.BOOSTERS) return 'Genre that boosts confidence'
  return 'Genre signal'
})

const buttonLabel = computed(() => {
  if (props.section.key === POLICY_INTENT_BUCKETS.IDENTITY) return 'Add belongs-here genre'
  if (props.section.key === POLICY_INTENT_BUCKETS.COMPATIBILITY) return 'Add helpful genre'
  if (props.section.key === POLICY_INTENT_BUCKETS.BOOSTERS) return 'Add confidence boost'
  return 'Add genre'
})

const controlButtonAriaLabel = computed(() => {
  if (controlReadiness.value.canSubmit || !controlReadiness.value.reason) {
    return buttonLabel.value
  }

  return `${buttonLabel.value}: ${controlReadiness.value.reason}`
})

const emitSelectedValue = () => {
  if (!controlReadiness.value.canSubmit) return

  emit('add-value', {
    sectionKey: props.section.key,
    value: selectedValue.value,
  })
  selectedValue.value = ''
}
</script>
