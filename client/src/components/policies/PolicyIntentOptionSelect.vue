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
        {{ label }}
      </span>
      <select
        :value="modelValue"
        class="mt-1 w-full px-2 py-1 bg-background border border-gray-700 rounded-sm text-xs"
        @change="emit('update:modelValue', $event.target.value)"
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
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { resolvePolicyIntentOptionStates } from '@/utils/policyIntentSectionProjection'

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  modelValue: {
    type: String,
    default: '',
  },
  section: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits({
  'update:modelValue': value => typeof value === 'string',
})

const optionStates = computed(() => resolvePolicyIntentOptionStates(props.section))
const optionDiagnosticMessage = computed(() => props.section.optionDiagnostics?.message || '')
</script>
