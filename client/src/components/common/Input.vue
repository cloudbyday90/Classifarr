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
    <input
      v-bind="controlAttrs(error)"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :maxlength="maxLength || undefined"
      :disabled="disabled"
      class="px-4 py-2 bg-background border border-gray-700 rounded-lg focus:outline-hidden focus:border-primary transition-colors disabled:opacity-50"
      :onInput="handleInput"
    >
    <span
      v-if="error"
      :id="errorId"
      class="text-sm text-error"
    >{{ error }}</span>
  </div>
</template>

<script setup>
import { useFormControlAttrs } from '@/composables/useFormControlAttrs.js'

defineOptions({ inheritAttrs: false })
const { controlId, controlAttrs, layoutAttrs, errorId } = useFormControlAttrs()

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
  type: {
    type: String,
    default: 'text',
  },
  label: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
  maxLength: {
    type: Number,
    default: null,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
})

const emit = defineEmits({
  'update:modelValue': /** @param {string} value */ (value) => typeof value === 'string',
})

/** @param {Event} event */
function handleInput(event) {
  const target = event.currentTarget
  if (!props.disabled && target instanceof HTMLInputElement) {
    emit('update:modelValue', target.value)
  }
}
</script>
