<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<script setup>
import PgvectorStartupPanel from '@/components/system/PgvectorStartupPanel.vue'

const mode = new globalThis.URLSearchParams(globalThis.location.search).get('mode')
const pgvector = { selection: {
  status: mode === 'stale' ? 'other_process' : 'current_process',
  report: {
    schemaVersion: 1, databaseScope: 'embedded_entrypoint', build: 'multi',
    selectedVariant: mode === 'generic' ? 'generic' : 'avx2',
    cpuAvx: 'true', cpuAvx2: mode === 'mismatch' ? 'false' : mode === 'unknown' ? 'unknown' : 'true',
    reason: mode === 'generic' ? 'staging_disabled' : 'optimized_staged',
    reporterId: '12345678-1234-4567-8123-123456789abc',
    selectedAt: '2026-10-12T14:58:00.000Z', recordedAt: '2026-10-12T15:00:00.000Z',
    databaseStartedAt: '2026-10-12T14:59:00.000Z',
  },
} }
</script>
<template>
  <main class="p-6 max-w-4xl">
    <h1 class="text-xl mb-4">
      Startup compatibility fixture
    </h1>
    <PgvectorStartupPanel
      :pgvector="pgvector"
      version="0.8.1"
    />
  </main>
</template>
