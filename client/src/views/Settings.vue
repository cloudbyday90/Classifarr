<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">Settings</h1>

    <!-- Tabs -->
    <div class="border-b border-gray-700">
      <nav class="-mb-px flex space-x-8">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="[
            'py-4 px-1 border-b-2 font-medium text-sm',
            activeTab === tab.id
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
          ]"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Tab Content -->
    <div class="mt-6">
      <component :is="currentTabComponent" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import General from './settings/General.vue'
import TMDB from './settings/TMDB.vue'
import Ollama from './settings/Ollama.vue'
import Radarr from './settings/Radarr.vue'
import Sonarr from './settings/Sonarr.vue'
import MediaServer from './settings/MediaServer.vue'
import Discord from './settings/Discord.vue'
import Webhooks from './settings/Webhooks.vue'
import Queue from './settings/Queue.vue'
import Scheduler from './settings/Scheduler.vue'
import Backup from './settings/Backup.vue'
import SSL from './settings/SSL.vue'
import Logs from './settings/Logs.vue'
import Confidence from './settings/Confidence.vue'

const router = useRouter()
const route = useRoute()
const activeTab = ref('general')

const tabs = [
  { id: 'general', label: 'General', component: General },
  { id: 'tmdb', label: 'TMDB', component: TMDB },
  { id: 'ollama', label: 'Ollama', component: Ollama },
  { id: 'radarr', label: 'Radarr', component: Radarr },
  { id: 'sonarr', label: 'Sonarr', component: Sonarr },
  { id: 'mediaserver', label: 'Media Server', component: MediaServer },
  { id: 'discord', label: 'Discord', component: Discord },
  { id: 'webhooks', label: 'Webhooks', component: Webhooks },
  { id: 'queue', label: 'Queue', component: Queue },
  { id: 'scheduler', label: 'Scheduler', component: Scheduler },
  { id: 'backup', label: 'Backup', component: Backup },
  { id: 'confidence', label: 'Confidence', component: Confidence },
  { id: 'ssl', label: 'SSL/HTTPS', component: SSL },
  { id: 'logs', label: 'Logs', component: Logs },
]

const currentTabComponent = computed(() => {
  return tabs.find(t => t.id === activeTab.value)?.component
})

// Initialize tab from URL query on mount
onMounted(() => {
  if (route.query.tab && tabs.some(t => t.id === route.query.tab)) {
    activeTab.value = route.query.tab
  }
})

// Update URL when tab changes
watch(activeTab, (newTab) => {
  router.replace({ query: { ...route.query, tab: newTab } })
})

// Update tab when URL changes (e.g. back button)
watch(() => route.query.tab, (newTab) => {
  if (newTab && tabs.some(t => t.id === newTab)) {
    activeTab.value = newTab
  }
})
</script>
