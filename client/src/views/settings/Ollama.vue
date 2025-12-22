<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">Ollama AI Configuration</h2>
      <p class="text-gray-400 text-sm">Configure AI classification engine</p>
    </div>

    <!-- Connected Status Card (Plex-like UX) -->
    <div v-if="isConfigured && !isEditing" class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium flex items-center gap-2">
          <span class="text-purple-400">🤖</span>
          Connected to Ollama
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
          <div class="text-xs text-gray-500 uppercase tracking-widest mb-1">Model</div>
          <div class="font-medium truncate">{{ config.model }}</div>
        </div>
      </div>
      
      <ConnectionStatus 
        :status="connectionStatus.status" 
        :service-name="'Ollama'" 
        :details="connectionStatus.details"
        :error="connectionStatus.error"
        :last-checked="connectionStatus.lastChecked"
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

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-2">Host</label>
          <input
            v-model="config.host"
            type="text"
            placeholder="host.docker.internal"
            class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">Port</label>
          <input
            v-model.number="config.port"
            type="number"
            placeholder="11434"
            class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium mb-2">Model</label>
        <div class="flex gap-2">
          <select
            v-model="config.model"
            class="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option v-for="model in models" :key="model.name" :value="model.name">
              {{ model.name }}
            </option>
          </select>
          <button
            @click="refreshModels"
            :disabled="loadingModels"
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 rounded-lg transition-colors"
          >
            {{ loadingModels ? '...' : '🔄' }}
          </button>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium mb-2">
          Temperature: {{ config.temperature }}
        </label>
        <input
          v-model.number="config.temperature"
          type="range"
          min="0"
          max="1"
          step="0.01"
          class="w-full"
        />
        <div class="flex justify-between text-xs text-gray-500 mt-1">
          <span>More Deterministic</span>
          <span>More Creative</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex justify-end gap-3 pt-4 border-t border-gray-700">
        <button
          @click="testConnection"
          :disabled="loading"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
        >
          {{ loading ? 'Testing...' : 'Test Connection' }}
        </button>
        <button
          @click="saveConfig"
          :disabled="saving"
          class="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
        >
          {{ saving ? 'Saving Changes...' : 'Save Settings' }}
        </button>
      </div>
      
      <!-- Connection Status Overlay for Edit Mode -->
      <div v-if="connectionStatus.status === 'error' && isEditing" class="p-3 rounded-lg bg-red-900/30 text-red-400 border border-red-900/50">
        {{ connectionStatus.error }}
      </div>
      <div v-if="connectionStatus.status === 'success' && isEditing" class="p-3 rounded-lg bg-green-900/30 text-green-400 border border-green-900/50">
        {{ connectionStatus.details }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import ConnectionStatus from '@/components/common/ConnectionStatus.vue'

const config = ref({
  host: 'host.docker.internal',
  port: 11434,
  model: 'qwen3:14b',
  temperature: 0.30,
})

const models = ref([])
const loading = ref(false)
const saving = ref(false)
const loadingModels = ref(false)
const isEditing = ref(false)

// Determine if we have a saved configuration
// We check if we loaded data that looks valid. Host/Port defaults are essentially "not configured" if the user hasn't saved.
// But technically the endpoint returns defaults if nothing is in DB? 
// Let's assume if we got data from API, it's "configured" if it was strictly returned. 
// However, the backend likely returns defaults if empty. 
// Better heuristic: if we successfully loaded models or test connection previously passed?
// For now, let's treat it as configured if we loaded successfully, but force edit mode if it failed to load or is empty?
// Actually simpler: Treat as configured if we loaded data. User can always click edit.
const isConfigured = ref(false)

const connectionStatus = ref({
  status: 'idle',
  details: null,
  error: null,
  lastChecked: null
})

onMounted(async () => {
  try {
    const response = await axios.get('/api/settings/ollama')
    if (response.data) {
      config.value = {
        host: response.data.host || 'host.docker.internal',
        port: response.data.port || 11434,
        model: response.data.model || 'qwen3:14b',
        temperature: response.data.temperature || 0.30,
      }
      
      // If we got a response, mark as configured so we show the "Connected" card
      // Use 'unknown' status to show "Configuration Saved"
      isConfigured.value = true
      connectionStatus.value.status = 'unknown' 

      await refreshModels()
    }
  } catch (error) {
    console.error('Failed to load Ollama config:', error)
    // If failed to load, probably not configured or server error
    isEditing.value = true
  }
})

const refreshModels = async () => {
  loadingModels.value = true
  try {
    const response = await axios.get('/api/settings/ollama/models', {
      params: {
        host: config.value.host,
        port: config.value.port,
      },
    })
    models.value = response.data || []
    
    // Add current model if not in list
    if (config.value.model && !models.value.find(m => m.name === config.value.model)) {
      models.value.unshift({ name: config.value.model })
    }
  } catch (error) {
    console.error('Failed to fetch models:', error)
    models.value = [{ name: config.value.model }]
  } finally {
    loadingModels.value = false
  }
}

const testConnection = async () => {
  loading.value = true
  connectionStatus.value = { status: 'testing' }
  try {
    const response = await axios.post('/api/settings/ollama/test', {
      host: config.value.host,
      port: config.value.port,
    })
    
    if (response.data.success) {
      connectionStatus.value = {
        status: 'success',
        details: `Connection successful! Found ${response.data.models?.length || 0} models.`,
        lastChecked: new Date()
      }
      await refreshModels()
    } else {
      connectionStatus.value = {
        status: 'error',
        error: `Connection failed: ${response.data.error}`
      }
    }
  } catch (error) {
    connectionStatus.value = {
        status: 'error',
        error: `Connection failed: ${error.message}`
    }
  } finally {
    loading.value = false
  }
}

const saveConfig = async () => {
  saving.value = true
  connectionStatus.value.status = 'idle' // Reset status on save start to clear old errors
  try {
    await axios.put('/api/settings/ollama', config.value)
    
    // On success, exit edit mode and show "Saved" state
    isConfigured.value = true
    isEditing.value = false
    connectionStatus.value.status = 'unknown' // Configuration Saved
    
  } catch (error) {
    connectionStatus.value = {
        status: 'error',
        error: `Failed to save: ${error.message}`
    }
  } finally {
    saving.value = false
  }
}
</script>
