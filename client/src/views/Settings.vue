<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-[calc(100vh-200px)]">
    <!-- Sidebar Navigation - Horizontal scroll on mobile, vertical on desktop -->
    <nav class="lg:w-56 flex-shrink-0">
      <!-- Mobile: Horizontal scrollable tabs -->
      <div class="lg:hidden overflow-x-auto pb-2 -mx-4 px-4">
        <div class="flex gap-2 min-w-max">
          <template v-for="group in settingsGroups" :key="group.name">
            <template v-for="tab in group.tabs" :key="tab.id">
              <router-link
                v-if="tab.isLink"
                :to="tab.path"
                :class="[
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap',
                  $route.path === tab.path
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                ]"
              >
                <span>{{ tab.icon }}</span>
                <span>{{ tab.label }}</span>
              </router-link>
              <button
                v-else
                @click="activeTab = tab.id"
                :class="[
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap',
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                ]"
              >
                <span>{{ tab.icon }}</span>
                <span>{{ tab.label }}</span>
              </button>
            </template>
          </template>
        </div>
      </div>

      <!-- Desktop: Vertical sidebar with independent scroll -->
      <div class="hidden lg:block sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto pr-2">
        <h1 class="text-2xl font-bold px-3 mb-4">Settings</h1>
        
        <!-- Grouped Settings -->
        <div v-for="group in settingsGroups" :key="group.name" class="space-y-1 mb-4">
          <h2 class="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {{ group.name }}
          </h2>
          <template v-for="tab in group.tabs" :key="tab.id">
            <router-link
              v-if="tab.isLink"
              :to="tab.path"
              :class="[
                'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                $route.path === tab.path
                  ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              ]"
            >
              <span>{{ tab.icon }}</span>
              <span>{{ tab.label }}</span>
            </router-link>
            <button
              v-else
              @click="activeTab = tab.id"
              :class="[
                'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                activeTab === tab.id
                  ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              ]"
            >
              <span>{{ tab.icon }}</span>
              <span>{{ tab.label }}</span>
            </button>
          </template>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="flex-1 min-w-0 overflow-x-auto">
      <component :is="currentTabComponent" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import General from './settings/General.vue'
import TMDB from './settings/TMDB.vue'
import AI from './settings/AI.vue'
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
import Tavily from './settings/Tavily.vue'
import OMDb from './settings/OMDb.vue'
import RatingNormalization from './settings/RatingNormalization.vue'
import RAGSettings from './RAGSettings.vue'

const router = useRouter()
const route = useRoute()
const activeTab = ref('general')

// Grouped settings for better organization
const settingsGroups = [
  {
    name: 'General',
    tabs: [
      { id: 'general', label: 'General', icon: '⚙️', component: General },
      { id: 'scheduler', label: 'Scheduler', icon: '🕐', component: Scheduler },
      { id: 'queue', label: 'Queue', icon: '📋', component: Queue },
    ]
  },
  {
    name: 'Connections',
    tabs: [
      { id: 'mediaserver', label: 'Media Server', icon: '🖥️', component: MediaServer },
      { id: 'radarr', label: 'Radarr', icon: '🎬', component: Radarr },
      { id: 'sonarr', label: 'Sonarr', icon: '📺', component: Sonarr },
    ]
  },
  {
    name: 'Metadata',
    tabs: [
      { id: 'tmdb', label: 'TMDB', icon: '🎞️', component: TMDB },
      { id: 'omdb', label: 'OMDb', icon: '🎬', component: OMDb },
      { id: 'tavily', label: 'Tavily', icon: '🔍', component: Tavily },
      { id: 'rating-normalization', label: 'Rating Normalization', icon: '⭐', component: RatingNormalization },
    ]
  },
  {
    name: 'Classification',
    tabs: [
      { id: 'ai', label: 'AI', icon: '🤖', component: AI },
      { id: 'confidence', label: 'Confidence', icon: '📊', component: Confidence },
      { id: 'rag', label: 'RAG & Embeddings', icon: '🧠', component: RAGSettings },
    ]
  },
  {
    name: 'Notifications',
    tabs: [
      { id: 'discord', label: 'Discord', icon: '💬', component: Discord },
      { id: 'webhooks', label: 'Webhooks', icon: '🔗', component: Webhooks },
    ]
  },
  {
    name: 'System',
    tabs: [
      { id: 'backup', label: 'Backup', icon: '💾', component: Backup },
      { id: 'ssl', label: 'SSL/HTTPS', icon: '🔒', component: SSL },
      { id: 'logs', label: 'Logs', icon: '📝', component: Logs },
    ]
  }
]

// Flatten tabs for lookup
const allTabs = settingsGroups.flatMap(g => g.tabs)

const currentTabComponent = computed(() => {
  return allTabs.find(t => t.id === activeTab.value)?.component
})

// Initialize tab from URL query on mount
onMounted(() => {
  if (route.query.tab && allTabs.some(t => t.id === route.query.tab)) {
    activeTab.value = route.query.tab
  }
})

// Update URL when tab changes
watch(activeTab, (newTab) => {
  router.replace({ query: { ...route.query, tab: newTab } })
})

// Update tab when URL changes (e.g. back button)
watch(() => route.query.tab, (newTab) => {
  if (newTab && allTabs.some(t => t.id === newTab)) {
    activeTab.value = newTab
  }
})
</script>

