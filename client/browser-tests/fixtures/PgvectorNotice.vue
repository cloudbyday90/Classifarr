<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<script setup>
import { ref } from 'vue'
import PgvectorVariantBanner from '@/components/PgvectorVariantBanner.vue'

const loads = ref(0)
const submissions = ref(0)
const revision = ref(0)
async function loadStatus() {
  loads.value++
  return { enabled: true, pgvectorVariant: 'generic', pgvectorBuild: 'multi', cpuAvx: 'true', cpuAvx2: 'true' }
}
</script>
<template>
  <main class="p-6 max-w-lg">
    <h1>Pgvector compatibility notice fixture</h1>
    <form @submit.prevent="submissions++">
      <PgvectorVariantBanner
        :key="revision"
        :load-status="loadStatus"
      />
    </form>
    <button
      type="button"
      :onClick="() => revision++"
    >
      Remount sample notice
    </button>
    <output aria-label="Status loads">{{ loads }}</output>
    <output aria-label="Notice form submissions">{{ submissions }}</output>
  </main>
</template>
