<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold mb-2">System</h1>
      <p class="text-gray-400">System health, status, and diagnostics</p>
    </div>

    <!-- Health Checks -->
    <div class="bg-card rounded-lg border border-gray-800 p-6">
      <h2 class="text-xl font-semibold mb-4">Health Checks</h2>

      <div v-if="loadingHealth" class="text-center py-8 text-gray-400">
        <ArrowPathIcon class="w-8 h-8 mx-auto mb-2 animate-spin" />
        <p>Checking system health...</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          v-for="check in healthChecks" 
          :key="check.name"
          class="flex items-center justify-between p-4 bg-background rounded-lg border border-gray-800"
        >
          <div class="flex items-center space-x-3">
            <component :is="check.icon" class="w-5 h-5 text-gray-400" />
            <span class="font-medium">{{ check.name }}</span>
          </div>
          <div class="flex items-center space-x-2">
            <div 
              class="w-2 h-2 rounded-full"
              :class="check.status === 'healthy' ? 'bg-green-500' : check.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'"
            ></div>
            <span 
              class="text-sm"
              :class="check.status === 'healthy' ? 'text-green-500' : check.status === 'warning' ? 'text-yellow-500' : 'text-red-500'"
            >
              {{ check.status === 'healthy' ? 'Connected' : check.status === 'warning' ? 'Warning' : 'Disconnected' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- System Status -->
    <div class="bg-card rounded-lg border border-gray-800 p-6">
      <h2 class="text-xl font-semibold mb-4">System Status</h2>

      <div v-if="systemStatus" class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="p-4 bg-background rounded-lg border border-gray-800">
          <p class="text-sm text-gray-400 mb-1">Version</p>
          <p class="text-lg font-semibold">{{ systemStatus.version }}</p>
        </div>
        <div class="p-4 bg-background rounded-lg border border-gray-800">
          <p class="text-sm text-gray-400 mb-1">Uptime</p>
          <p class="text-lg font-semibold">{{ systemStatus.uptime }}</p>
        </div>
        <div class="p-4 bg-background rounded-lg border border-gray-800">
          <p class="text-sm text-gray-400 mb-1">Node Version</p>
          <p class="text-lg font-semibold">{{ systemStatus.nodeVersion }}</p>
        </div>
      </div>
    </div>

    <!-- Tasks -->
    <div class="bg-card rounded-lg border border-gray-800 p-6">
      <h2 class="text-xl font-semibold mb-4">Background Tasks</h2>

      <div class="space-y-3">
        <div 
          v-for="task in tasks" 
          :key="task.id"
          class="flex items-center justify-between p-4 bg-background rounded-lg border border-gray-800"
        >
          <div>
            <p class="font-medium">{{ task.name }}</p>
            <p class="text-sm text-gray-400">{{ task.description }}</p>
          </div>
          <div class="text-sm">
            <span 
              class="px-3 py-1 rounded-full"
              :class="task.status === 'running' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400'"
            >
              {{ task.status }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Logs -->
    <div class="bg-card rounded-lg border border-gray-800 p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">Recent Logs</h2>
        <button 
          @click="refreshLogs"
          class="text-sm text-primary hover:text-primary-light transition-colors"
        >
          Refresh
        </button>
      </div>

      <div v-if="loadingLogs" class="text-center py-8 text-gray-400">
        <ArrowPathIcon class="w-8 h-8 mx-auto mb-2 animate-spin" />
        <p>Loading logs...</p>
      </div>

      <div v-else class="bg-background rounded-lg border border-gray-800 p-4 font-mono text-sm overflow-x-auto">
        <div v-for="(log, index) in logs" :key="index" class="mb-1">
          <span :class="getLogColor(log.level)">[{{ log.timestamp }}]</span>
          <span :class="getLogColor(log.level)"> {{ log.level.toUpperCase() }}:</span>
          <span class="text-gray-300"> {{ log.message }}</span>
        </div>
        <div v-if="logs.length === 0" class="text-gray-400 text-center py-4">
          No recent logs
        </div>
      </div>
    </div>

    <!-- About -->
    <div class="bg-card rounded-lg border border-gray-800 p-6">
      <h2 class="text-xl font-semibold mb-4">About Classifarr</h2>

      <div class="space-y-3">
        <div>
          <p class="text-sm text-gray-400 mb-2">Description</p>
          <p class="text-gray-300">
            AI-powered media classification for the *arr ecosystem. Automatically routes 
            Overseerr/Jellyseerr requests to the correct Radarr/Sonarr library using AI and machine learning.
          </p>
        </div>

        <div class="flex items-center space-x-4 pt-3">
          <a 
            href="https://github.com/cloudbyday90/Classifarr" 
            target="_blank"
            class="flex items-center space-x-2 text-primary hover:text-primary-light transition-colors"
          >
            <span>GitHub Repository</span>
            <ArrowTopRightOnSquareIcon class="w-4 h-4" />
          </a>
          <a 
            href="https://github.com/cloudbyday90/Classifarr/issues" 
            target="_blank"
            class="flex items-center space-x-2 text-primary hover:text-primary-light transition-colors"
          >
            <span>Report Issue</span>
            <ArrowTopRightOnSquareIcon class="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { 
  ArrowPathIcon,
  CircleStackIcon,
  ServerIcon,
  CpuChipIcon,
  FilmIcon,
  TvIcon,
  PlayIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/vue/24/outline'

const loadingHealth = ref(false)
const loadingLogs = ref(false)
const healthChecks = ref([
  { name: 'Database', status: 'unknown', icon: CircleStackIcon },
  { name: 'Discord Bot', status: 'unknown', icon: ServerIcon },
  { name: 'Ollama AI', status: 'unknown', icon: CpuChipIcon },
  { name: 'Radarr', status: 'unknown', icon: FilmIcon },
  { name: 'Sonarr', status: 'unknown', icon: TvIcon },
  { name: 'Media Server', status: 'unknown', icon: PlayIcon },
])

const systemStatus = ref({
  version: '1.0.0',
  uptime: '0h 0m',
  nodeVersion: process.version || 'Unknown'
})

const tasks = ref([
  {
    id: 1,
    name: 'Classification Queue',
    description: 'Processes incoming webhook requests',
    status: 'idle'
  },
  {
    id: 2,
    name: 'Discord Notifications',
    description: 'Sends notifications to Discord',
    status: 'idle'
  },
  {
    id: 3,
    name: 'Learning System',
    description: 'Updates classification patterns',
    status: 'idle'
  }
])

const logs = ref([])

const fetchHealthStatus = async () => {
  loadingHealth.value = true
  try {
    const response = await fetch('/api/system/health')
    const data = await response.json()

    // Update health checks based on response
    healthChecks.value = healthChecks.value.map(check => {
      const checkName = check.name.toLowerCase().replace(' ', '_')
      return {
        ...check,
        status: data[checkName] || 'unknown'
      }
    })
  } catch (error) {
    console.error('Failed to fetch health status:', error)
  } finally {
    loadingHealth.value = false
  }
}

const fetchSystemStatus = async () => {
  try {
    const response = await fetch('/api/system/status')
    const data = await response.json()
    
    systemStatus.value = {
      version: data.version || '1.0.0',
      uptime: formatUptime(data.uptime || 0),
      nodeVersion: data.nodeVersion || 'Unknown'
    }
  } catch (error) {
    console.error('Failed to fetch system status:', error)
  }
}

const fetchLogs = async () => {
  loadingLogs.value = true
  try {
    const response = await fetch('/api/system/logs?limit=20')
    const data = await response.json()
    logs.value = data.logs || []
  } catch (error) {
    console.error('Failed to fetch logs:', error)
    logs.value = []
  } finally {
    loadingLogs.value = false
  }
}

const refreshLogs = () => {
  fetchLogs()
}

const formatUptime = (seconds) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

const getLogColor = (level) => {
  switch (level.toLowerCase()) {
    case 'error':
      return 'text-red-400'
    case 'warn':
    case 'warning':
      return 'text-yellow-400'
    case 'info':
      return 'text-blue-400'
    case 'debug':
      return 'text-gray-400'
    default:
      return 'text-gray-300'
  }
}

onMounted(() => {
  fetchHealthStatus()
  fetchSystemStatus()
  fetchLogs()
})
</script>
