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
import { onMounted, onUnmounted } from 'vue'
import Toast from '@/components/common/Toast.vue'
import { useServiceStatusStore } from '@/stores/serviceStatus'

// Main app component - just renders router views

// Initialize service status store and auto-refresh
const serviceStatusStore = useServiceStatusStore()

onMounted(() => {
  serviceStatusStore.startAutoRefresh()
})

onUnmounted(() => {
  serviceStatusStore.stopAutoRefresh()
})
</script>
