<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

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
          @click="selectServerType('plex')"
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
          @click="selectServerType('emby')"
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
          @click="selectServerType('jellyfin')"
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

    <!-- Plex OAuth Flow -->
    <div v-if="config.type === 'plex'" class="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
      <!-- Sign in with Plex -->
      <div v-if="!plexAuthToken && !showManualEntry">
        <h3 class="font-medium mb-3 flex items-center gap-2">
          <span>🔐</span>
          <span>Connect to Plex</span>
        </h3>
        
        <div class="space-y-4">
          <button 
            @click="startPlexAuth"
            :disabled="plexAuthLoading"
            class="w-full flex items-center justify-center gap-3 px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 rounded-lg font-medium transition-all"
          >
            <span v-if="plexAuthLoading" class="animate-spin">⏳</span>
            <span v-else>🟠</span>
            <span>{{ plexAuthLoading ? 'Waiting for authorization...' : 'Sign in with Plex' }}</span>
          </button>
          
          <p v-if="plexAuthLoading" class="text-center text-sm text-gray-400">
            A new window has opened. Please sign in to your Plex account and authorize Classifarr.
          </p>

          <div class="text-center">
            <button 
              @click="showManualEntry = true" 
              class="text-sm text-gray-400 hover:text-gray-300 underline"
            >
              Or enter token manually
            </button>
          </div>
        </div>
      </div>

      <!-- Plex Server Selection -->
      <div v-else-if="plexAuthToken && !config.url">
        <h3 class="font-medium mb-3 flex items-center gap-2">
          <span>🖥️</span>
          <span>Select Your Plex Server</span>
        </h3>
        
        <div v-if="plexUser" class="mb-4 p-3 bg-gray-900 rounded-lg flex items-center gap-3">
          <img v-if="plexUser.thumb" :src="plexUser.thumb" class="w-10 h-10 rounded-full" />
          <div>
            <div class="font-medium">{{ plexUser.username || plexUser.title }}</div>
            <div class="text-sm text-gray-400">{{ plexUser.email }}</div>
          </div>
          <button @click="resetPlexAuth" class="ml-auto text-sm text-red-400 hover:text-red-300">
            Sign out
          </button>
        </div>

        <div v-if="loadingServers" class="text-center py-8">
          <div class="animate-spin text-4xl mb-2">⏳</div>
          <p class="text-gray-400">Loading your Plex servers...</p>
        </div>

        <div v-else-if="plexServers.length > 0" class="space-y-3">
          <div
            v-for="server in plexServers"
            :key="server.clientIdentifier"
            @click="selectPlexServer(server)"
            :class="[
              'p-4 rounded-lg border-2 cursor-pointer transition-all',
              selectedServer?.clientIdentifier === server.clientIdentifier
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-gray-700 hover:border-gray-600'
            ]"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium">{{ server.name }}</div>
                <div class="text-sm text-gray-400">
                  {{ server.owned ? 'Owner' : 'Shared with you' }}
                  <span v-if="server.preferredConnection">
                    • {{ server.preferredConnection.local ? 'Local' : 'Remote' }}
                  </span>
                </div>
              </div>
              <div v-if="testingServer === server.clientIdentifier" class="text-sm text-gray-400">
                Testing...
              </div>
              <div v-else-if="serverTestResults[server.clientIdentifier]" class="text-sm">
                <span v-if="serverTestResults[server.clientIdentifier].success" class="text-green-400">✓ Connected</span>
                <span v-else class="text-red-400">✗ Failed</span>
              </div>
            </div>
          </div>

          <button 
            @click="confirmPlexServer"
            :disabled="!selectedServer || confirmingServer"
            class="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg"
          >
            {{ confirmingServer ? 'Saving...' : 'Use Selected Server' }}
          </button>
        </div>

        <div v-else class="text-center py-8 text-gray-400">
          <p>No Plex servers found for your account.</p>
          <button @click="resetPlexAuth" class="mt-2 text-orange-400 hover:text-orange-300 underline">
            Try again
          </button>
        </div>
      </div>

      <!-- Connected Server Display -->
      <div v-else-if="config.url && !showManualEntry">
        <h3 class="font-medium mb-3 flex items-center gap-2">
          <span>✅</span>
          <span>Connected Plex Server</span>
        </h3>
        
        <div class="p-4 bg-gray-900 rounded-lg space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium">{{ config.name || 'Plex Server' }}</div>
              <div class="text-sm text-gray-400">{{ config.url }}</div>
            </div>
            <span class="px-2 py-1 bg-green-600/20 text-green-400 text-sm rounded">Connected</span>
          </div>
          
          <div class="flex gap-2">
            <button @click="resetPlexAuth" class="text-sm text-gray-400 hover:text-gray-300">
              Change Server
            </button>
            <span class="text-gray-600">|</span>
            <button @click="showManualEntry = true" class="text-sm text-gray-400 hover:text-gray-300">
              Edit Manually
            </button>
          </div>
        </div>
      </div>

      <!-- Manual Entry (fallback) -->
      <div v-if="showManualEntry">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-medium flex items-center gap-2">
            <span>⚙️</span>
            <span>Manual Configuration</span>
          </h3>
          <button @click="showManualEntry = false; resetPlexAuth()" class="text-sm text-gray-400 hover:text-gray-300">
            ← Back to Sign in with Plex
          </button>
        </div>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Server Name</label>
            <input v-model="config.name" type="text" placeholder="My Plex Server" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">Server URL</label>
            <input v-model="config.url" type="text" placeholder="http://localhost:32400" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">X-Plex-Token</label>
            <PasswordInput v-model="config.api_key" placeholder="Your Plex token" />
            <p class="text-xs text-gray-500 mt-1">
              <a href="https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/" target="_blank" class="text-blue-400 hover:underline">
                How to find your Plex token
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Emby/Jellyfin Manual Entry -->
    <div v-if="config.type !== 'plex'" class="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
      <div>
        <label class="block text-sm font-medium mb-2">Server Name</label>
        <input v-model="config.name" type="text" :placeholder="`My ${capitalizeFirst(config.type)} Server`" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
      </div>

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

      <div>
        <label class="block text-sm font-medium mb-2">API Key</label>
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
import { ref, onMounted, onUnmounted } from 'vue'
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

// Plex OAuth state
const showManualEntry = ref(false)
const plexAuthLoading = ref(false)
const plexAuthToken = ref(null)
const plexUser = ref(null)
const plexServers = ref([])
const loadingServers = ref(false)
const selectedServer = ref(null)
const testingServer = ref(null)
const serverTestResults = ref({})
const confirmingServer = ref(false)
const plexPinId = ref(null)
const plexAuthWindow = ref(null)
const pollInterval = ref(null)

onMounted(async () => {
  await loadConfig()
})

onUnmounted(() => {
  if (pollInterval.value) {
    clearInterval(pollInterval.value)
  }
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

const selectServerType = (type) => {
  config.value.type = type
  // Reset Plex OAuth state when switching types
  if (type !== 'plex') {
    resetPlexAuth()
  }
}

const startPlexAuth = async () => {
  plexAuthLoading.value = true
  
  try {
    // Create a PIN
    const response = await api.createPlexPin()
    const { id, authUrl } = response.data
    
    plexPinId.value = id
    
    // Open the Plex auth page in a popup
    const width = 600
    const height = 700
    const left = (window.innerWidth - width) / 2 + window.screenX
    const top = (window.innerHeight - height) / 2 + window.screenY
    
    plexAuthWindow.value = window.open(
      authUrl,
      'plex-auth',
      `width=${width},height=${height},left=${left},top=${top}`
    )
    
    // Start polling for authentication
    pollInterval.value = setInterval(async () => {
      try {
        const checkResponse = await api.checkPlexPin(id)
        
        if (checkResponse.data.authenticated) {
          // Success! Stop polling
          clearInterval(pollInterval.value)
          pollInterval.value = null
          
          plexAuthToken.value = checkResponse.data.authToken
          plexAuthLoading.value = false
          
          // Close the auth window if still open
          if (plexAuthWindow.value && !plexAuthWindow.value.closed) {
            plexAuthWindow.value.close()
          }
          
          toast.success('Successfully authenticated with Plex!')
          
          // Load user info and servers
          await loadPlexUserAndServers()
        }
      } catch (error) {
        console.error('Error checking PIN:', error)
      }
    }, 2000)
    
    // Stop polling after 10 minutes (PIN expires)
    setTimeout(() => {
      if (pollInterval.value) {
        clearInterval(pollInterval.value)
        pollInterval.value = null
        plexAuthLoading.value = false
        toast.error('Authentication timed out. Please try again.')
      }
    }, 600000)
    
  } catch (error) {
    console.error('Failed to start Plex auth:', error)
    toast.error('Failed to start Plex authentication')
    plexAuthLoading.value = false
  }
}

const loadPlexUserAndServers = async () => {
  loadingServers.value = true
  
  try {
    // Get user info
    const userResponse = await api.getPlexUser(plexAuthToken.value)
    plexUser.value = userResponse.data.user
    
    // Get servers
    const serversResponse = await api.getPlexServers(plexAuthToken.value)
    plexServers.value = serversResponse.data.servers
    
    // Auto-test connections for each server
    for (const server of plexServers.value) {
      testServerConnection(server)
    }
  } catch (error) {
    console.error('Failed to load Plex data:', error)
    toast.error('Failed to load Plex servers')
  } finally {
    loadingServers.value = false
  }
}

const testServerConnection = async (server) => {
  testingServer.value = server.clientIdentifier
  
  try {
    // Find the best working connection
    const response = await api.findPlexConnection(server)
    
    serverTestResults.value[server.clientIdentifier] = {
      success: response.data.success,
      connection: response.data.connection
    }
    
    // Update the server's preferred connection if found
    if (response.data.success && response.data.connection) {
      const idx = plexServers.value.findIndex(s => s.clientIdentifier === server.clientIdentifier)
      if (idx >= 0) {
        plexServers.value[idx].bestConnection = response.data.connection
      }
    }
  } catch (error) {
    serverTestResults.value[server.clientIdentifier] = { success: false }
  } finally {
    testingServer.value = null
  }
}

const selectPlexServer = (server) => {
  selectedServer.value = server
}

const confirmPlexServer = async () => {
  if (!selectedServer.value) return
  
  confirmingServer.value = true
  
  try {
    const server = selectedServer.value
    const testResult = serverTestResults.value[server.clientIdentifier]
    
    // Get the best connection URL
    const connectionUrl = testResult?.connection?.uri || 
                          server.bestConnection?.uri || 
                          server.preferredConnection?.uri ||
                          server.connections?.[0]?.uri
    
    if (!connectionUrl) {
      toast.error('Could not determine server connection URL')
      return
    }
    
    // Save the server
    await api.savePlexServer(server.name, connectionUrl, server.accessToken)
    
    // Update local config
    config.value.name = server.name
    config.value.url = connectionUrl
    config.value.api_key = server.accessToken
    
    toast.success(`Connected to ${server.name}!`)
    
    // Reset selection state
    selectedServer.value = null
    
  } catch (error) {
    console.error('Failed to save Plex server:', error)
    toast.error('Failed to save server configuration')
  } finally {
    confirmingServer.value = false
  }
}

const resetPlexAuth = () => {
  plexAuthToken.value = null
  plexUser.value = null
  plexServers.value = []
  selectedServer.value = null
  serverTestResults.value = {}
  showManualEntry.value = false
  
  if (pollInterval.value) {
    clearInterval(pollInterval.value)
    pollInterval.value = null
  }
  
  plexAuthLoading.value = false
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
  if (config.value.type === 'emby') {
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
