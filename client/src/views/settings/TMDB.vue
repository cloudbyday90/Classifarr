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

    <div class="space-y-4">
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

      <div v-if="status" :class="['p-3 rounded-lg', status.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400']">
        {{ status.message }}
      </div>

      <div class="flex gap-3">
        <button
          @click="testConnection"
          :disabled="loading || !apiKey"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {{ loading ? 'Testing...' : 'Test Connection' }}
        </button>
        <button
          @click="saveConfig"
          :disabled="saving || !apiKey"
          class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {{ saving ? 'Saving...' : 'Save Configuration' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const apiKey = ref('')
const language = ref('en-US')
const showApiKey = ref(false)
const loading = ref(false)
const saving = ref(false)
const status = ref(null)

onMounted(async () => {
  try {
    const response = await axios.get('/api/settings/tmdb')
    if (response.data) {
      apiKey.value = response.data.api_key || ''
      language.value = response.data.language || 'en-US'
    }
  } catch (error) {
    console.error('Failed to load TMDB config:', error)
  }
})

const testConnection = async () => {
  loading.value = true
  status.value = null
  try {
    const response = await axios.post('/api/settings/tmdb/test', {
      api_key: apiKey.value,
    })
    
    if (response.data.success) {
      status.value = { type: 'success', message: 'Connection successful!' }
    } else {
      status.value = { type: 'error', message: `Connection failed: ${response.data.error}` }
    }
  } catch (error) {
    status.value = { type: 'error', message: `Connection failed: ${error.message}` }
  } finally {
    loading.value = false
  }
}

const saveConfig = async () => {
  saving.value = true
  status.value = null
  try {
    await axios.put('/api/settings/tmdb', {
      api_key: apiKey.value,
      language: language.value,
    })
    status.value = { type: 'success', message: 'Configuration saved successfully!' }
  } catch (error) {
    status.value = { type: 'error', message: `Failed to save: ${error.message}` }
  } finally {
    saving.value = false
  }
}
</script>
