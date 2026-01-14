<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- Retry Configuration -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Retry Settings</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Max Retries</label>
          <input
            v-model.number="config.max_retries"
            type="number"
            min="0"
            max="10"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-500">Number of retry attempts on failure (default: 3)</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Retry Delay (ms)</label>
          <input
            v-model.number="config.retry_delay"
            type="number"
            min="100"
            max="10000"
            step="100"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-500">Delay between retries (default: 1000)</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Request Timeout (ms)</label>
          <input
            v-model.number="config.request_timeout"
            type="number"
            min="5000"
            max="120000"
            step="1000"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-500">Timeout for embedding requests (default: 30000)</p>
        </div>
      </div>
    </div>

    <!-- Caching -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold text-white mb-1">Caching</h3>
          <p class="text-sm text-gray-400">Enable embedding cache to reduce duplicate requests</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            v-model="config.cache_enabled"
            type="checkbox"
            class="sr-only peer"
          />
          <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      <div v-if="config.cache_enabled">
        <label class="block text-sm font-medium text-gray-300 mb-2">Cache TTL (hours)</label>
        <input
          v-model.number="config.cache_ttl"
          type="number"
          min="1"
          max="168"
          class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p class="mt-1 text-xs text-gray-500">How long to cache embeddings (default: 24 hours)</p>
      </div>
    </div>

    <!-- Debug Options -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Debug Options</h3>
      <div class="space-y-3">
        <div class="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
          <div>
            <p class="font-medium text-white">Verbose Logging</p>
            <p class="text-sm text-gray-400">Enable detailed logging for debugging</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              v-model="config.verbose_logging"
              type="checkbox"
              class="sr-only peer"
            />
            <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div class="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
          <div>
            <p class="font-medium text-white">Log Embedding Content</p>
            <p class="text-sm text-gray-400">Warning: Significantly increases log size</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              v-model="config.log_embedding_content"
              type="checkbox"
              class="sr-only peer"
            />
            <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
    </div>

    <!-- Danger Zone -->
    <div class="bg-red-900/20 border-2 border-red-500/50 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
        ⚠️ Danger Zone
      </h3>
      <div class="space-y-4">
        <div class="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
          <div class="flex-1">
            <p class="font-medium text-white mb-1">Clear All Embeddings</p>
            <p class="text-sm text-gray-400">Remove all generated embeddings. They will need to be regenerated.</p>
          </div>
          <button
            @click="confirmClearEmbeddings"
            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Clear Embeddings
          </button>
        </div>

        <div class="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
          <div class="flex-1">
            <p class="font-medium text-white mb-1">Reset RAG Configuration</p>
            <p class="text-sm text-gray-400">Reset all RAG settings to defaults.</p>
          </div>
          <button
            @click="confirmResetConfig"
            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>

    <!-- Save Button -->
    <div class="flex items-center gap-3">
      <button
        @click="saveAdvancedConfig"
        :disabled="saving"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ saving ? 'Saving...' : 'Save Advanced Settings' }}
      </button>
    </div>

    <div v-if="saveMessage" :class="[
      'p-4 rounded-lg',
      saveSuccess ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'
    ]">
      {{ saveMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'

const config = ref({
  max_retries: 3,
  retry_delay: 1000,
  request_timeout: 30000,
  cache_enabled: false,
  cache_ttl: 24,
  verbose_logging: false,
  log_embedding_content: false
})

const saving = ref(false)
const saveMessage = ref('')
const saveSuccess = ref(false)

const loadConfig = async () => {
  try {
    const response = await api.get('/api/rag/advanced')
    config.value = {
      max_retries: response.data.max_retries ?? 3,
      retry_delay: response.data.retry_delay ?? 1000,
      request_timeout: response.data.request_timeout ?? 30000,
      cache_enabled: response.data.cache_enabled ?? false,
      cache_ttl: response.data.cache_ttl ?? 24,
      verbose_logging: response.data.verbose_logging ?? false,
      log_embedding_content: response.data.log_embedding_content ?? false
    }
  } catch (error) {
    console.error('Failed to load advanced config:', error)
  }
}

const saveAdvancedConfig = async () => {
  saving.value = true
  saveMessage.value = ''

  try {
    await api.put('/api/rag/advanced', config.value)
    
    saveSuccess.value = true
    saveMessage.value = 'Advanced settings saved successfully'
  } catch (error) {
    saveSuccess.value = false
    saveMessage.value = error.response?.data?.error || error.message
  } finally {
    saving.value = false
    setTimeout(() => {
      saveMessage.value = ''
    }, 5000)
  }
}

const confirmClearEmbeddings = async () => {
  if (!confirm('Are you sure you want to clear all embeddings? This action cannot be undone.')) {
    return
  }

  try {
    await api.post('/api/rag/clear-embeddings')
    alert('All embeddings have been cleared')
  } catch (error) {
    alert('Failed to clear embeddings: ' + (error.response?.data?.error || error.message))
  }
}

const confirmResetConfig = async () => {
  if (!confirm('Are you sure you want to reset all RAG configuration to defaults? This action cannot be undone.')) {
    return
  }

  try {
    await api.post('/api/rag/reset-config')
    await loadConfig()
    alert('Configuration has been reset to defaults')
  } catch (error) {
    alert('Failed to reset configuration: ' + (error.response?.data?.error || error.message))
  }
}

onMounted(() => {
  loadConfig()
})
</script>
