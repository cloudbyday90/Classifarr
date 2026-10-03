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
    <div
      class="min-h-[42px] px-3 py-2 bg-background border border-gray-500 rounded-lg flex flex-wrap gap-2 items-center"
      :onClick="handleContainerClick"
      :onFocusout="handleFocusout"
      :onFocusin="handleFocusin"
    >
      <span
        v-for="(tag, index) in modelValue"
        :key="`${index}:${tag}`"
        class="inline-flex max-w-full items-center gap-1 px-2 py-1 bg-primary/20 text-primary-light text-sm rounded-sm"
      >
        <span class="min-w-0 wrap-anywhere">{{ tag }}</span>
        <button
          type="button"
          :disabled="disabled || readonly"
          :aria-label="`Remove ${tag}${label ? ` from ${label}` : ''}`"
          class="min-h-6 min-w-6 shrink-0 rounded-sm hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          :onClick="() => removeTag(tag)"
        ><span aria-hidden="true">×</span></button>
      </span>
      <input
        ref="inputRef"
        v-bind="controlAttrs(error, hint)"
        :value="draft"
        type="text"
        :disabled="disabled"
        :readonly="readonly"
        :placeholder="modelValue.length === 0 ? placeholder : ''"
        class="bg-transparent border-none rounded-sm text-white placeholder-gray-400 grow min-w-0 w-32 max-w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        :onInput="handleInput"
        :onKeydown="handleKeydown"
        :onCompositionstart="handleCompositionstart"
        :onCompositionend="handleCompositionend"
      >
      <button
        type="button"
        :disabled="disabled || readonly"
        :aria-label="label ? `Add tag to ${label}` : 'Add tag'"
        class="min-h-8 px-2 rounded-sm text-sm text-primary-light hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        :onClick="addFromButton"
      >
        Add tag
      </button>
    </div>
    <span
      v-if="hint"
      :id="hintId"
      class="text-xs text-gray-400"
    >{{ hint }}</span>
    <span
      v-if="error"
      :id="errorId"
      class="text-sm text-red-400"
    >{{ error }}</span>
    <span
      role="status"
      class="sr-only"
    >{{ status }}</span>
  </div>
</template>

<script setup>
import { useTemplateRef } from 'vue'
import { useFormControlAttrs } from '@/composables/useFormControlAttrs.js'
import { useTagInput } from '@/composables/useTagInput.js'

defineOptions({ inheritAttrs: false })
const { controlId, controlAttrs, layoutAttrs, hintId, errorId } = useFormControlAttrs()
const inputRef = useTemplateRef('inputRef')

const props = defineProps({
  modelValue: { type: /** @type {import('vue').PropType<string[]>} */ (Array), default: () => [] },
  label: { type: String, default: '' },
  placeholder: { type: String, default: 'Type and press Enter...' },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  hint: { type: String, default: 'Enter adds a tag. Backspace removes the last tag when the entry is empty.' },
  error: { type: String, default: '' },
})

const emit = defineEmits({
  'update:modelValue': /** @param {string[]} value */ (value) => Array.isArray(value) && value.every(tag => typeof tag === 'string'),
})
const {
  draft, status, handleInput, handleKeydown, handleFocusout, handleFocusin,
  handleCompositionstart, handleCompositionend, handleContainerClick,
  addFromButton, removeTag,
} = useTagInput({
  input: inputRef,
  getTags: () => props.modelValue,
  isLocked: () => props.disabled || props.readonly,
  onUpdate: tags => emit('update:modelValue', tags),
})
</script>
