<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="inline-flex items-center justify-center" :class="sizeClass">
    <svg class="animate-spin" :class="[sizeClass, colorClass]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span v-if="text" class="ml-2" :class="colorClass">{{ text }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  size: { type: String, default: 'md' }, // sm, md, lg, xl
  color: { type: String, default: 'primary' }, // primary, white, gray
  text: { type: String, default: '' }
})

const sizeClass = computed(() => ({
  'sm': 'w-4 h-4',
  'md': 'w-6 h-6',
  'lg': 'w-8 h-8',
  'xl': 'w-12 h-12'
}[props.size]))

const colorClass = computed(() => ({
  'primary': 'text-primary',
  'white': 'text-white',
  'gray': 'text-gray-400'
}[props.color]))
</script>
