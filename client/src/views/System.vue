<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
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
          <Button variant="secondary" size="sm" @click="refreshHealth" :disabled="refreshing">
            <ArrowPathIcon class="w-4 h-4 mr-2" :class="{ 'animate-spin': refreshing }" />
            Refresh
          </Button>
        </div>
      </template>

      <!-- Error Banner -->
      <div v-if="error" class="p-4 bg-red-900/30 border border-red-700 rounded-lg mb-4">
        <div class="flex items-center gap-3">
          <span class="text-2xl">⚠️</span>
          <div class="flex-1">
            <div class="font-semibold text-red-400">Failed to load health status</div>
            <div class="text-sm text-gray-400">{{ error }}</div>
          </div>
          <button @click="refreshHealth" class="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
            Retry
          </button>
        </div>
      </div>

      <!-- Overall Status Banner -->
      <div v-if="overallHealth && !loadingHealth" class="p-4 rounded-lg border transition-all mb-4"
           :class="[getStatusConfig(overallHealth.status).bgClass, getStatusConfig(overallHealth.status).borderClass]">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-4xl">{{ getStatusConfig(overallHealth.status).icon }}</span>
            <div>
              <div class="text-xl font-semibold">{{ overallHealth.message }}</div>
              <div class="text-sm opacity-90 mt-1">
                {{ overallHealth.healthy }} of {{ overallHealth.total }} services operational
                <span v-if="lastUpdated" class="text-xs ml-2">• {{ formatLastUpdated(lastUpdated) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Filter/Search Section -->
      <div class="flex gap-3 mb-4">
        <input v-model="searchQuery" placeholder="Search services..." aria-label="Search services"
               class="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-hidden focus:border-blue-500" />
        <select v-model="statusFilter" aria-label="Filter by status"
                class="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-hidden focus:border-blue-500">
          <option value="">All Status</option>
          <option value="healthy">Healthy Only</option>
          <option value="degraded">Degraded Only</option>
          <option value="unhealthy">Issues Only</option>
          <option value="not_configured">Not Configured</option>
        </select>
      </div>

      <!-- Loading Skeleton -->
      <div v-if="loadingHealth && !healthServices.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="i in 9" :key="i" class="p-4 bg-background-light rounded-lg border border-gray-700 animate-pulse">
          <div class="h-4 bg-gray-700 rounded-sm w-3/4 mb-3"></div>
          <div class="h-3 bg-gray-800 rounded-sm w-1/2 mb-2"></div>
          <div class="h-3 bg-gray-800 rounded-sm w-2/3"></div>
        </div>
      </div>

      <!-- Service Cards -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div 
          v-for="service in filteredServices"
          :key="service.name"
          v-tooltip="getServiceTooltip(service)"
          :data-testid="`service-card-${service.key}`"
          class="p-4 bg-background-light rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="text-xl">{{ getServiceIcon(service.name) }}</span>
              <h3 class="font-medium">{{ service.name }}</h3>
            </div>
            <div class="flex items-center gap-1">
              <span :class="getStatusConfig(service.status).dotClass" class="w-2 h-2 rounded-full"></span>
              <Badge :variant="getStatusConfig(service.status).badgeVariant">
                {{ getStatusConfig(service.status).label }}
              </Badge>
            </div>
          </div>
          <p class="text-sm text-gray-400">{{ service.description }}</p>
          
          <!-- Latency and Last Check -->
          <div v-if="service.responseTime != null || service.lastCheck" class="mt-2 flex items-center gap-3 text-xs text-gray-500">
            <span v-if="service.responseTime != null" :class="getLatencyClass(service.responseTime)">
              {{ service.responseTime }}ms
            </span>
            <span v-if="service.lastCheck">{{ formatLastCheck(service.lastCheck) }}</span>
          </div>

          <!-- Queue Worker Metadata -->
          <div v-if="service.key === 'queueWorker' && service.metadata" class="mt-2 text-xs text-gray-400">
            <div>Processing: {{ service.metadata.processing || 0 }}</div>
            <div>Pending: {{ service.metadata.pending || 0 }}</div>
          </div>

          <!-- Error Details -->
          <div v-if="service.error" class="mt-2 p-2 bg-red-900/20 border border-red-800 rounded-sm text-xs text-red-400">
            {{ service.error }}
          </div>

          <!-- Instance Details for Radarr/Sonarr -->
          <div v-if="service.instances && service.instances.length > 0" class="mt-3">
            <button 
              @click="toggleInstanceDetails(service.key)"
              class="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              :aria-expanded="expandedServices.has(service.key)"
              :aria-label="`${expandedServices.has(service.key) ? 'Collapse' : 'Expand'} ${service.instances.length} instance${service.instances.length > 1 ? 's' : ''}`"
            >
              {{ expandedServices.has(service.key) ? '▼' : '▶' }} 
              {{ service.instances.length }} instance{{ service.instances.length > 1 ? 's' : '' }}
            </button>
            
            <div v-if="expandedServices.has(service.key)" class="mt-2 space-y-2">
              <div 
                v-for="instance in service.instances" 
                :key="instance.id"
                class="p-2 bg-gray-800 rounded-sm border border-gray-700 text-xs"
              >
                <div class="flex items-center justify-between mb-1">
                  <span class="font-medium">{{ instance.name }}</span>
                  <Badge :variant="getHealthBadgeVariant(instance.status)">
                    {{ instance.status }}
                  </Badge>
                </div>
                <div v-if="instance.responseTime != null" :class="getLatencyClass(instance.responseTime)">
                  {{ instance.responseTime }}ms
                </div>
                <div v-if="instance.error" class="text-red-400 mt-1">
                  {{ instance.error }}
                </div>
              </div>
            </div>
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

        <div v-if="systemStatus.pgvector" class="md:col-span-2">
          <h3 class="text-sm font-medium text-gray-400 mb-2">pgvector</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-400">Build:</span>
              <span>{{ systemStatus.pgvector.build || 'unknown' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Selected Variant:</span>
              <span>{{ systemStatus.pgvector.selectedVariant || 'unknown' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">CPU AVX:</span>
              <span>{{ formatCpuFlag(systemStatus.pgvector.cpuAvx) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">CPU AVX2:</span>
              <span>{{ formatCpuFlag(systemStatus.pgvector.cpuAvx2) }}</span>
            </div>
            <div class="flex justify-between md:col-span-2">
              <span class="text-gray-400">Last Check:</span>
              <span>{{ systemStatus.pgvector.lastChecked ? formatLastCheck(systemStatus.pgvector.lastChecked) : 'unknown' }}</span>
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
          <p class="mt-1">Copyright (C) 2026 cloudbyday90</p>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ArrowPathIcon } from '@heroicons/vue/24/outline'
import Card from '@/components/common/Card.vue'
import Badge from '@/components/common/Badge.vue'
import Button from '@/components/common/Button.vue'
import Spinner from '@/components/common/Spinner.vue'
import api from '@/api'
import { getServiceIcon } from '@/utils/serviceIcons'
import { getStatusConfig, getLatencyClass, getOverallHealth } from '@/utils/healthStatus'

// Auto-refresh interval (30 seconds)
const AUTO_REFRESH_INTERVAL_MS = 30000

const loadingHealth = ref(true)
const loadingStatus = ref(true)
const refreshing = ref(false)
const healthDetails = ref(null)
const error = ref(null)
const lastUpdated = ref(null)
const searchQuery = ref('')
const statusFilter = ref('')
const expandedServices = ref(new Set())
let autoRefreshInterval = null

const healthServices = ref([
  { name: 'Database', key: 'database', status: 'unknown', description: 'PostgreSQL connection', responseTime: null, lastCheck: null },
  { name: 'pgvector', key: 'pgvector', status: 'unknown', description: 'Vector search extension', responseTime: null, lastCheck: null },
  { name: 'Media Server', key: 'mediaServer', status: 'unknown', description: 'Plex/Jellyfin/Emby', responseTime: null, lastCheck: null },
  { name: 'Radarr', key: 'radarr', status: 'unknown', description: 'Movie management', responseTime: null, lastCheck: null },
  { name: 'Sonarr', key: 'sonarr', status: 'unknown', description: 'TV show management', responseTime: null, lastCheck: null },
  { name: 'AI Provider', key: 'ollama', status: 'unknown', description: 'Ollama/OpenAI/Anthropic', responseTime: null, lastCheck: null },
  { name: 'Queue Worker', key: 'queueWorker', status: 'unknown', description: 'Task processing', responseTime: null, lastCheck: null },
  { name: 'TMDB', key: 'tmdb', status: 'unknown', description: 'Movie/TV metadata', responseTime: null, lastCheck: null },
  { name: 'OMDb', key: 'omdb', status: 'unknown', description: 'Movie/TV enrichment', responseTime: null, lastCheck: null },
  { name: 'Discord Bot', key: 'discordBot', status: 'unknown', description: 'Notifications', responseTime: null, lastCheck: null },
  { name: 'Tavily', key: 'tavily', status: 'unknown', description: 'Web search (optional)', responseTime: null, lastCheck: null },
])

const systemStatus = ref({
  version: '1.0.0',
  uptime: 0,
  nodeVersion: 'N/A',
  platform: 'N/A',
  arch: 'N/A',
  memoryUsage: { heapUsed: 0 },
  pgvector: null
})

const overallHealth = computed(() => {
  return getOverallHealth(healthServices.value)
})

const filteredServices = computed(() => {
  let services = healthServices.value
  
  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    services = services.filter(s => 
      s.name.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query)
    )
  }
  
  // Filter by status
  if (statusFilter.value) {
    services = services.filter(s => s.status === statusFilter.value)
  }
  
  return services
})

const normalizeStatus = (status) => {
  if (!status) return 'unknown'
  const statusLower = status.toLowerCase()
  
  // Map old status values to new canonical values
  if (statusLower === 'connected') return 'healthy'
  if (statusLower === 'partial') return 'degraded'
  if (statusLower === 'configured') return 'degraded'
  if (statusLower === 'disconnected' || statusLower === 'error') return 'unhealthy'
  if (statusLower === 'not configured') return 'not_configured'
  
  return status
}

const parseBooleanFlag = (value) => {
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  return null
}

const buildPgvectorService = (pgvectorInfo) => {
  const selectedVariant = pgvectorInfo?.selectedVariant || null
  const build = pgvectorInfo?.build || null
  const cpuAvx = parseBooleanFlag(pgvectorInfo?.cpuAvx)
  const cpuAvx2 = parseBooleanFlag(pgvectorInfo?.cpuAvx2)

  let status = 'unknown'
  let error = null

  if (selectedVariant) {
    if (selectedVariant === 'avx2') {
      status = cpuAvx2 === false ? 'unhealthy' : 'healthy'
      if (cpuAvx2 === false) {
        error = 'Selected AVX2 variant but CPU does not report AVX2 support.'
      }
    } else if (selectedVariant === 'avx') {
      status = cpuAvx === false ? 'unhealthy' : 'healthy'
      if (cpuAvx === false) {
        error = 'Selected AVX variant but CPU does not report AVX support.'
      }
    } else {
      status = 'healthy'
    }
  }

  return {
    name: 'pgvector',
    key: 'pgvector',
    status,
    description: `Variant: ${selectedVariant || 'unknown'} • Build: ${build || 'unknown'}`,
    responseTime: null,
    lastCheck: pgvectorInfo?.lastChecked || null,
    error
  }
}

const upsertPgvectorService = (services, pgvectorInfo) => {
  const pgvectorService = buildPgvectorService(pgvectorInfo)
  const index = services.findIndex(service => service.key === pgvectorService.key)
  if (index === -1) {
    return [...services, pgvectorService]
  }
  const next = [...services]
  next[index] = { ...next[index], ...pgvectorService }
  return next
}

const loadHealth = async (silent = false) => {
  if (!silent) {
    loadingHealth.value = true
  }
  error.value = null
  
  try {
    const response = await api.getSystemHealth()
    
    if (response.data) {
      const statusMap = response.data
      healthDetails.value = statusMap.details || {}
      
      healthServices.value = [
        { 
          name: 'Database', 
          key: 'database',
          status: normalizeStatus(statusMap.database), 
          description: 'PostgreSQL connection',
          responseTime: healthDetails.value.database?.responseTime,
          lastCheck: healthDetails.value.database?.lastCheck,
          error: healthDetails.value.database?.error
        },
        { 
          name: 'Media Server', 
          key: 'mediaServer',
          status: normalizeStatus(statusMap.mediaServer), 
          description: healthDetails.value.mediaServer?.type ? `${healthDetails.value.mediaServer.type} - ${healthDetails.value.mediaServer.name || ''}` : 'Plex/Jellyfin/Emby',
          responseTime: healthDetails.value.mediaServer?.responseTime,
          lastCheck: healthDetails.value.mediaServer?.lastCheck,
          error: healthDetails.value.mediaServer?.error
        },
        { 
          name: 'Radarr', 
          key: 'radarr',
          status: normalizeStatus(statusMap.radarr), 
          description: healthDetails.value.radarr?.instances?.length ? `${healthDetails.value.radarr.instances.length} instance(s)` : 'Movie management',
          responseTime: healthDetails.value.radarr?.responseTime,
          lastCheck: healthDetails.value.radarr?.lastCheck,
          instances: healthDetails.value.radarr?.instances || [],
          error: healthDetails.value.radarr?.error
        },
        { 
          name: 'Sonarr', 
          key: 'sonarr',
          status: normalizeStatus(statusMap.sonarr), 
          description: healthDetails.value.sonarr?.instances?.length ? `${healthDetails.value.sonarr.instances.length} instance(s)` : 'TV show management',
          responseTime: healthDetails.value.sonarr?.responseTime,
          lastCheck: healthDetails.value.sonarr?.lastCheck,
          instances: healthDetails.value.sonarr?.instances || [],
          error: healthDetails.value.sonarr?.error
        },
        { 
          name: 'AI Provider', 
          key: 'ollama',
          status: normalizeStatus(statusMap.ollama), 
          description: healthDetails.value.ollama?.provider ? healthDetails.value.ollama.provider : 'Ollama/OpenAI/Anthropic',
          responseTime: healthDetails.value.ollama?.responseTime,
          lastCheck: healthDetails.value.ollama?.lastCheck,
          error: healthDetails.value.ollama?.error
        },
        { 
          name: 'Queue Worker', 
          key: 'queueWorker',
          status: normalizeStatus(statusMap.queueWorker), 
          description: 'Task processing',
          responseTime: healthDetails.value.queueWorker?.latency ?? null,
          lastCheck: healthDetails.value.queueWorker?.timestamp,
          error: healthDetails.value.queueWorker?.error,
          metadata: healthDetails.value.queueWorker?.metadata
        },
        { 
          name: 'TMDB', 
          key: 'tmdb',
          status: normalizeStatus(statusMap.tmdb), 
          description: 'Movie/TV metadata',
          responseTime: healthDetails.value.tmdb?.responseTime,
          lastCheck: healthDetails.value.tmdb?.lastCheck,
          error: healthDetails.value.tmdb?.error
        },
        { 
          name: 'OMDb', 
          key: 'omdb',
          status: normalizeStatus(statusMap.omdb), 
          description: 'Movie/TV enrichment',
          responseTime: healthDetails.value.omdb?.responseTime,
          lastCheck: healthDetails.value.omdb?.lastCheck,
          error: healthDetails.value.omdb?.error
        },
        { 
          name: 'Discord Bot', 
          key: 'discordBot',
          status: normalizeStatus(statusMap.discordBot), 
          description: 'Notifications',
          responseTime: healthDetails.value.discordBot?.responseTime,
          lastCheck: healthDetails.value.discordBot?.lastCheck,
          error: healthDetails.value.discordBot?.error
        },
        { 
          name: 'Tavily', 
          key: 'tavily',
          status: normalizeStatus(statusMap.tavily), 
          description: 'Web search (optional)',
          responseTime: healthDetails.value.tavily?.responseTime,
          lastCheck: healthDetails.value.tavily?.lastCheck,
          error: healthDetails.value.tavily?.error
        },
      ]

      healthServices.value = upsertPgvectorService(healthServices.value, systemStatus.value?.pgvector)
      
      lastUpdated.value = new Date()
    }
  } catch (err) {
    console.error('Failed to load health status:', err)
    error.value = err.message || 'Failed to load health status'
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
      healthServices.value = upsertPgvectorService(healthServices.value, response.data.pgvector)
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

const toggleInstanceDetails = (serviceKey) => {
  if (expandedServices.value.has(serviceKey)) {
    expandedServices.value.delete(serviceKey)
  } else {
    expandedServices.value.add(serviceKey)
  }
  // Force reactivity
  expandedServices.value = new Set(expandedServices.value)
}

// TODO: Implement connection test
// const testConnection = (serviceKey) => {
//   console.log('Test connection for:', serviceKey)
// }

// TODO: Implement log viewer
// const viewLogs = (serviceKey) => {
//   console.log('View logs for:', serviceKey)
// }

const getServiceTooltip = (service) => {
  let tooltip = `${service.name}\nStatus: ${getStatusConfig(service.status).label}`
  if (service.responseTime != null) {
    tooltip += `\nLatency: ${service.responseTime}ms`
  }
  if (service.lastCheck) {
    tooltip += `\nLast Check: ${formatLastCheck(service.lastCheck)}`
  }
  return tooltip
}

const formatLastUpdated = (date) => {
  if (!date) return ''
  const now = new Date()
  const diffMs = now - date
  const diffSecs = Math.floor(diffMs / 1000)
  
  if (diffSecs < 10) return 'just now'
  if (diffSecs < 60) return `${diffSecs}s ago`
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m ago`
  return formatLastCheck(date.toISOString())
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

const formatCpuFlag = (value) => {
  if (value === 'true' || value === true) return 'Yes'
  if (value === 'false' || value === false) return 'No'
  if (!value) return 'Unknown'
  return String(value)
}

onMounted(() => {
  loadHealth()
  loadStatus()
  
  // Setup auto-refresh every 30 seconds
  autoRefreshInterval = setInterval(() => {
    loadHealth(true)
  }, AUTO_REFRESH_INTERVAL_MS)
})

onUnmounted(() => {
  // Cleanup interval
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval)
  }
})
</script>
