<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div v-if="show" class="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-lg">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 class="font-semibold text-warning mb-1">pgvector running in generic mode</h3>
        <p class="text-sm text-gray-300">
          RAG is enabled, but pgvector is using the generic (non-AVX) binary for CPU compatibility.
          This is normal on older CPUs. If your CPU supports AVX, restart to enable the AVX-optimized
          binary for faster similarity search.
        </p>
      </div>
      <Button size="sm" variant="warning" @click="dismiss">Dismiss</Button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import Button from '@/components/common/Button.vue'

const show = ref(false)
const dismissedKey = 'pgvectorVariantBannerDismissed'

const dismiss = () => {
  show.value = false
  sessionStorage.setItem(dismissedKey, 'true')
}

onMounted(async () => {
  if (sessionStorage.getItem(dismissedKey) === 'true') {
    return
  }

  try {
    const response = await api.getRagStatus()
    if (response.data?.pgvectorVariant === 'generic') {
      show.value = true
    }
  } catch {
    // Ignore banner if status call fails
  }
})
</script>
