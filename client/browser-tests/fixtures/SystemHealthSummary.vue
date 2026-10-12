<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<script setup>
import { ref, computed } from 'vue'
import SystemHealthSummary from '../../src/components/system/SystemHealthSummary.vue'
import HealthFreshnessNote from '../../src/components/system/HealthFreshnessNote.vue'
const mode = ref('unknown')
const services = computed(() => (['unknown', 'overdue'].includes(mode.value) ? ['healthy', 'unknown']
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
      :heartbeat-active="mode !== 'overdue'"
      :interval-ms="900000"
      received-at="2026-10-12T15:00:00.000Z"
    />
    <HealthFreshnessNote
      v-if="mode === 'overdue'"
      state="stale"
      reason="check_overdue"
      observed-status="unhealthy"
      checked-at="2026-10-12T12:00:00.000Z"
      expires-at="2026-10-12T12:15:30.000Z"
    />
    <div class="flex flex-wrap gap-4">
      <button
        v-for="option in ['unknown', 'inactive', 'healthy', 'failed', 'overdue']"
        :key="option"
        class="border p-2"
        @click="mode = option"
      >
        {{ option }}
      </button>
    </div>
  </main>
</template>
