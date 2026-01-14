<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div v-if="hasIncompleteConfigs" class="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4 mb-6">
    <div class="flex items-start gap-3">
      <span class="text-2xl">⚠️</span>
      <div class="flex-1">
        <h3 class="font-semibold text-yellow-400 mb-2">Incomplete Configuration Detected</h3>
        <div v-for="config in incompleteConfigs" :key="`${config.type}-${config.id}`" class="mb-2">
          <p class="text-sm text-gray-300">
            Your <strong>{{ config.name }}</strong> configuration is missing a Quality Profile. 
            Content won't be added to {{ config.type }} until you select one.
          </p>
          <button
            @click="navigateToConfig(config.type)"
            class="mt-2 text-sm px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 rounded-md transition-colors font-medium"
          >
            Configure {{ config.type }} Now
          </button>
        </div>
      </div>
      <button
        @click="dismiss"
        class="text-gray-400 hover:text-white transition-colors"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api'

const router = useRouter()
const hasIncompleteConfigs = ref(false)
const incompleteConfigs = ref([])
const dismissed = ref(false)

onMounted(async () => {
  await checkIncompleteConfigs()
})

const checkIncompleteConfigs = async () => {
  if (dismissed.value) return
  
  try {
    const response = await api.genericRequest('get', '/api/settings/arr-config-status')
    if (response.data && response.data.incompleteConfigs) {
      incompleteConfigs.value = response.data.incompleteConfigs
      hasIncompleteConfigs.value = incompleteConfigs.value.length > 0
    }
  } catch (error) {
    console.error('Failed to check arr config status:', error)
    // Silently fail - this is a non-critical feature
  }
}

const navigateToConfig = (arrType) => {
  const route = arrType === 'Radarr' ? '/settings/radarr' : '/settings/sonarr'
  router.push(route)
}

const dismiss = () => {
  dismissed.value = true
  hasIncompleteConfigs.value = false
}
</script>
