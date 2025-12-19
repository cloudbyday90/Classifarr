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
        <span>🎬</span>
        <span>Radarr Configuration</span>
      </h2>
      <p class="text-gray-400 text-sm">Configure your Radarr movie manager connection</p>
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
          <input v-model.number="config.port" type="number" placeholder="7878" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
        </div>
      </div>

      <!-- Base Path -->
      <div>
        <label class="block text-sm font-medium mb-2">
          Base Path <span class="text-gray-500 text-xs">(optional, for reverse proxy)</span>
        </label>
        <input v-model="config.base_path" type="text" placeholder="/radarr" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
      </div>

      <!-- API Key with PasswordInput component -->
      <div>
        <label class="block text-sm font-medium mb-2">API Key</label>
        <PasswordInput v-model="config.api_key" placeholder="Your Radarr API key" />
        <p class="text-xs text-gray-500 mt-1">Find in Radarr: Settings → General → Security → API Key</p>
      </div>

      <!-- SSL Verification -->
      <div>
        <Toggle v-model="config.verify_ssl" label="Verify SSL Certificate" />
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

    <!-- Connection Status - use existing component -->
    <ConnectionStatus 
      :status="connectionStatus.status" 
      :serviceName="connectionStatus.serviceName"
      :details="connectionStatus.details"
      :error="connectionStatus.error"
      :lastChecked="connectionStatus.lastChecked"
    />

    <!-- Advanced Settings -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <h3 class="text-lg font-medium mb-3">Advanced Settings</h3>
      <div>
        <label class="block text-sm font-medium mb-2">Timeout (seconds)</label>
        <input v-model.number="config.timeout" type="number" min="5" max="120" placeholder="30" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
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
  port: 7878,
  base_path: '',
  api_key: '',
  verify_ssl: true,
  timeout: 30
})

const loading = ref(false)
const saving = ref(false)
const connectionStatus = ref({
  status: 'idle',
  serviceName: 'Radarr',
  details: null,
  error: null,
  lastChecked: null
})

onMounted(async () => {
  await loadConfig()
})

const loadConfig = async () => {
  try {
    const response = await api.getRadarrConfig()
    if (response.data && response.data.length > 0) {
      const data = response.data[0]
      config.value = {
        id: data.id,
        protocol: data.protocol || 'http',
        host: data.host || 'localhost',
        port: data.port || 7878,
        base_path: data.base_path || '',
        api_key: data.api_key || '',
        verify_ssl: data.verify_ssl !== false,
        timeout: data.timeout || 30,
        name: data.name || 'Radarr'
      }
    }
  } catch (error) {
    console.error('Failed to load Radarr config:', error)
    toast.error('Failed to load configuration')
  }
}

const testConnection = async () => {
  loading.value = true
  connectionStatus.value = {
    status: 'testing',
    serviceName: 'Radarr',
    details: null,
    error: null,
    lastChecked: null
  }

  try {
    const response = await api.testRadarrConnection(config.value)
    
    if (response.data.success) {
      connectionStatus.value = {
        status: 'success',
        serviceName: 'Radarr',
        details: response.data.details,
        error: null,
        lastChecked: new Date()
      }
      toast.success('Successfully connected to Radarr')
    } else {
      connectionStatus.value = {
        status: 'error',
        serviceName: 'Radarr',
        details: null,
        error: response.data.error,
        lastChecked: new Date()
      }
      toast.error('Connection test failed')
    }
  } catch (error) {
    connectionStatus.value = {
      status: 'error',
      serviceName: 'Radarr',
      details: null,
      error: {
        message: error.response?.data?.error || error.message,
        troubleshooting: [
          'Check that Radarr is running',
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
  
  try {
    // Build URL from components for backward compatibility
    const url = `${config.value.protocol}://${config.value.host}:${config.value.port}${config.value.base_path || ''}`
    
    const payload = {
      name: config.value.name || 'Radarr',
      url: url,
      api_key: config.value.api_key,
      protocol: config.value.protocol,
      host: config.value.host,
      port: config.value.port,
      base_path: config.value.base_path,
      verify_ssl: config.value.verify_ssl,
      timeout: config.value.timeout,
      is_active: true
    }

    if (config.value.id) {
      await api.updateRadarrConfig(config.value.id, payload)
      toast.success('Radarr configuration updated successfully')
    } else {
      const response = await api.addRadarrConfig(payload)
      config.value.id = response.data.id
      toast.success('Radarr configuration saved successfully')
    }
  } catch (error) {
    console.error('Failed to save Radarr config:', error)
    toast.error('Failed to save configuration')
  } finally {
    saving.value = false
  }
}
</script>
