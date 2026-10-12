<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<script setup>
import { ref, computed } from 'vue'
import SystemHealthSummary from '../../src/components/system/SystemHealthSummary.vue'
const mode = ref('unknown')
const services = computed(() => (mode.value === 'unknown' ? ['healthy', 'unknown']
  : mode.value === 'inactive' ? ['disabled', 'not_configured'] : ['healthy', 'disabled']).map(status => ({ status })))
</script>
<template>
  <main class="p-4 max-w-4xl mx-auto">
    <h1 class="text-2xl mb-4">
      System health
    </h1>
    <SystemHealthSummary
      :services="services"
      :available="mode !== 'failed'"
      received-at="2026-10-12T15:00:00.000Z"
    />
    <div class="flex flex-wrap gap-4">
      <button
        v-for="option in ['unknown', 'inactive', 'healthy', 'failed']"
        :key="option"
        class="border p-2"
        @click="mode = option"
      >
        {{ option }}
      </button>
    </div>
  </main>
</template>
