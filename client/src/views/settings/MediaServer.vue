<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2 flex items-center gap-2">
        <span>🖥️</span>
        <span>Media Server Configuration</span>
      </h2>
      <p class="text-gray-400 text-sm">Connect to Plex, Emby, or Jellyfin</p>
    </div>

    <!-- Server Type Selection -->
    <div class="space-y-4">
      <h3 class="text-lg font-medium">Server Type</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          v-for="type in serverTypes"
          :key="type.id"
          @click="config.type = type.id"
          :class="[
            'p-6 rounded-lg border-2 transition-all',
            config.type === type.id
              ? 'border-blue-500 bg-blue-900/30'
              : 'border-gray-700 bg-gray-800 hover:border-gray-600'
          ]"
        >
          <div class="text-4xl mb-2">{{ type.icon }}</div>
          <div class="text-lg font-semibold">{{ type.name }}</div>
        </button>
      </div>
    </div>

    <!-- Connection Settings -->
    <div class="space-y-4">
      <h3 class="text-lg font-medium">Connection Settings</h3>
      
      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2">Server URL</label>
          <input
            v-model="config.url"
            type="text"
            :placeholder="getPlaceholder()"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">
            {{ config.type === 'plex' ? 'Plex Token' : 'API Key' }}
          </label>
          <div class="relative">
            <input
              v-model="config.api_key"
              :type="showApiKey ? 'text' : 'password'"
              :placeholder="config.type === 'plex' ? 'Your Plex token' : 'Your API key'"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
            />
            <button
              @click="showApiKey = !showApiKey"
              type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
            >
              {{ showApiKey ? '👁️' : '👁️‍🗨️' }}
            </button>
          </div>
          <div v-if="config.type === 'plex'" class="mt-2">
            <button
              @click="showTokenHelp = !showTokenHelp"
              class="text-xs text-blue-400 hover:underline"
            >
              How to get your Plex token?
            </button>
            <div v-if="showTokenHelp" class="mt-2 p-3 bg-gray-900 rounded text-xs space-y-1">
              <p class="font-semibold">Steps to get your Plex token:</p>
              <ol class="list-decimal list-inside space-y-1 text-gray-400">
                <li>Sign in to your Plex account</li>
                <li>Go to any media item in your library</li>
                <li>Click "Get Info" → "View XML"</li>
                <li>Find <code class="bg-gray-800 px-1 rounded">X-Plex-Token</code> in the URL</li>
              </ol>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">Server Name</label>
          <input
            v-model="config.name"
            type="text"
            placeholder="My Media Server"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-3">
        <button
          @click="testConnection"
          :disabled="loading || !config.url || !config.api_key"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {{ loading ? 'Testing...' : 'Test Connection' }}
        </button>
        <button
          @click="saveSettings"
          :disabled="saving || !config.url || !config.api_key"
          class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>

      <!-- Connection Status -->
      <ConnectionStatus :status="connectionStatus" />

      <!-- Save Status Message -->
      <div v-if="saveStatus" :class="['p-3 rounded-lg', saveStatus.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400']">
        {{ saveStatus.message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import ConnectionStatus from '@/components/common/ConnectionStatus.vue'

const serverTypes = [
  { id: 'plex', name: 'Plex', icon: '🟠' },
  { id: 'emby', name: 'Emby', icon: '🟢' },
  { id: 'jellyfin', name: 'Jellyfin', icon: '🟣' },
]

const config = ref({
  type: 'plex',
  name: '',
  url: '',
  api_key: '',
})

const showApiKey = ref(false)
const showTokenHelp = ref(false)
const loading = ref(false)
const saving = ref(false)
const connectionStatus = ref(null)
const saveStatus = ref(null)

const getPlaceholder = () => {
  switch (config.value.type) {
    case 'plex':
      return 'http://localhost:32400'
    case 'emby':
      return 'http://localhost:8096'
    case 'jellyfin':
      return 'http://localhost:8096'
    default:
      return 'http://localhost'
  }
}

onMounted(async () => {
  try {
    const response = await axios.get('/api/media-server')
    if (response.data) {
      config.value = {
        type: response.data.type || 'plex',
        name: response.data.name || '',
        url: response.data.url || '',
        api_key: response.data.api_key || '',
      }
    }
  } catch (error) {
    console.error('Failed to load media server configuration:', error)
  }
})

const testConnection = async () => {
  loading.value = true
  connectionStatus.value = null
  try {
    const response = await axios.post('/api/media-server/test', config.value)
    
    if (response.data.success) {
      connectionStatus.value = {
        success: true,
        details: {
          serverName: config.value.name || `${config.value.type} Media Server`,
          version: response.data.data?.version || 'N/A',
          status: 'Connected',
          platform: response.data.data?.platform,
        }
      }
    } else {
      connectionStatus.value = {
        success: false,
        error: {
          message: response.data.error || 'Connection failed',
          troubleshooting: [
            `Check that ${config.value.type} is running`,
            'Verify the URL is correct',
            'Ensure the API key/token is valid',
            'Check if a firewall is blocking the connection'
          ]
        }
      }
    }
  } catch (error) {
    connectionStatus.value = {
      success: false,
      error: {
        message: error.response?.data?.error || error.message,
        troubleshooting: [
          `Check that ${config.value.type} is running`,
          'Verify the URL is correct',
          'Ensure the API key/token is valid',
          'Check if a firewall is blocking the connection'
        ]
      }
    }
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  saving.value = true
  saveStatus.value = null
  try {
    await axios.post('/api/media-server', config.value)
    saveStatus.value = { type: 'success', message: 'Media server settings saved successfully!' }
    
    // Auto-clear success message after 3 seconds
    setTimeout(() => {
      saveStatus.value = null
    }, 3000)
  } catch (error) {
    saveStatus.value = { 
      type: 'error', 
      message: `Failed to save: ${error.response?.data?.error || error.message}` 
    }
  } finally {
    saving.value = false
  }
}
</script>
