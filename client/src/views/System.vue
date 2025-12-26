<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold mb-2">System</h1>
      <p class="text-gray-400">Monitor system health and status.</p>
    </div>

    <!-- Health Checks -->
    <Card>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold">Health Status</h2>
          <Button variant="secondary" size="sm" @click="refreshHealth">
            <ArrowPathIcon class="w-4 h-4 mr-2" :class="{ 'animate-spin': refreshing }" />
            Refresh
          </Button>
        </div>
      </template>

      <div v-if="loadingHealth" class="text-center py-8">
        <Spinner />
        <p class="text-gray-400 mt-2">Checking health...</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          v-for="service in healthServices"
          :key="service.name"
          class="p-4 bg-background-light rounded-lg border border-gray-700"
        >
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-medium">{{ service.name }}</h3>
            <Badge :variant="getHealthBadgeVariant(service.status)">
              {{ service.status }}
            </Badge>
          </div>
          <p class="text-sm text-gray-400">{{ service.description }}</p>
          <div v-if="service.responseTime || service.lastCheck" class="mt-2 flex items-center gap-3 text-xs text-gray-500">
            <span v-if="service.responseTime">{{ service.responseTime }}ms</span>
            <span v-if="service.lastCheck">{{ formatLastCheck(service.lastCheck) }}</span>
          </div>
        </div>
      </div>
    </Card>

    <!-- System Info -->
    <Card>
      <template #header>
        <h2 class="text-xl font-semibold">System Information</h2>
      </template>

      <div v-if="loadingStatus" class="text-center py-8">
        <Spinner />
        <p class="text-gray-400 mt-2">Loading system info...</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 class="text-sm font-medium text-gray-400 mb-2">Application</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-400">Version:</span>
              <span>{{ systemStatus.version }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Uptime:</span>
              <span>{{ formatUptime(systemStatus.uptime) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Node.js:</span>
              <span>{{ systemStatus.nodeVersion }}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 class="text-sm font-medium text-gray-400 mb-2">System</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-400">Platform:</span>
              <span>{{ systemStatus.platform }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Architecture:</span>
              <span>{{ systemStatus.arch }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Memory Usage:</span>
              <span>{{ formatMemory(systemStatus.memoryUsage?.heapUsed) }}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- About -->
    <Card>
      <template #header>
        <h2 class="text-xl font-semibold">About Classifarr</h2>
      </template>

      <div class="space-y-4">
        <p class="text-gray-300">
          AI-powered media classification for the *arr ecosystem
        </p>
        
        <div class="flex space-x-4">
          <a 
            href="https://github.com/cloudbyday90/Classifarr"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:text-blue-400 transition-colors"
          >
            GitHub Repository →
          </a>
          <a 
            href="https://github.com/cloudbyday90/Classifarr/issues"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:text-blue-400 transition-colors"
          >
            Report Issue →
          </a>
        </div>

        <div class="text-sm text-gray-400">
          <p>Licensed under GPL-3.0</p>
          <p class="mt-1">Copyright (C) 2025 cloudbyday90</p>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ArrowPathIcon } from '@heroicons/vue/24/outline'
import Card from '@/components/common/Card.vue'
import Badge from '@/components/common/Badge.vue'
import Button from '@/components/common/Button.vue'
import Spinner from '@/components/common/Spinner.vue'
import api from '@/api'

const loadingHealth = ref(true)
const loadingStatus = ref(true)
const refreshing = ref(false)
const healthDetails = ref(null)

const healthServices = ref([
  { name: 'Database', key: 'database', status: 'unknown', description: 'PostgreSQL connection', responseTime: null, lastCheck: null },
  { name: 'Media Server', key: 'mediaServer', status: 'unknown', description: 'Plex/Jellyfin/Emby', responseTime: null, lastCheck: null },
  { name: 'Radarr', key: 'radarr', status: 'unknown', description: 'Movie management', responseTime: null, lastCheck: null },
  { name: 'Sonarr', key: 'sonarr', status: 'unknown', description: 'TV show management', responseTime: null, lastCheck: null },
  { name: 'AI Provider', key: 'ollama', status: 'unknown', description: 'Ollama/OpenAI/Anthropic', responseTime: null, lastCheck: null },
  { name: 'TMDB', key: 'tmdb', status: 'unknown', description: 'Movie/TV metadata', responseTime: null, lastCheck: null },
  { name: 'Discord Bot', key: 'discordBot', status: 'unknown', description: 'Notifications', responseTime: null, lastCheck: null },
  { name: 'Tavily', key: 'tavily', status: 'unknown', description: 'Web search (optional)', responseTime: null, lastCheck: null },
])

const systemStatus = ref({
  version: '1.0.0',
  uptime: 0,
  nodeVersion: 'N/A',
  platform: 'N/A',
  arch: 'N/A',
  memoryUsage: { heapUsed: 0 }
})

const loadHealth = async () => {
  try {
    const response = await api.getSystemHealth()
    
    if (response.data) {
      const statusMap = response.data
      healthDetails.value = statusMap.details || {}
      
      healthServices.value = [
        { 
          name: 'Database', 
          key: 'database',
          status: statusMap.database || 'unknown', 
          description: 'PostgreSQL connection',
          responseTime: healthDetails.value.database?.responseTime,
          lastCheck: healthDetails.value.database?.lastCheck
        },
        { 
          name: 'Media Server', 
          key: 'mediaServer',
          status: statusMap.mediaServer || 'unknown', 
          description: healthDetails.value.mediaServer?.type ? `${healthDetails.value.mediaServer.type} - ${healthDetails.value.mediaServer.name || ''}` : 'Plex/Jellyfin/Emby',
          responseTime: healthDetails.value.mediaServer?.responseTime,
          lastCheck: healthDetails.value.mediaServer?.lastCheck
        },
        { 
          name: 'Radarr', 
          key: 'radarr',
          status: statusMap.radarr || 'unknown', 
          description: healthDetails.value.radarr?.instances?.length ? `${healthDetails.value.radarr.instances.length} instance(s)` : 'Movie management',
          responseTime: healthDetails.value.radarr?.responseTime,
          lastCheck: healthDetails.value.radarr?.lastCheck
        },
        { 
          name: 'Sonarr', 
          key: 'sonarr',
          status: statusMap.sonarr || 'unknown', 
          description: healthDetails.value.sonarr?.instances?.length ? `${healthDetails.value.sonarr.instances.length} instance(s)` : 'TV show management',
          responseTime: healthDetails.value.sonarr?.responseTime,
          lastCheck: healthDetails.value.sonarr?.lastCheck
        },
        { 
          name: 'AI Provider', 
          key: 'ollama',
          status: statusMap.ollama || 'unknown', 
          description: healthDetails.value.ollama?.provider ? healthDetails.value.ollama.provider : 'Ollama/OpenAI/Anthropic',
          responseTime: healthDetails.value.ollama?.responseTime,
          lastCheck: healthDetails.value.ollama?.lastCheck
        },
        { 
          name: 'TMDB', 
          key: 'tmdb',
          status: statusMap.tmdb || 'unknown', 
          description: 'Movie/TV metadata',
          responseTime: healthDetails.value.tmdb?.responseTime,
          lastCheck: healthDetails.value.tmdb?.lastCheck
        },
        { 
          name: 'Discord Bot', 
          key: 'discordBot',
          status: statusMap.discordBot || 'unknown', 
          description: 'Notifications',
          responseTime: healthDetails.value.discordBot?.responseTime,
          lastCheck: healthDetails.value.discordBot?.lastCheck
        },
        { 
          name: 'Tavily', 
          key: 'tavily',
          status: statusMap.tavily || 'unknown', 
          description: 'Web search (optional)',
          responseTime: healthDetails.value.tavily?.responseTime,
          lastCheck: healthDetails.value.tavily?.lastCheck
        },
      ]
    }
  } catch (error) {
    console.error('Failed to load health status:', error)
  } finally {
    loadingHealth.value = false
    refreshing.value = false
  }
}

const loadStatus = async () => {
  try {
    const response = await api.getSystemStatus()
    
    if (response.data) {
      systemStatus.value = response.data
    }
  } catch (error) {
    console.error('Failed to load system status:', error)
  } finally {
    loadingStatus.value = false
  }
}

const refreshHealth = async () => {
  refreshing.value = true
  // Force refresh from backend
  try {
    await api.post('/system/health/refresh')
  } catch (e) {
    // Fallback to regular load
  }
  await loadHealth()
}

const getHealthBadgeVariant = (status) => {
  if (status === 'connected') return 'success'
  if (status === 'partial') return 'warning'
  if (status === 'configured') return 'warning'
  if (status === 'disconnected' || status === 'error') return 'error'
  if (status === 'not configured') return 'default'
  return 'default'
}

const formatLastCheck = (isoString) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString()
}

const formatUptime = (seconds) => {
  if (!seconds) return 'N/A'
  
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

const formatMemory = (bytes) => {
  if (!bytes) return 'N/A'
  
  const mb = bytes / 1024 / 1024
  return `${mb.toFixed(0)} MB`
}

onMounted(() => {
  loadHealth()
  loadStatus()
})
</script>
