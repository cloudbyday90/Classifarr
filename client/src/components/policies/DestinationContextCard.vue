<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <header>
    <p class="text-xs font-semibold uppercase tracking-wide text-primary">
      Policy setup
    </p>
    <h4
      id="policy-builder-workflow-title"
      class="mt-1 text-lg font-semibold text-white"
    >
      {{ title }}
    </h4>
    <p class="mt-1 max-w-3xl text-sm text-gray-300">
      {{ summary }}
    </p>
  </header>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  summary: {
    type: String,
    required: true,
  },
})
</script>
