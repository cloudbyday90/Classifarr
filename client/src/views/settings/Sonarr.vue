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
        <span>📺</span>
        <span>Sonarr Configuration</span>
      </h2>
      <p class="text-gray-400 text-sm">Configure your Sonarr TV series manager connection</p>
    </div>

    <!-- Connected Status Card -->
    <div v-if="isConfigured && !isEditing" class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium flex items-center gap-2">
          <span class="text-green-400">✅</span>
          Connected to Sonarr
        </h3>
        <button 
          @click="isEditing = true"
          class="text-sm px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
        >
          Change Settings
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div class="p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
          <div class="text-xs text-gray-500 uppercase tracking-widest mb-1">Host</div>
          <div class="font-medium truncate">{{ config.host }}</div>
        </div>
        <div class="p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
          <div class="text-xs text-gray-500 uppercase tracking-widest mb-1">Port</div>
          <div class="font-medium">{{ config.port }}</div>
        </div>
        <div class="p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
          <div class="text-xs text-gray-500 uppercase tracking-widest mb-1">Base Path</div>
          <div class="font-medium truncate">{{ config.base_path || '/' }}</div>
        </div>
      </div>

      <ConnectionStatus 
        :status="connectionStatus.status" 
        :serviceName="connectionStatus.serviceName"
        :details="connectionStatus.details"
        :error="connectionStatus.error"
        :lastChecked="connectionStatus.lastChecked"
        @test="testConnection"
      />

      <div class="mt-4 flex justify-end border-t border-gray-700 pt-4">
        <button
          @click="testConnection"
          :disabled="loading"
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <span>{{ loading ? 'Testing...' : 'Test Connection' }}</span>
          <span v-if="!loading">🔄</span>
        </button>
      </div>
    </div>

    <!-- Configuration Form -->
    <div v-else class="space-y-4">
      <div v-if="isConfigured" class="flex justify-end">
        <button 
          @click="isEditing = false"
          class="text-sm text-gray-400 hover:text-white"
        >
          Cancel Editing
        </button>
      </div>

      <!-- Connection Settings Card -->
      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
        <!-- Protocol, Host, Port row -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium mb-2">Protocol</label>
            <select v-model="config.protocol" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg">
              <option value="http">http</option>
              <option value="https">https</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Host</label>
            <input v-model="config.host" type="text" placeholder="localhost" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Port</label>
            <input v-model.number="config.port" type="number" placeholder="8989" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
          </div>
        </div>

        <!-- Base Path -->
        <div>
          <label class="block text-sm font-medium mb-2">
            Base Path <span class="text-gray-500 text-xs">(optional, for reverse proxy)</span>
          </label>
          <input v-model="config.base_path" type="text" placeholder="/sonarr" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
        </div>

        <!-- API Key with PasswordInput component -->
        <div>
          <label class="block text-sm font-medium mb-2">API Key</label>
          <PasswordInput v-model="config.api_key" placeholder="Your Sonarr API key" />
          <p class="text-xs text-gray-500 mt-1">Find in Sonarr: Settings → General → Security → API Key</p>
        </div>

        <!-- SSL Verification -->
        <div>
          <Toggle v-model="config.verify_ssl" label="Verify SSL Certificate" />
        </div>
      </div>

      <!-- Media Server Association -->
      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h3 class="text-lg font-medium mb-3">Media Server Association</h3>
        <p class="text-sm text-gray-400 mb-3">Link this Sonarr instance to a media server for library mapping and re-classification.</p>
        <div>
          <label class="block text-sm font-medium mb-2">Associated Media Server</label>
          <select 
            v-model="config.media_server_id" 
            class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg"
          >
            <option :value="null">None (Not linked)</option>
            <option v-for="server in mediaServers" :key="server.id" :value="server.id">
              {{ server.name }} ({{ server.type }})
            </option>
          </select>
          <p class="text-xs text-gray-500 mt-1">Required for re-classification feature</p>
        </div>
      </div>

      <!-- Advanced Settings -->
      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h3 class="text-lg font-medium mb-3">Advanced Settings</h3>
        <div>
          <label class="block text-sm font-medium mb-2">Timeout (seconds)</label>
          <input v-model.number="config.timeout" type="number" min="5" max="120" placeholder="30" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-3 pt-4 border-t border-gray-700">
        <button @click="testConnection" :disabled="loading" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg font-medium">
          {{ loading ? 'Testing...' : 'Test Connection' }}
        </button>
        <button @click="saveSettings" :disabled="saving" class="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-medium">
          {{ saving ? 'Saving Changes...' : 'Save Settings' }}
        </button>
      </div>

      <!-- Connection Status Overlay -->
      <div v-if="connectionStatus.status === 'error' && isEditing" class="p-3 rounded-lg bg-red-900/30 text-red-400 border border-red-900/50">
        {{ connectionStatus.error?.message || connectionStatus.error }}
      </div>
      <div v-if="connectionStatus.status === 'success' && isEditing" class="p-3 rounded-lg bg-green-900/30 text-green-400 border border-green-900/50">
        Connection Successful!
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'
import ConnectionStatus from '@/components/common/ConnectionStatus.vue'
import PasswordInput from '@/components/common/PasswordInput.vue'
import Toggle from '@/components/common/Toggle.vue'

const toast = useToast()

const config = ref({
  protocol: 'http',
  host: 'localhost',
  port: 8989,
  base_path: '',
  api_key: '',
  verify_ssl: true,
  timeout: 30,
  media_server_id: null
})

const mediaServers = ref([])

const loading = ref(false)
const saving = ref(false)
const isEditing = ref(false)
const isConfigured = ref(false)

const connectionStatus = ref({
  status: 'idle',
  serviceName: 'Sonarr',
  details: null,
  error: null,
  lastChecked: null
})

onMounted(async () => {
  await loadMediaServers()
  await loadConfig()
})

const loadMediaServers = async () => {
  try {
    const response = await api.getMediaServers()
    mediaServers.value = response.data || []
  } catch (error) {
    console.error('Failed to load media servers:', error)
  }
}

const loadConfig = async () => {
  try {
    const response = await api.getSonarrConfig()
    if (response.data && response.data.length > 0) {
      const data = response.data[0]
      config.value = {
        id: data.id,
        protocol: data.protocol || 'http',
        host: data.host || 'localhost',
        port: data.port || 8989,
        base_path: data.base_path || '',
        api_key: data.api_key || '',
        verify_ssl: data.verify_ssl !== false,
        timeout: data.timeout || 30,
        name: data.name || 'Sonarr',
        media_server_id: data.media_server_id || null
      }
      
      // If we have an ID, it's a saved config
      if (data.id) {
        isConfigured.value = true
        connectionStatus.value.status = 'unknown'
      } else {
        isEditing.value = true
      }
    } else {
      isEditing.value = true
    }
  } catch (error) {
    console.error('Failed to load Sonarr config:', error)
    toast.error('Failed to load configuration')
    isEditing.value = true
  }
}

const testConnection = async () => {
  loading.value = true
  connectionStatus.value = {
    status: 'testing',
    serviceName: 'Sonarr',
    details: null,
    error: null,
    lastChecked: null
  }

  try {
    const response = await api.testSonarrConnection(config.value)
    
    if (response.data.success) {
      connectionStatus.value = {
        status: 'success',
        serviceName: 'Sonarr',
        details: response.data.details,
        error: null,
        lastChecked: new Date()
      }
      toast.success('Successfully connected to Sonarr')
    } else {
      connectionStatus.value = {
        status: 'error',
        serviceName: 'Sonarr',
        details: null,
        error: response.data.error,
        lastChecked: new Date()
      }
      toast.error('Connection test failed')
    }
  } catch (error) {
    connectionStatus.value = {
      status: 'error',
      serviceName: 'Sonarr',
      details: null,
      error: {
        message: error.response?.data?.error || error.message,
        troubleshooting: [
          'Check that Sonarr is running',
          'Verify the URL and port are correct',
          'Ensure the API key is valid'
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
  connectionStatus.value.status = 'idle'
  
  try {
    // Build URL from components for backward compatibility
    const url = `${config.value.protocol}://${config.value.host}:${config.value.port}${config.value.base_path || ''}`
    
    const payload = {
      name: config.value.name || 'Sonarr',
      url: url,
      api_key: config.value.api_key,
      protocol: config.value.protocol,
      host: config.value.host,
      port: config.value.port,
      base_path: config.value.base_path,
      verify_ssl: config.value.verify_ssl,
      timeout: config.value.timeout,
      is_active: true,
      media_server_id: config.value.media_server_id
    }

    if (config.value.id) {
      await api.updateSonarrConfig(config.value.id, payload)
      toast.success('Sonarr configuration updated successfully')
    } else {
      const response = await api.addSonarrConfig(payload)
      config.value.id = response.data.id
      toast.success('Sonarr configuration saved successfully')
    }
    
    isConfigured.value = true
    isEditing.value = false
    connectionStatus.value.status = 'unknown' // Configuration Saved

  } catch (error) {
    console.error('Failed to save Sonarr config:', error)
    toast.error('Failed to save configuration')
    connectionStatus.value = {
      status: 'error',
      serviceName: 'Sonarr',
      error: { message: error.message }
    }
  } finally {
    saving.value = false
  }
}
</script>
