<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- Status Cards Row -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400">Provider Status</p>
            <p :class="['text-2xl font-bold mt-1', stats.providerOnline ? 'text-green-400' : 'text-red-400']">
              {{ stats.providerOnline ? 'Online' : 'Offline' }}
            </p>
          </div>
          <span :class="['text-3xl', stats.providerOnline ? 'text-green-400' : 'text-red-400']">
            {{ stats.providerOnline ? '✓' : '✗' }}
          </span>
        </div>
      </div>

      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400">Total Embeddings</p>
            <p class="text-2xl font-bold text-white mt-1">
              {{ formatNumber(stats?.totalEmbeddings) }}
            </p>
          </div>
          <span class="text-3xl text-blue-400">💾</span>
        </div>
      </div>

      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400">Pending</p>
            <p :class="['text-2xl font-bold mt-1', (stats?.pendingCount || 0) > 0 ? 'text-yellow-400' : 'text-green-400']">
              {{ formatNumber(stats?.pendingCount) }}
            </p>
          </div>
          <span :class="['text-3xl', (stats?.pendingCount || 0) > 0 ? 'text-yellow-400' : 'text-green-400']">
            ⏱️
          </span>
        </div>
      </div>

      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400">Failed (24h)</p>
            <p :class="['text-2xl font-bold mt-1', (stats?.failedCount || 0) > 0 ? 'text-red-400' : 'text-green-400']">
              {{ formatNumber(stats?.failedCount) }}
            </p>
          </div>
          <span :class="['text-3xl', (stats?.failedCount || 0) > 0 ? 'text-red-400' : 'text-green-400']">
            {{ (stats?.failedCount || 0) > 0 ? '⚠️' : '✓' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Provider Settings -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Embedding Provider</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Mode</label>
          <select
            v-model="config.mode"
            @change="saveConfig"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="same">Same as Classification</option>
            <option value="separate_ollama">Separate Ollama Instance</option>
            <option value="cloud">Cloud Provider</option>
          </select>
        </div>

        <!-- Embedding Model for Same as Classification mode -->
        <div v-if="config.mode === 'same'" class="space-y-2">
          <label class="block text-sm font-medium text-gray-300 mb-2">Embedding Model</label>
          <select
            v-model="config.embedding_model"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option v-for="model in recommendedModels" :key="model.name" :value="model.name">
              {{ model.name }} - {{ model.description }}
            </option>
          </select>
          <p class="text-xs text-gray-400">Uses the same Ollama server as your AI classification provider</p>
        </div>

        <!-- Separate Ollama Config -->
        <div v-if="config.mode === 'separate_ollama'" class="space-y-4 p-4 bg-gray-700/30 rounded-lg">
          <h4 class="font-medium text-white">Ollama Configuration</h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Host</label>
              <input
                v-model="config.ollama_host"
                type="text"
                placeholder="192.168.1.100"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Port</label>
              <input
                v-model.number="config.ollama_port"
                type="number"
                placeholder="11434"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Model</label>
              <select
                v-model="config.ollama_model"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option v-for="model in recommendedModels" :key="model.name" :value="model.name">
                  {{ model.name }} - {{ model.description }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <!-- Cloud Provider Config -->
        <div v-if="config.mode === 'cloud'" class="space-y-4 p-4 bg-gray-700/30 rounded-lg">
          <h4 class="font-medium text-white">Cloud Provider Configuration</h4>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Provider</label>
              <select
                v-model="config.cloud_provider"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select provider</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
                <option value="voyage">Voyage AI</option>
                <option value="openrouter">OpenRouter</option>
                <option value="cohere">Cohere</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">API Key</label>
              <input
                v-model="config.cloud_api_key"
                type="password"
                placeholder="Enter API key"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Model</label>
              <input
                v-model="config.cloud_model"
                type="text"
                placeholder="text-embedding-3-small"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-3">
          <button
            @click="testConnection"
            :disabled="testing"
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ testing ? 'Testing...' : 'Test Connection' }}
          </button>
          <button
            @click="saveConfig"
            :disabled="saving"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ saving ? 'Saving...' : 'Save Configuration' }}
          </button>
        </div>

        <!-- Test Result -->
        <div v-if="testResult" :class="[
          'p-4 rounded-lg',
          testResult.success ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'
        ]">
          {{ testResult.success ? `✓ Connected successfully (${testResult.dims} dimensions)` : `✗ ${testResult.error}` }}
        </div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Recent Activity</h3>
      <div v-if="loading" class="text-center py-8 text-gray-400">
        Loading...
      </div>
      <div v-else-if="recentActivity.length === 0" class="text-center py-8 text-gray-400">
        No recent activity
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="item in recentActivity"
          :key="item.id"
          class="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg"
        >
          <span :class="[
            'w-2 h-2 rounded-full flex-shrink-0',
            item.level === 'error' ? 'bg-red-500' : item.level === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
          ]"></span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-400">{{ formatTimestamp(item.created_at) }}</span>
              <span class="text-xs px-2 py-0.5 bg-gray-600 rounded">{{ item.type }}</span>
            </div>
            <p class="text-sm text-white truncate">{{ item.message }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { CheckCircleIcon, XCircleIcon, CpuChipIcon, ServerStackIcon, ClockIcon } from '@heroicons/vue/24/outline'
import { useToast } from '@/stores/toast'

const props = defineProps(['provider'])
const toast = useToast()

const loading = ref(true)
const stats = ref({
  providerStatus: 'unknown',
  totalEmbeddings: 0,
  pendingEmbeddings: 0,
  failed24h: 0,
  providerOnline: false,
  heartbeatActive: false,
  queueSize: 0,
  lastEmbeddingTime: null
})
const config = ref({
  mode: 'same',
  embedding_model: 'nomic-embed-text',
  ollama_host: '',
  ollama_port: 11434,
  ollama_model: 'nomic-embed-text',
  cloud_provider: '',
  cloud_api_key: '',
  cloud_model: ''
})
const recentActivity = ref([])
const testing = ref(false)
const saving = ref(false)
const testResult = ref(null)

// Recommended Ollama embedding models
const recommendedModels = ref([
  { name: 'nomic-embed-text', description: '⭐ Recommended - 768 dims, fast' },
  { name: 'nomic-embed-text-v1.5', description: '768 dims, improved quality' },
  { name: 'mxbai-embed-large', description: 'State-of-art - 1024 dims' },
  { name: 'snowflake-arctic-embed2', description: 'Enterprise grade - 1024 dims' },
  { name: 'bge-m3', description: 'Multilingual - 1024 dims' },
  { name: 'bge-large', description: 'High precision - 1024 dims' },
  { name: 'all-minilm', description: 'Very fast - 384 dims' },
  { name: 'paraphrase-multilingual', description: 'Multilingual - 768 dims' }
])

const loadStats = async () => {
  try {
    loading.value = true
    
    // Error handler for failed API calls - returns empty data object to prevent crashes
    const handleApiError = () => ({ data: {} })
    
    const [overviewRes, configRes] = await Promise.all([
      api.get('/rag/status').catch(handleApiError),
      api.get('/settings/ai').catch(handleApiError)
    ])
    
    // Safely extract with defaults
    
    // Merge with defaults instead of replacing
    stats.value = {
      providerOnline: overviewRes.data?.providerOnline ?? false,
      totalEmbeddings: 0,
      pendingCount: 0,
      failedCount: 0,
      avgGenerationTime: 0,
      lastEmbeddingTime: null,
      ...overviewRes.data?.stats
    }
    
    recentActivity.value = overviewRes.data?.recentActivity || []
    
    // Load provider configuration with defaults
    const data = configRes.data || {}
    config.value = {
      mode: data.embedding_provider_mode || 'same',
      embedding_model: data.embedding_model || 'nomic-embed-text',
      ollama_host: data.embedding_ollama_host || '',
      ollama_port: data.embedding_ollama_port || 11434,
      ollama_model: data.embedding_ollama_model || 'nomic-embed-text',
      cloud_provider: data.embedding_cloud_provider || '',
      cloud_api_key: data.embedding_cloud_api_key || '',
      cloud_model: data.embedding_cloud_model || ''
    }
  } catch (error) {
    console.error('Failed to load overview:', error)
    // Keep default empty values to prevent component crash while displaying graceful fallback UI
  } finally {
    loading.value = false
  }
}

const loadActivity = async () => {
  try {
    const res = await api.get('/rag/activity')
    recentActivity.value = res.data
  } catch (error) {
    console.error('Failed to load activity:', error)
  }
}

const testConnection = async () => {
  testing.value = true
  testResult.value = null
  
  try {
    const response = await api.post('/rag/test-connection', {
      mode: config.value.mode,
      host: config.value.ollama_host,
      port: config.value.ollama_port,
      model: config.value.mode === 'same' ? config.value.embedding_model : config.value.ollama_model
    })
    
    if (response.data.success) {
      testResult.value = { 
        success: true, 
        dims: response.data.dims,
        message: `Connected successfully (${response.data.latency}ms)` 
      }
      toast.success(`Connected successfully (${response.data.dims} dimensions, ${response.data.latency}ms)`)
    } else {
      testResult.value = { success: false, error: response.data.error || 'Connection failed' }
      toast.error(response.data.error || 'Connection failed')
    }
  } catch (error) {
    testResult.value = {
      success: false,
      error: error.response?.data?.error || error.message
    }
    toast.error(error.response?.data?.error || error.message)
  } finally {
    testing.value = false
  }
}

const saveConfig = async () => {
  saving.value = true
  
  try {
    await api.put('/settings/ai', {
      rag_enabled: true, // Enable RAG when saving embedding configuration
      embedding_provider_mode: config.value.mode,
      embedding_model: config.value.embedding_model,
      embedding_ollama_host: config.value.ollama_host,
      embedding_ollama_port: config.value.ollama_port,
      embedding_ollama_model: config.value.ollama_model,
      embedding_cloud_provider: config.value.cloud_provider,
      embedding_cloud_api_key: config.value.cloud_api_key,
      embedding_cloud_model: config.value.cloud_model
    })
    toast.success('RAG configuration saved successfully')
    
    // Refresh stats to check provider status
    setTimeout(loadStats, 1000)
    
  } catch (error) {
    console.error('Failed to save config:', error)
    toast.error(error.response?.data?.error || 'Failed to save configuration')
  } finally {
    saving.value = false
  }
}

const formatNumber = (num) => {
  if (num == null) return '0'
  return num.toLocaleString()
}

const formatTime = (time) => {
  if (!time) return 'Never'
  const date = new Date(time)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const formatTimestamp = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  })
}

onMounted(() => {
  loadStats()
})
</script>
