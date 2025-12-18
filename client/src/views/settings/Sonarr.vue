<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2 flex items-center gap-2">
        <span>📺</span>
        <span>Sonarr Configuration</span>
      </h2>
      <p class="text-gray-400 text-sm">Configure your Sonarr TV series manager connection</p>
    </div>

    <!-- Connection Settings -->
    <div class="space-y-4">
      <h3 class="text-lg font-medium">Connection Settings</h3>
      
      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
        <!-- Protocol, Host, Port -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium mb-2">Protocol</label>
            <select
              v-model="config.protocol"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="http">http</option>
              <option value="https">https</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">Host</label>
            <input
              v-model="config.host"
              type="text"
              placeholder="localhost"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">Port</label>
            <input
              v-model.number="config.port"
              type="number"
              placeholder="8989"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <!-- Base Path -->
        <div>
          <label class="block text-sm font-medium mb-2">
            Base Path 
            <span class="text-gray-500 text-xs">(optional, for reverse proxy)</span>
          </label>
          <input
            v-model="config.base_path"
            type="text"
            placeholder="/sonarr"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- API Key -->
        <div>
          <label class="block text-sm font-medium mb-2">API Key</label>
          <div class="relative">
            <input
              v-model="config.api_key"
              :type="showApiKey ? 'text' : 'password'"
              placeholder="Your Sonarr API key"
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
          <p class="text-xs text-gray-500 mt-1">
            Find in Sonarr: Settings → General → Security → API Key
          </p>
        </div>

        <!-- SSL Verification -->
        <div>
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              v-model="config.verify_ssl"
              class="w-4 h-4 rounded"
            />
            <span class="text-sm">Verify SSL Certificate</span>
          </label>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-3">
        <button
          @click="testConnection"
          :disabled="loading || !config.host || !config.api_key"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {{ loading ? 'Testing...' : 'Test Connection' }}
        </button>
        <button
          @click="saveSettings"
          :disabled="saving || !config.host || !config.api_key"
          class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>

      <!-- Connection Status -->
      <ConnectionStatus :status="connectionStatus" />

      <!-- Advanced Settings -->
      <div class="mt-6">
        <h3 class="text-lg font-medium mb-3">Advanced Settings</h3>
        <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Timeout (seconds)</label>
            <input
              v-model.number="config.timeout"
              type="number"
              min="5"
              max="120"
              placeholder="30"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

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

const config = ref({
  protocol: 'http',
  host: 'localhost',
  port: 8989,
  base_path: '',
  api_key: '',
  verify_ssl: true,
  timeout: 30,
})

const showApiKey = ref(false)
const loading = ref(false)
const saving = ref(false)
const connectionStatus = ref(null)
const saveStatus = ref(null)

onMounted(async () => {
  try {
    const response = await axios.get('/api/settings/sonarr')
    if (response.data) {
      config.value = {
        protocol: response.data.protocol || 'http',
        host: response.data.host || 'localhost',
        port: response.data.port || 8989,
        base_path: response.data.base_path || '',
        api_key: response.data.api_key || '',
        verify_ssl: response.data.verify_ssl !== false,
        timeout: response.data.timeout || 30,
      }
    }
  } catch (error) {
    console.error('Failed to load Sonarr configuration:', error)
  }
})

const testConnection = async () => {
  loading.value = true
  connectionStatus.value = null
  try {
    const response = await axios.post('/api/settings/sonarr/test', config.value)
    connectionStatus.value = response.data
  } catch (error) {
    connectionStatus.value = {
      success: false,
      error: {
        message: error.response?.data?.error || error.message,
        troubleshooting: [
          'Check that Sonarr is running',
          'Verify the URL and port are correct',
          'Ensure the API key is valid',
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
    await axios.put('/api/settings/sonarr', config.value)
    saveStatus.value = { type: 'success', message: 'Sonarr settings saved successfully!' }
    
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
