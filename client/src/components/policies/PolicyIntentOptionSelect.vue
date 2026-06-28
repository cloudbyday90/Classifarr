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
        v-if="!multiple"
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

      <div
        v-else
        class="mt-1 max-h-48 overflow-y-auto rounded-sm border border-gray-700 bg-background p-2"
        role="group"
        :aria-label="label"
      >
        <label
          v-for="option in optionStates"
          :key="section.key + '-' + option.value"
          class="flex items-start gap-2 rounded px-1.5 py-1 text-xs"
          :class="option.disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:bg-background-light'"
          :title="option.reason || option.detail || option.label"
        >
          <input
            type="checkbox"
            class="mt-0.5"
            :value="option.value"
            :checked="selectedValues.includes(option.value)"
            :disabled="option.disabled"
            @change="toggleSelectedValue(option.value, $event.target.checked)"
          >
          <span class="min-w-0 flex-1">
            <span class="block text-gray-100">
              {{ option.label }}
            </span>
            <span
              v-if="option.sourceLabel || option.detail"
              class="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-gray-500"
            >
              <span
                v-if="option.sourceLabel"
                class="rounded border border-gray-700 px-1 py-px text-gray-400"
              >
                {{ option.sourceLabel }}
              </span>
              <span v-if="option.count">
                {{ option.count }} currently here
              </span>
              <span v-else-if="option.detail">
                {{ option.detail }}
              </span>
            </span>
            <span
              v-if="option.disabled"
              class="mt-0.5 block text-[10px] text-gray-500"
            >
              {{ option.reason }}
            </span>
          </span>
        </label>
      </div>
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
    type: [String, Array],
    default: '',
  },
  multiple: {
    type: Boolean,
    default: false,
  },
  section: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits({
  'update:modelValue': value => typeof value === 'string' || Array.isArray(value),
})

const optionStates = computed(() => resolvePolicyIntentOptionStates(props.section))
const optionDiagnosticMessage = computed(() => props.section.optionDiagnostics?.message || '')
const selectedValues = computed(() => {
  return Array.isArray(props.modelValue)
    ? props.modelValue
    : String(props.modelValue || '').trim()
      ? [props.modelValue]
      : []
})

const toggleSelectedValue = (value, checked) => {
  const nextValues = new Set(selectedValues.value)
  if (checked) {
    nextValues.add(value)
  } else {
    nextValues.delete(value)
  }

  emit('update:modelValue', Array.from(nextValues))
}
</script>
