<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<script setup>
import { ref, computed } from 'vue'
import SystemHealthSummary from '../../src/components/system/SystemHealthSummary.vue'
import HealthFreshnessNote from '../../src/components/system/HealthFreshnessNote.vue'
import PgvectorStartupPanel from '../../src/components/system/PgvectorStartupPanel.vue'
const pgvector = { selection: { status: 'current_process', report: {
  schemaVersion: 1, databaseScope: 'embedded_entrypoint', build: 'multi',
  selectedVariant: 'avx2', cpuAvx: true, cpuAvx2: true,
  reporterId: '12345678-1234-4567-8123-123456789abc', recordedAt: '2026-10-12T15:00:00.000Z',
} } }
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
    <section class="mt-6 p-6 rounded-lg bg-background-light border border-gray-700">
      <h2 class="text-xl font-semibold mb-4">
        System Information
      </h2>
      <PgvectorStartupPanel
        :pgvector="pgvector"
        version="0.8.7"
      />
    </section>
  </main>
</template>
