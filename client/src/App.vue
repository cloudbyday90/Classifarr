<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <router-view />
  <Toast />
</template>

<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import Toast from '@/components/common/Toast.vue'
import { useServiceStatusStore } from '@/stores/serviceStatus'

// Main app component - just renders router views

// Initialize service status store and auto-refresh
const serviceStatusStore = useServiceStatusStore()
const route = useRoute()

const PUBLIC_ROUTE_NAMES = new Set(['Login', 'SetupAccount', 'SetupWizard'])

function syncServiceStatusPolling(routeName) {
  if (!routeName || PUBLIC_ROUTE_NAMES.has(routeName)) {
    serviceStatusStore.stopAutoRefresh()
    return
  }

  serviceStatusStore.startAutoRefresh()
}

onMounted(() => {
  syncServiceStatusPolling(route?.name)
})

watch(
  () => route?.name,
  (routeName) => {
    syncServiceStatusPolling(routeName)
  }
)

onUnmounted(() => {
  serviceStatusStore.stopAutoRefresh()
})
</script>
