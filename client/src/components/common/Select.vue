<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div
    v-bind="layoutAttrs()"
    class="flex flex-col gap-2"
  >
    <label
      v-if="label"
      :for="controlId()"
      class="text-sm font-medium"
    >{{ label }}</label>
    <select
      v-bind="controlAttrs()"
      :value="modelValue"
      :disabled="disabled"
      class="px-4 py-2 bg-background border border-gray-700 rounded-lg focus:outline-hidden focus:border-primary transition-colors disabled:opacity-50"
      @change="handleChange"
    >
      <option
        v-if="placeholder"
        value=""
        disabled
      >
        {{ placeholder }}
      </option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { useFormControlAttrs } from '@/composables/useFormControlAttrs.js'

defineOptions({ inheritAttrs: false })
const { controlId, controlAttrs, layoutAttrs } = useFormControlAttrs()

/** @typedef {{ value: string | number, label: string }} SelectOption */
const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
  label: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
  options: {
    type: /** @type {import('vue').PropType<ReadonlyArray<SelectOption>>} */ (Array),
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits({
  'update:modelValue': /** @param {string} value */ (value) => typeof value === 'string',
})

/** @param {Event} event */
function handleChange(event) {
  const target = event.currentTarget
  if (!props.disabled && target instanceof HTMLSelectElement) {
    emit('update:modelValue', target.value)
  }
}
</script>
