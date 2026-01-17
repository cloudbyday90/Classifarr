<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div v-if="hasWarning" class="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-lg">
    <div class="flex items-start gap-4">
      <span class="text-2xl">⚠️</span>
      <div class="flex-1">
        <h3 class="font-semibold text-warning mb-1">{{ notification.title }}</h3>
        <p class="text-sm text-gray-300 mb-3">{{ notification.message }}</p>
        <div class="flex gap-2">
          <Button size="sm" variant="warning" @click="goToRadarr">
            Configure Radarr
          </Button>
          <Button size="sm" variant="warning" @click="goToSonarr">
            Configure Sonarr
          </Button>
          <Button size="sm" variant="ghost" @click="dismiss">
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api'
import Button from '@/components/common/Button.vue'

// HTTP status codes
const HTTP_NOT_FOUND = 404

const router = useRouter()
const notification = ref(null)
const hasWarning = ref(false)

onMounted(async () => {
  try {
    const response = await api.get('/notifications/active')
    const mappingWarning = response.data.find(
      n => n.type === 'warning' && n.title?.toLowerCase().includes('mapping')
    )
    if (mappingWarning) {
      notification.value = mappingWarning
      hasWarning.value = true
    }
  } catch (error) {
    // Expected: 404 indicates notification system not yet implemented or no notifications
    // Unexpected: Other errors may indicate API issues that should be logged
    if (error.response?.status !== HTTP_NOT_FOUND) {
      console.warn('Failed to fetch notifications', error)
    }
  }
})

const goToRadarr = () => router.push('/settings?tab=radarr')
const goToSonarr = () => router.push('/settings?tab=sonarr')
const dismiss = async () => {
  try {
    if (notification.value?.id) {
      await api.post(`/notifications/${notification.value.id}/dismiss`)
    }
    hasWarning.value = false
  } catch (error) {
    console.error('Failed to dismiss notification', error)
    // Still hide the banner locally
    hasWarning.value = false
  }
}
</script>
