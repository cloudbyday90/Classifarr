<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2 flex items-center gap-2">
        <span>🎭</span>
        <span>Media Server Configuration</span>
      </h2>
      <p class="text-gray-400 text-sm">Configure your Plex, Emby, or Jellyfin media server connection</p>
    </div>

    <!-- Server Type Selection -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <label class="block text-sm font-medium mb-3">Server Type</label>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          @click="config.type = 'plex'"
          :class="[
            'p-4 rounded-lg border-2 transition-all',
            config.type === 'plex'
              ? 'border-orange-500 bg-orange-500/10'
              : 'border-gray-700 hover:border-gray-600'
          ]"
        >
          <div class="text-4xl mb-2">🟠</div>
          <div class="font-medium">Plex</div>
        </button>
        <button
          @click="config.type = 'emby'"
          :class="[
            'p-4 rounded-lg border-2 transition-all',
            config.type === 'emby'
              ? 'border-green-500 bg-green-500/10'
              : 'border-gray-700 hover:border-gray-600'
          ]"
        >
          <div class="text-4xl mb-2">🟢</div>
          <div class="font-medium">Emby</div>
        </button>
        <button
          @click="config.type = 'jellyfin'"
          :class="[
            'p-4 rounded-lg border-2 transition-all',
            config.type === 'jellyfin'
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-gray-700 hover:border-gray-600'
          ]"
        >
          <div class="text-4xl mb-2">🟣</div>
          <div class="font-medium">Jellyfin</div>
        </button>
      </div>
    </div>

    <!-- Connection Settings Card -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
      <!-- Server Name -->
      <div>
        <label class="block text-sm font-medium mb-2">Server Name</label>
        <input v-model="config.name" type="text" :placeholder="`My ${capitalizeFirst(config.type)} Server`" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
      </div>

      <!-- Server URL -->
      <div>
        <label class="block text-sm font-medium mb-2">Server URL</label>
        <input 
          v-model="config.url" 
          type="text" 
          :placeholder="getUrlPlaceholder()" 
          class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" 
        />
        <p class="text-xs text-gray-500 mt-1">Full URL including protocol (http:// or https://)</p>
      </div>

      <!-- API Key / Token -->
      <div>
        <label class="block text-sm font-medium mb-2">
          {{ config.type === 'plex' ? 'X-Plex-Token' : 'API Key' }}
        </label>
        <PasswordInput v-model="config.api_key" :placeholder="getTokenPlaceholder()" />
        <p class="text-xs text-gray-500 mt-1" v-html="getTokenHelp()"></p>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex gap-3">
      <button @click="testConnection" :disabled="loading" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg">
        {{ loading ? 'Testing...' : 'Test Connection' }}
      </button>
      <button @click="saveSettings" :disabled="saving" class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg">
        {{ saving ? 'Saving...' : 'Save' }}
      </button>
    </div>

    <!-- Connection Status -->
    <ConnectionStatus 
      :status="connectionStatus.status" 
      :serviceName="connectionStatus.serviceName"
      :details="connectionStatus.details"
      :error="connectionStatus.error"
      :lastChecked="connectionStatus.lastChecked"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'
import ConnectionStatus from '@/components/common/ConnectionStatus.vue'
import PasswordInput from '@/components/common/PasswordInput.vue'

const toast = useToast()

const config = ref({
  type: 'plex',
  name: '',
  url: '',
  api_key: ''
})

const loading = ref(false)
const saving = ref(false)
const connectionStatus = ref({
  status: 'idle',
  serviceName: 'Media Server',
  details: null,
  error: null,
  lastChecked: null
})

onMounted(async () => {
  await loadConfig()
})

const loadConfig = async () => {
  try {
    const response = await api.getMediaServerConfig()
    if (response.data) {
      config.value = {
        type: response.data.type || 'plex',
        name: response.data.name || '',
        url: response.data.url || '',
        api_key: response.data.api_key || ''
      }
    }
  } catch (error) {
    console.error('Failed to load media server config:', error)
    toast.error('Failed to load configuration')
  }
}

const capitalizeFirst = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const getUrlPlaceholder = () => {
  const placeholders = {
    plex: 'http://localhost:32400',
    emby: 'http://localhost:8096',
    jellyfin: 'http://localhost:8096'
  }
  return placeholders[config.value.type] || 'http://localhost:8096'
}

const getTokenPlaceholder = () => {
  return config.value.type === 'plex' ? 'Your Plex token' : 'Your API key'
}

const getTokenHelp = () => {
  if (config.value.type === 'plex') {
    return 'Find your Plex token: <a href="https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/" target="_blank" class="text-blue-400 hover:underline">How to find X-Plex-Token</a>'
  } else if (config.value.type === 'emby') {
    return 'Find in Emby: Settings → Advanced → API Keys'
  } else {
    return 'Find in Jellyfin: Dashboard → Advanced → API Keys'
  }
}

const testConnection = async () => {
  loading.value = true
  connectionStatus.value = {
    status: 'testing',
    serviceName: capitalizeFirst(config.value.type),
    details: null,
    error: null,
    lastChecked: null
  }

  try {
    const response = await api.testMediaServerConnection(config.value)
    
    if (response.data.success) {
      connectionStatus.value = {
        status: 'success',
        serviceName: capitalizeFirst(config.value.type),
        details: response.data.details || {
          serverName: capitalizeFirst(config.value.type),
          status: 'Connected'
        },
        error: null,
        lastChecked: new Date()
      }
      toast.success(`Successfully connected to ${capitalizeFirst(config.value.type)}`)
    } else {
      connectionStatus.value = {
        status: 'error',
        serviceName: capitalizeFirst(config.value.type),
        details: null,
        error: response.data.error || {
          message: 'Connection failed',
          troubleshooting: [
            `Check that ${capitalizeFirst(config.value.type)} is running`,
            'Verify the URL is correct',
            'Ensure the API key/token is valid'
          ]
        },
        lastChecked: new Date()
      }
      toast.error('Connection test failed')
    }
  } catch (error) {
    connectionStatus.value = {
      status: 'error',
      serviceName: capitalizeFirst(config.value.type),
      details: null,
      error: {
        message: error.response?.data?.error || error.message,
        troubleshooting: [
          `Check that ${capitalizeFirst(config.value.type)} is running`,
          'Verify the URL is correct',
          'Ensure the API key/token is valid'
        ]
      },
      lastChecked: new Date()
    }
    toast.error('Connection test failed')
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  saving.value = true
  
  try {
    await api.updateMediaServerConfig(config.value)
    toast.success('Media server configuration saved successfully')
  } catch (error) {
    console.error('Failed to save media server config:', error)
    toast.error('Failed to save configuration')
  } finally {
    saving.value = false
  }
}
</script>
