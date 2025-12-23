<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="bg-background-light rounded-lg border border-gray-800 p-6">
    <div v-if="$slots.header || title" class="mb-4">
      <slot name="header">
        <div v-if="title">
          <h3 class="text-lg font-semibold">{{ title }}</h3>
          <p v-if="description" class="text-sm text-gray-400 mt-1">{{ description }}</p>
        </div>
      </slot>
    </div>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
})
</script>
