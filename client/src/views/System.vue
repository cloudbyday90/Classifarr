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
      <p class="text-gray-400">Monitor system health and view logs</p>
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

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

    <!-- Recent Logs -->
    <Card>
      <template #header>
        <h2 class="text-xl font-semibold">Recent Logs</h2>
      </template>

      <div v-if="loadingLogs" class="text-center py-8">
        <Spinner />
        <p class="text-gray-400 mt-2">Loading logs...</p>
      </div>

      <div v-else-if="logs.length === 0" class="text-center py-8 text-gray-400">
        <DocumentTextIcon class="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No logs available</p>
      </div>

      <div v-else class="space-y-1 max-h-96 overflow-y-auto">
        <div 
          v-for="log in logs"
          :key="log.id"
          class="p-3 bg-background-light rounded border border-gray-700 text-sm font-mono"
        >
          <div class="flex items-start space-x-3">
            <span class="text-gray-500 flex-shrink-0">{{ formatLogTime(log.timestamp) }}</span>
            <span class="flex-1 text-gray-300">{{ log.message }}</span>
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
import { ArrowPathIcon, DocumentTextIcon } from '@heroicons/vue/24/outline'
import Card from '@/components/common/Card.vue'
import Badge from '@/components/common/Badge.vue'
import Button from '@/components/common/Button.vue'
import Spinner from '@/components/common/Spinner.vue'
import api from '@/api'

const loadingHealth = ref(true)
const loadingStatus = ref(true)
const loadingLogs = ref(true)
const refreshing = ref(false)

const healthServices = ref([
  { name: 'Database', status: 'unknown', description: 'PostgreSQL connection' },
  { name: 'Discord Bot', status: 'unknown', description: 'Discord notification service' },
  { name: 'Ollama', status: 'unknown', description: 'AI inference engine' },
  { name: 'Radarr', status: 'unknown', description: 'Movie management' },
  { name: 'Sonarr', status: 'unknown', description: 'TV show management' },
  { name: 'Media Server', status: 'unknown', description: 'Plex/Jellyfin/Emby' },
])

const systemStatus = ref({
  version: '1.0.0',
  uptime: 0,
  nodeVersion: 'N/A',
  platform: 'N/A',
  arch: 'N/A',
  memoryUsage: { heapUsed: 0 }
})

const logs = ref([])

const loadHealth = async () => {
  try {
    const response = await api.get('/system/health')
    
    if (response.data) {
      const statusMap = response.data
      healthServices.value = [
        { name: 'Database', status: statusMap.database || 'unknown', description: 'PostgreSQL connection' },
        { name: 'Discord Bot', status: statusMap.discordBot || 'unknown', description: 'Discord notification service' },
        { name: 'Ollama', status: statusMap.ollama || 'unknown', description: 'AI inference engine' },
        { name: 'Radarr', status: statusMap.radarr || 'unknown', description: 'Movie management' },
        { name: 'Sonarr', status: statusMap.sonarr || 'unknown', description: 'TV show management' },
        { name: 'Media Server', status: statusMap.mediaServer || 'unknown', description: 'Plex/Jellyfin/Emby' },
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
    const response = await api.get('/system/status')
    
    if (response.data) {
      systemStatus.value = response.data
    }
  } catch (error) {
    console.error('Failed to load system status:', error)
  } finally {
    loadingStatus.value = false
  }
}

const loadLogs = async () => {
  try {
    const response = await api.get('/system/logs', {
      params: { limit: 50 }
    })
    
    if (response.data?.logs) {
      logs.value = response.data.logs
    }
  } catch (error) {
    console.error('Failed to load logs:', error)
  } finally {
    loadingLogs.value = false
  }
}

const refreshHealth = async () => {
  refreshing.value = true
  await loadHealth()
}

const getHealthBadgeVariant = (status) => {
  if (status === 'connected') return 'success'
  if (status === 'configured') return 'warning'
  if (status === 'disconnected') return 'error'
  return 'default'
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

const formatLogTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

onMounted(() => {
  loadHealth()
  loadStatus()
  loadLogs()
})
</script>
