<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="flex flex-col gap-2" ref="componentRef">
    <label v-if="label" class="text-sm font-medium">{{ label }}</label>
    <div class="relative">
      <div
        @click="open = !open"
        @keydown.escape="open = false"
        @keydown.enter="open = !open"
        tabindex="0"
        class="min-h-[42px] px-3 py-2 bg-background border border-gray-700 rounded-lg cursor-pointer flex flex-wrap gap-2 items-center"
        :class="{ 'border-primary': open }"
      >
        <span
          v-for="value in modelValue"
          :key="value"
          class="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary text-sm rounded"
        >
          {{ getLabel(value) }}
          <button @click.stop="remove(value)" class="hover:text-white">×</button>
        </span>
        <span v-if="modelValue.length === 0" class="text-gray-500">{{ placeholder }}</span>
      </div>
      
      <div
        v-if="open"
        class="absolute z-50 w-full mt-1 bg-background-light border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto"
      >
        <div
          v-for="option in availableOptions"
          :key="option.value"
          @click="select(option.value)"
          class="px-4 py-2 hover:bg-primary/20 cursor-pointer flex items-center gap-2"
        >
          <span class="w-4 h-4 border border-gray-600 rounded flex items-center justify-center"
                :class="isSelected(option.value) ? 'bg-primary border-primary' : ''">
            <span v-if="isSelected(option.value)" class="text-white text-xs">✓</span>
          </span>
          {{ option.label }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  options: { type: Array, required: true },
  label: { type: String, default: '' },
  placeholder: { type: String, default: 'Select options...' }
})

const emit = defineEmits(['update:modelValue'])
const open = ref(false)
const componentRef = ref(null)

const availableOptions = computed(() => props.options)

const isSelected = (value) => props.modelValue.includes(value)
const getLabel = (value) => props.options.find(o => o.value === value)?.label || value

const select = (value) => {
  if (isSelected(value)) {
    emit('update:modelValue', props.modelValue.filter(v => v !== value))
  } else {
    emit('update:modelValue', [...props.modelValue, value])
  }
}

const remove = (value) => {
  emit('update:modelValue', props.modelValue.filter(v => v !== value))
}

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (componentRef.value && !componentRef.value.contains(event.target)) {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>
