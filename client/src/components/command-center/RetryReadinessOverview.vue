<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="retry-overview">
    <label for="retry-provider">Retry provider</label>
    <select
      id="retry-provider"
      v-model="scope"
    >
      <option value="web_search">
        Web search
      </option>
      <option value="omdb">
        OMDb
      </option>
    </select>
    <RetryReadinessSummary
      :key="scope"
      :scope="scope"
      :initial-paused="paused"
      @pause-change="paused = $event"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import RetryReadinessSummary from './RetryReadinessSummary.vue'
const scope = ref('web_search'), paused = ref(false)
</script>

<style scoped>
label { color: #e2e8f0; margin-right: .75rem; }
select { background: #1f2937; color: #f8fafc; border: 1px solid #94a3b8; border-radius: .375rem; padding: .5rem; margin-bottom: .75rem; max-width: 100%; }
select:focus-visible { outline: 3px solid #93c5fd; outline-offset: 3px; }
</style>
