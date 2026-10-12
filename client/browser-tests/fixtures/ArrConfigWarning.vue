<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import ArrConfigWarning from '@/components/settings/ArrConfigWarning.vue'

const route = useRoute()
const loads = ref(0)
const submissions = ref(0)
async function loadStatus() {
  loads.value++
  return { incompleteConfigs: [
    { id: 1, type: 'Radarr', name: 'Sample movies', missingField: 'quality_profile_id' },
    { id: 1, type: 'Sonarr', name: 'Sample TV', missingField: 'quality_profile_id' },
    { id: 2, type: 'Unknown', name: 'Unsupported provider', missingField: 'quality_profile_id' },
  ] }
}
</script>

<template>
  <main class="p-6 max-w-lg">
    <h1>Arr configuration warning fixture</h1>
    <form @submit.prevent="submissions++">
      <ArrConfigWarning :load-status="loadStatus" />
    </form>
    <output aria-label="Current route">{{ route.path }}</output>
    <output aria-label="Status loads">{{ loads }}</output>
    <output aria-label="Warning form submissions">{{ submissions }}</output>
  </main>
</template>
