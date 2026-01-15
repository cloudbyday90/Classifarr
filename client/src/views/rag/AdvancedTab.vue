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

    <!-- Enhanced Retry Configuration -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Advanced Retry Configuration</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Warmup Timeout (ms)</label>
          <input
            v-model.number="retryConfig.warmup_timeout"
            type="number"
            min="10000"
            max="600000"
            step="1000"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-500">Extended timeout for cold model (default: 120000ms / 120s)</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Request Timeout (ms)</label>
          <input
            v-model.number="retryConfig.request_timeout"
            type="number"
            min="5000"
            max="300000"
            step="1000"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-500">Normal timeout for warm model (default: 30000ms / 30s)</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Backoff Multiplier</label>
          <input
            v-model.number="retryConfig.retry_backoff_multiplier"
            type="number"
            min="1"
            max="5"
            step="0.1"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-500">Exponential backoff multiplier (default: 2.0)</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Jitter Factor</label>
          <input
            v-model.number="retryConfig.jitter_factor"
            type="number"
            min="0"
            max="1"
            step="0.01"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-500">Randomization factor (0-1, default: 0.3 for ±30%)</p>
        </div>
      </div>

      <!-- Backoff Example Display -->
      <div class="bg-gray-900 rounded-lg p-4 mb-4">
        <h4 class="text-sm font-medium text-gray-300 mb-3">Example Backoff Sequence</h4>
        <div class="space-y-2">
          <div v-for="(delay, i) in exampleBackoffSequence" :key="i" class="flex items-center gap-2 text-sm">
            <span class="text-gray-500 w-20">Attempt {{ i + 1 }}:</span>
            <div class="flex-1 bg-gray-700 rounded h-2 relative overflow-hidden">
              <div 
                class="bg-blue-500 h-full rounded"
                :style="{ width: (delay / maxExampleDelay * 100) + '%' }"
              ></div>
            </div>
            <span class="text-gray-300 w-24 text-right">{{ delay }}ms</span>
          </div>
          <p class="text-xs text-gray-500 mt-3">
            With base delay of {{ retryConfig.retry_delay || 1000 }}ms, multiplier {{ retryConfig.retry_backoff_multiplier || 2 }}, 
            and jitter {{ retryConfig.jitter_factor || 0.3 }}. Actual delays will vary due to jitter.
          </p>
        </div>
      </div>

      <button
        @click="saveRetryConfig"
        :disabled="saving"
        class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
      >
        {{ saving ? 'Saving...' : 'Save Retry Configuration' }}
      </button>
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
import { ref, computed, onMounted } from 'vue'
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

const retryConfig = ref({
  request_timeout: 30000,
  warmup_timeout: 120000,
  max_retries: 3,
  retry_delay: 1000,
  retry_backoff_multiplier: 2.0,
  jitter_factor: 0.3
})

const saving = ref(false)
const saveMessage = ref('')
const saveSuccess = ref(false)

// Calculate example backoff sequence
const exampleBackoffSequence = computed(() => {
  const baseDelay = retryConfig.value.retry_delay || 1000
  const multiplier = retryConfig.value.retry_backoff_multiplier || 2
  const maxRetries = retryConfig.value.max_retries || 3
  
  const sequence = []
  for (let i = 0; i < maxRetries; i++) {
    const delay = baseDelay * Math.pow(multiplier, i)
    sequence.push(Math.round(delay))
  }
  return sequence
})

const maxExampleDelay = computed(() => {
  return Math.max(...exampleBackoffSequence.value)
})

const loadConfig = async () => {
  try {
    const [advancedRes, retryRes] = await Promise.all([
      api.get('/api/rag/advanced'),
      api.get('/api/settings/embedding/retry')
    ])
    
    config.value = {
      max_retries: advancedRes.data.max_retries ?? 3,
      retry_delay: advancedRes.data.retry_delay ?? 1000,
      request_timeout: advancedRes.data.request_timeout ?? 30000,
      cache_enabled: advancedRes.data.cache_enabled ?? false,
      cache_ttl: advancedRes.data.cache_ttl ?? 24,
      verbose_logging: advancedRes.data.verbose_logging ?? false,
      log_embedding_content: advancedRes.data.log_embedding_content ?? false
    }

    retryConfig.value = {
      request_timeout: retryRes.data.request_timeout ?? 30000,
      warmup_timeout: retryRes.data.warmup_timeout ?? 120000,
      max_retries: retryRes.data.max_retries ?? 3,
      retry_delay: retryRes.data.retry_delay ?? 1000,
      retry_backoff_multiplier: retryRes.data.retry_backoff_multiplier ?? 2.0,
      jitter_factor: retryRes.data.jitter_factor ?? 0.3
    }
  } catch (error) {
    console.error('Failed to load advanced config:', error)
  }
}

const saveRetryConfig = async () => {
  saving.value = true
  saveMessage.value = ''

  try {
    await api.put('/api/settings/embedding/retry', retryConfig.value)
    
    saveSuccess.value = true
    saveMessage.value = 'Retry configuration saved successfully'
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
