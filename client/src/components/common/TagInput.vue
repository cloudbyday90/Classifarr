<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="flex flex-col gap-2">
    <label v-if="label" class="text-sm font-medium">{{ label }}</label>
    <div 
      class="min-h-[42px] px-3 py-2 bg-background border border-gray-700 rounded-lg flex flex-wrap gap-2 items-center focus-within:border-primary"
      @click="focusInput"
    >
      <span
        v-for="tag in modelValue"
        :key="tag"
        class="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary text-sm rounded"
      >
        {{ tag }}
        <button @click.stop="remove(tag)" class="hover:text-white">×</button>
      </span>
      <input
        ref="inputRef"
        v-model="inputValue"
        @keydown.enter.prevent="addTag"
        @keydown.backspace="handleBackspace"
        @blur="addTag"
        type="text"
        :placeholder="modelValue.length === 0 ? placeholder : ''"
        class="bg-transparent border-none outline-none text-white placeholder-gray-500 flex-grow min-w-[120px]"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  label: { type: String, default: '' },
  placeholder: { type: String, default: 'Type and press Enter...' }
})

const emit = defineEmits(['update:modelValue'])
const inputValue = ref('')
const inputRef = ref(null)

const focusInput = () => {
  inputRef.value?.focus()
}

const addTag = () => {
  const value = inputValue.value.trim()
  if (value && !props.modelValue.includes(value)) {
    emit('update:modelValue', [...props.modelValue, value])
  }
  inputValue.value = ''
}

const remove = (tag) => {
  emit('update:modelValue', props.modelValue.filter(t => t !== tag))
}

const handleBackspace = (e) => {
  if (!inputValue.value && props.modelValue.length > 0) {
    // Remove last tag if input is empty
    const newTags = [...props.modelValue]
    newTags.pop()
    emit('update:modelValue', newTags)
  }
}
</script>
