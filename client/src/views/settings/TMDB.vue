<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">TMDB Configuration</h2>
      <p class="text-gray-400 text-sm">Configure TMDB API for metadata enrichment</p>
    </div>

    <!-- Connected Status Card -->
    <div v-if="isConfigured && !isEditing" class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium flex items-center gap-2">
          <span class="text-blue-400">🎬</span>
          Connected to TMDB
        </h3>
        <button 
          @click="isEditing = true"
          class="text-sm px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
        >
          Change Settings
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div class="p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
          <div class="text-xs text-gray-500 uppercase tracking-widest mb-1">API Key</div>
          <div class="font-medium truncate">••••••••</div>
        </div>
        <div class="p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
          <div class="text-xs text-gray-500 uppercase tracking-widest mb-1">Language</div>
          <div class="font-medium">{{ language }}</div>
        </div>
      </div>
      
      <ConnectionStatus 
        :status="connectionStatus.status" 
        :service-name="'TMDB'" 
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

      <div>
        <label class="block text-sm font-medium mb-2">API Key</label>
        <div class="relative">
          <input
            v-model="apiKey"
            :type="showApiKey ? 'text' : 'password'"
            placeholder="Your TMDB API key"
            class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          Get your API key from <a href="https://www.themoviedb.org/settings/api" target="_blank" class="text-blue-400 hover:underline">TMDB Settings</a>
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium mb-2">Language</label>
        <input
          v-model="language"
          type="text"
          placeholder="en-US"
          class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div class="flex justify-end gap-3 pt-4 border-t border-gray-700">
        <button
          @click="testConnection"
          :disabled="loading || !apiKey"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
        >
          {{ loading ? 'Testing...' : 'Test Connection' }}
        </button>
        <button
          @click="saveConfig"
          :disabled="saving || !apiKey"
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
import { ref, onMounted } from 'vue'
import axios from 'axios'
import ConnectionStatus from '@/components/common/ConnectionStatus.vue'

const apiKey = ref('')
const language = ref('en-US')
const showApiKey = ref(false)
const loading = ref(false)
const saving = ref(false)

const isEditing = ref(false)
const isConfigured = ref(false)

const connectionStatus = ref({
  status: 'idle',
  details: null,
  error: null,
  lastChecked: null
})

onMounted(async () => {
  try {
    const response = await axios.get('/api/settings/tmdb')
    if (response.data) {
      apiKey.value = response.data.api_key || ''
      language.value = response.data.language || 'en-US'
      
      if (apiKey.value) {
        isConfigured.value = true
        connectionStatus.value.status = 'unknown'
      } else {
        isEditing.value = true
      }
    } else {
        isEditing.value = true
    }
  } catch (error) {
    console.error('Failed to load TMDB config:', error)
    isEditing.value = true
  }
})

const testConnection = async () => {
  loading.value = true
  connectionStatus.value = { status: 'testing' }
  try {
    const response = await axios.post('/api/settings/tmdb/test', {
      api_key: apiKey.value,
    })
    
    if (response.data.success) {
      connectionStatus.value = { 
          status: 'success', 
          details: 'Connection successful!',
          lastChecked: new Date()
      }
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
  connectionStatus.value.status = 'idle'
  try {
    await axios.put('/api/settings/tmdb', {
      api_key: apiKey.value,
      language: language.value,
    })
    
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
