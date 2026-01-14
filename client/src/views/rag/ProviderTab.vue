<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- Provider Mode Selection -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Embedding Provider Mode</h3>
      <div class="space-y-3">
        <label class="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors"
          :class="config.mode === 'same' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-600'">
          <input type="radio" v-model="config.mode" value="same" class="mt-1" />
          <div class="flex-1">
            <div class="font-medium text-white">Same as Classification</div>
            <div class="text-sm text-gray-400">Use the same Ollama instance configured for AI classification</div>
          </div>
        </label>

        <label class="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors"
          :class="config.mode === 'separate_ollama' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-600'">
          <input type="radio" v-model="config.mode" value="separate_ollama" class="mt-1" />
          <div class="flex-1">
            <div class="font-medium text-white">Separate Ollama Instance</div>
            <div class="text-sm text-gray-400">Use a dedicated Ollama server for embeddings</div>
          </div>
        </label>

        <label class="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors"
          :class="config.mode === 'cloud' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-600'">
          <input type="radio" v-model="config.mode" value="cloud" class="mt-1" />
          <div class="flex-1">
            <div class="font-medium text-white">Cloud Provider</div>
            <div class="text-sm text-gray-400">Use OpenAI, Gemini, Voyage, OpenRouter, or Cohere</div>
          </div>
        </label>
      </div>
    </div>

    <!-- Separate Ollama Config -->
    <div v-if="config.mode === 'separate_ollama'" class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Ollama Configuration</h3>
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
          <input
            v-model="config.ollama_model"
            type="text"
            placeholder="nomic-embed-text"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>

    <!-- Cloud Provider Config -->
    <div v-if="config.mode === 'cloud'" class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Cloud Provider Configuration</h3>
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

    <!-- Save Result -->
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
  mode: 'same',
  ollama_host: '',
  ollama_port: 11434,
  ollama_model: '',
  cloud_provider: '',
  cloud_api_key: '',
  cloud_model: ''
})

const testing = ref(false)
const saving = ref(false)
const testResult = ref(null)
const saveMessage = ref('')
const saveSuccess = ref(false)

const loadConfig = async () => {
  try {
    const response = await api.get('/api/settings/ai')
    const data = response.data
    
    config.value = {
      mode: data.embedding_provider_mode || 'same',
      ollama_host: data.embedding_ollama_host || '',
      ollama_port: data.embedding_ollama_port || 11434,
      ollama_model: data.embedding_ollama_model || '',
      cloud_provider: data.embedding_cloud_provider || '',
      cloud_api_key: data.embedding_cloud_api_key || '',
      cloud_model: data.embedding_cloud_model || ''
    }
  } catch (error) {
    console.error('Failed to load config:', error)
  }
}

const testConnection = async () => {
  testing.value = true
  testResult.value = null
  
  try {
    const response = await api.post('/api/rag/test', {
      text: 'Test embedding for Classifarr'
    })
    
    testResult.value = {
      success: true,
      dims: response.data.dims || 'unknown'
    }
  } catch (error) {
    testResult.value = {
      success: false,
      error: error.response?.data?.error || error.message
    }
  } finally {
    testing.value = false
  }
}

const saveConfig = async () => {
  saving.value = true
  saveMessage.value = ''
  
  try {
    await api.put('/api/settings/ai', {
      embedding_provider_mode: config.value.mode,
      embedding_ollama_host: config.value.ollama_host,
      embedding_ollama_port: config.value.ollama_port,
      embedding_ollama_model: config.value.ollama_model,
      embedding_cloud_provider: config.value.cloud_provider,
      embedding_cloud_api_key: config.value.cloud_api_key,
      embedding_cloud_model: config.value.cloud_model
    })
    
    saveSuccess.value = true
    saveMessage.value = 'Configuration saved successfully'
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

onMounted(() => {
  loadConfig()
})
</script>
