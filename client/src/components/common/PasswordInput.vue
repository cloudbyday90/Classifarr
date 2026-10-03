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
    <div class="relative">
      <input
        ref="input"
        v-bind="controlAttrs(error, hint)"
        :type="visible ? 'text' : 'password'"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :autocomplete="autocomplete"
        spellcheck="false"
        autocorrect="off"
        autocapitalize="none"
        data-lpignore="true"
        data-1pass-no-save="true"
        class="w-full px-4 py-2 pr-20 bg-background border border-gray-500 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors disabled:opacity-50"
        :onInput="handleInput"
      >
      <button
        v-bind="visibilityAttrs()"
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 min-h-8 min-w-12 px-2 rounded-sm text-sm text-gray-300 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        :disabled="disabled"
        :aria-controls="controlId()"
        :onClick="toggle"
      >
        <span :id="actionId">{{ visible ? 'Hide' : 'Show' }}</span>
      </button>
    </div>
    <span
      v-if="error"
      :id="errorId"
      class="text-sm text-red-400"
    >{{ error }}</span>
    <span
      v-if="hint"
      :id="hintId"
      class="text-xs text-gray-400"
    >{{ hint }}</span>
  </div>
</template>

<script setup>
import { useId, useTemplateRef } from 'vue'
import { useFormControlAttrs } from '@/composables/useFormControlAttrs.js'
import { usePasswordVisibility } from '@/composables/usePasswordVisibility.js'

defineOptions({ inheritAttrs: false })
const { controlId, controlAttrs, layoutAttrs, errorId, hintId } = useFormControlAttrs()
const actionId = useId()
const input = useTemplateRef('input')

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
  autocomplete: { type: String, default: 'off' }
})
const emit = defineEmits({
  'update:modelValue': /** @param {string} value */ (value) => typeof value === 'string',
})

const { visible, toggle } = usePasswordVisibility(input, () => props.disabled)

/** @param {Event} event */
function handleInput(event) {
  const target = event.currentTarget
  if (!props.disabled && target instanceof HTMLInputElement && !target.readOnly) {
    emit('update:modelValue', target.value)
  }
}

function visibilityAttrs() {
  const attrs = controlAttrs()
  const labelledBy = attrs['aria-labelledby']
  if (typeof labelledBy === 'string' && labelledBy.trim()) {
    return { 'aria-labelledby': `${actionId} ${labelledBy.trim()}` }
  }
  const ariaLabel = attrs['aria-label']
  const name = typeof ariaLabel === 'string' && ariaLabel.trim() ? ariaLabel : props.label || 'password'
  return { 'aria-label': `${visible.value ? 'Hide' : 'Show'} ${name}` }
}
</script>
