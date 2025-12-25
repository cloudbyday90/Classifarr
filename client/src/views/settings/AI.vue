<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- Primary AI Provider Card -->
    <Card title="🤖 AI Provider">
      <div v-if="loading" class="text-center py-8">
        <Spinner />
        <p class="text-gray-400 mt-2">Loading AI configuration...</p>
      </div>

      <div v-else class="space-y-6">
        <!-- Provider Selection -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Primary Provider</label>
          <select 
            v-model="config.primary_provider" 
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            @change="onProviderChange"
          >
            <option value="none">No Provider (AI Disabled)</option>
            <option value="ollama">Ollama (Local)</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Google Gemini</option>
            <option value="openrouter">OpenRouter</option>
            <option value="litellm">LiteLLM</option>
            <option value="custom">Custom OpenAI-Compatible</option>
          </select>
          <p class="text-xs text-gray-500 mt-1">
            <span v-if="config.primary_provider === 'none'">AI classification is disabled. Enable a provider to use AI features.</span>
            <span v-else-if="config.primary_provider === 'ollama'">Using local Ollama instance - no API costs.</span>
            <span v-else-if="config.primary_provider === 'openai'">Using OpenAI API (GPT-5, o3, etc) - costs per token.</span>
            <span v-else-if="config.primary_provider === 'gemini'">Using Google Gemini API (Gemini 2.0) - costs per token.</span>
            <span v-else-if="config.primary_provider === 'openrouter'">Access 100+ models via OpenRouter - costs vary by model.</span>
            <span v-else-if="config.primary_provider === 'litellm'">LiteLLM proxy for multiple LLM providers.</span>
            <span v-else>Custom OpenAI-compatible endpoint.</span>
          </p>
        </div>

        <!-- Cloud Provider Settings (not shown for Ollama or None) -->
        <div v-if="isCloudProvider" class="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <h3 class="font-medium text-gray-200">Cloud Provider Settings</h3>
          
          <!-- API Endpoint (Custom only) -->
          <div v-if="config.primary_provider === 'custom' || config.primary_provider === 'litellm'">
            <label class="block text-sm font-medium text-gray-300 mb-2">API Endpoint</label>
            <input 
              v-model="config.api_endpoint"
              type="url"
              placeholder="https://your-api-endpoint.com/v1"
              class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <!-- API Key -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">API Key</label>
            <PasswordInput 
              v-model="config.api_key" 
              placeholder="Enter your API key"
            />
            <p class="text-xs text-gray-500 mt-1">
              <template v-if="config.primary_provider === 'openai'">
                Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" class="text-blue-400 hover:underline">platform.openai.com</a>
              </template>
              <template v-else-if="config.primary_provider === 'gemini'">
                Get your key from <a href="https://aistudio.google.com/apikey" target="_blank" class="text-blue-400 hover:underline">aistudio.google.com</a>
              </template>
              <template v-else-if="config.primary_provider === 'openrouter'">
                Get your key from <a href="https://openrouter.ai/keys" target="_blank" class="text-blue-400 hover:underline">openrouter.ai</a>
              </template>
            </p>
          </div>

          <!-- Model Selection -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Model</label>
            <div class="flex gap-2">
              <select 
                v-model="config.model"
                class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Select a model...</option>
                <option v-for="model in availableModels" :key="model.id" :value="model.id">
                  {{ model.name }}
                </option>
              </select>
              <Button 
                variant="secondary" 
                size="sm" 
                @click="fetchModels"
                :disabled="loadingModels || !config.api_key"
              >
                <span v-if="loadingModels">Loading...</span>
                <span v-else>🔄 Fetch</span>
              </Button>
            </div>
          </div>

          <!-- Test Connection -->
          <div class="flex items-center gap-4">
            <Button 
              variant="secondary" 
              @click="testConnection"
              :disabled="testing || !config.api_key"
            >
              <span v-if="testing">Testing...</span>
              <span v-else>🔌 Test Connection</span>
            </Button>
            <span v-if="testResult" :class="testResult.success ? 'text-green-400' : 'text-red-400'">
              {{ testResult.message || testResult.error }}
            </span>
          </div>
        </div>

        <!-- Advanced Settings -->
        <div v-if="config.primary_provider !== 'none'" class="space-y-4">
          <button 
            @click="showAdvanced = !showAdvanced"
            class="text-sm text-gray-400 hover:text-white flex items-center gap-1"
          >
            <span>{{ showAdvanced ? '▼' : '▶' }}</span>
            Advanced Settings
          </button>
          
          <div v-if="showAdvanced" class="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Temperature</label>
                <input 
                  v-model.number="config.temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                />
                <p class="text-xs text-gray-500 mt-1">0 = deterministic, 1 = creative</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Max Tokens</label>
                <input 
                  v-model.number="config.max_tokens"
                  type="number"
                  min="100"
                  max="16000"
                  class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- Budget Controls (Cloud providers only) -->
    <Card v-if="isCloudProvider" title="💰 Budget Controls">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Monthly Budget (USD)</label>
          <div class="flex items-center gap-2">
            <span class="text-gray-400">$</span>
            <input 
              v-model.number="config.monthly_budget_usd"
              type="number"
              step="1"
              min="0"
              placeholder="No limit"
              class="w-32 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
            />
            <span class="text-sm text-gray-400">Leave empty for no limit</span>
          </div>
        </div>

        <!-- Usage Progress Bar -->
        <div v-if="config.monthly_budget_usd">
          <div class="flex justify-between text-sm mb-2">
            <span class="text-gray-400">Current Usage</span>
            <span :class="budgetPercentUsed > 80 ? 'text-red-400' : 'text-green-400'">
              ${{ (config.current_month_usage_usd || 0).toFixed(2) }} / ${{ config.monthly_budget_usd.toFixed(2) }}
            </span>
          </div>
          <div class="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div 
              class="h-3 rounded-full transition-all duration-500"
              :class="budgetPercentUsed > 80 ? 'bg-red-500' : budgetPercentUsed > 50 ? 'bg-yellow-500' : 'bg-green-500'"
              :style="{ width: `${Math.min(budgetPercentUsed, 100)}%` }"
            ></div>
          </div>
          <div class="text-sm text-gray-500 mt-1">{{ budgetPercentUsed }}% used</div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Alert Threshold</label>
          <div class="flex items-center gap-2">
            <input 
              v-model.number="config.budget_alert_threshold"
              type="range"
              min="50"
              max="100"
              class="flex-1"
            />
            <span class="text-sm text-gray-400 w-12">{{ config.budget_alert_threshold }}%</span>
          </div>
        </div>

        <Toggle 
          v-model="config.pause_on_budget_exhausted" 
          label="Pause AI when budget exhausted (fallback to Ollama if enabled)"
        />
      </div>
    </Card>

    <!-- Ollama Fallback Settings -->
    <Card v-if="config.primary_provider !== 'ollama'" title="🦙 Ollama Fallback">
      <div class="space-y-4">
        <p class="text-sm text-gray-400">
          Ollama can be used as a fallback for basic tasks or when cloud budget is exhausted.
        </p>

        <Toggle 
          v-model="config.ollama_fallback_enabled" 
          label="Enable Ollama as fallback"
        />

        <div v-if="config.ollama_fallback_enabled" class="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <h4 class="font-medium text-gray-300">Use Ollama for:</h4>
          
          <div class="space-y-2">
            <Toggle 
              v-model="config.ollama_for_basic_tasks" 
              label="Basic classification tasks (save cloud costs)"
            />
            <Toggle 
              v-model="config.ollama_for_budget_exhausted" 
              label="When cloud budget is exhausted"
            />
          </div>

          <div class="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Ollama Host</label>
              <input 
                v-model="config.ollama_host"
                type="text"
                placeholder="http://ollama:11434"
                class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Ollama Model</label>
              <input 
                v-model="config.ollama_model"
                type="text"
                placeholder="llama3.2"
                class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              />
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- Ollama Primary Settings (shown when Ollama is primary) -->
    <Card v-if="config.primary_provider === 'ollama'" title="🦙 Ollama Settings">
      <div class="space-y-4">
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Ollama Host</label>
            <input 
              v-model="config.ollama_host"
              type="text"
              placeholder="192.168.1.100"
              class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Port</label>
            <input 
              v-model.number="config.ollama_port"
              type="number"
              placeholder="11434"
              class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Model</label>
            <div class="flex gap-2">
              <select 
                v-model="config.ollama_model"
                class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              >
                <option v-if="ollamaModels.length === 0" value="">-- Select model --</option>
                <option v-for="model in ollamaModels" :key="model.name" :value="model.name">
                  {{ model.name }}
                </option>
              </select>
              <Button 
                variant="secondary" 
                size="sm" 
                @click="fetchOllamaModels"
                :disabled="loadingOllamaModels"
              >
                <span v-if="loadingOllamaModels">...</span>
                <span v-else>🔄</span>
              </Button>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <Button variant="secondary" @click="testOllamaConnection" :disabled="testingOllama">
            <span v-if="testingOllama">Testing...</span>
            <span v-else>🔌 Test Connection</span>
          </Button>
          <span v-if="ollamaTestResult" :class="ollamaTestResult.success ? 'text-green-400' : 'text-red-400'">
            {{ ollamaTestResult.message || ollamaTestResult.error }}
          </span>
        </div>
      </div>
    </Card>

    <!-- Usage Statistics -->
    <Card v-if="isCloudProvider && usageStats" title="📊 Usage Statistics">
      <div class="space-y-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-gray-800/50 p-4 rounded-lg">
            <div class="text-2xl font-bold text-blue-400">{{ usageStats.currentMonth.requests }}</div>
            <div class="text-sm text-gray-400">Requests This Month</div>
          </div>
          <div class="bg-gray-800/50 p-4 rounded-lg">
            <div class="text-2xl font-bold text-green-400">{{ formatTokens(usageStats.currentMonth.tokens) }}</div>
            <div class="text-sm text-gray-400">Tokens Used</div>
          </div>
          <div class="bg-gray-800/50 p-4 rounded-lg">
            <div class="text-2xl font-bold text-yellow-400">${{ usageStats.currentMonth.cost.toFixed(4) }}</div>
            <div class="text-sm text-gray-400">Total Cost</div>
          </div>
          <div class="bg-gray-800/50 p-4 rounded-lg">
            <div class="text-2xl font-bold text-purple-400">${{ usageStats.currentMonth.avgCostPerCall.toFixed(6) }}</div>
            <div class="text-sm text-gray-400">Avg Cost/Call</div>
          </div>
        </div>

        <div v-if="usageStats.lastMonth.requests > 0" class="text-sm text-gray-500">
          Last month: {{ usageStats.lastMonth.requests }} requests, ${{ usageStats.lastMonth.cost.toFixed(2) }} total
        </div>
      </div>
    </Card>

    <!-- Save Button -->
    <div class="flex justify-end">
      <Button @click="saveConfig" :disabled="saving">
        <span v-if="saving">Saving...</span>
        <span v-else>💾 Save Changes</span>
      </Button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Toggle from '@/components/common/Toggle.vue'
import Spinner from '@/components/common/Spinner.vue'
import PasswordInput from '@/components/common/PasswordInput.vue'
import api from '@/api'
import { useToast } from '@/stores/toast'

const toast = useToast()
const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const testingOllama = ref(false)
const loadingModels = ref(false)
const loadingOllamaModels = ref(false)
const showAdvanced = ref(false)
const testResult = ref(null)
const ollamaTestResult = ref(null)
const availableModels = ref([])
const ollamaModels = ref([])
const usageStats = ref(null)

const config = ref({
  primary_provider: 'none',
  api_endpoint: '',
  api_key: '',
  model: '',
  temperature: 0.7,
  max_tokens: 2000,
  monthly_budget_usd: null,
  current_month_usage_usd: 0,
  budget_alert_threshold: 80,
  pause_on_budget_exhausted: true,
  ollama_fallback_enabled: false,
  ollama_for_basic_tasks: false,
  ollama_for_budget_exhausted: true,
  ollama_host: 'localhost',
  ollama_port: 11434,
  ollama_model: 'llama3.2'
})

const isCloudProvider = computed(() => {
  return ['openai', 'gemini', 'openrouter', 'litellm', 'custom'].includes(config.value.primary_provider)
})

const budgetPercentUsed = computed(() => {
  if (!config.value.monthly_budget_usd) return 0
  return Math.round((config.value.current_month_usage_usd / config.value.monthly_budget_usd) * 100)
})

// Helper to parse a URL string and extract host and port
const parseOllamaHost = (hostValue) => {
  if (!hostValue) return { host: 'localhost', port: 11434 }
  
  // If it's already just a hostname/IP, return as-is
  if (!hostValue.includes('://') && !hostValue.includes(':')) {
    return { host: hostValue, port: 11434 }
  }
  
  try {
    // Handle full URL like http://192.168.50.95:11434
    let url = hostValue
    if (!url.includes('://')) {
      url = 'http://' + url
    }
    const parsed = new URL(url)
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 11434
    }
  } catch (e) {
    // If parsing fails, just strip protocol and port manually
    let host = hostValue.replace(/^https?:\/\//, '')
    const portMatch = host.match(/:(\d+)/)
    if (portMatch) {
      return { host: host.split(':')[0], port: parseInt(portMatch[1]) }
    }
    return { host: host, port: 11434 }
  }
}

onMounted(async () => {
  try {
    const [configResponse, usageResponse] = await Promise.all([
      api.getAIConfig(),
      api.getAIUsage().catch(() => null)
    ])
    
    if (configResponse.data) {
      const loadedConfig = { ...config.value, ...configResponse.data }
      
      // Parse ollama_host if it contains a full URL (legacy format)
      if (loadedConfig.ollama_host && (loadedConfig.ollama_host.includes('://') || loadedConfig.ollama_host.includes(':'))) {
        const parsed = parseOllamaHost(loadedConfig.ollama_host)
        loadedConfig.ollama_host = parsed.host
        loadedConfig.ollama_port = parsed.port
      }
      
      config.value = loadedConfig
      
      // Seed Ollama models with current selection so it's visible
      if (loadedConfig.ollama_model) {
        ollamaModels.value = [{ name: loadedConfig.ollama_model }]
      }
    }
    if (usageResponse?.data) {
      usageStats.value = usageResponse.data
    }
  } catch (error) {
    console.error('Failed to load AI config:', error)
    toast.error('Failed to load AI configuration')
  } finally {
    loading.value = false
  }
})

const onProviderChange = () => {
  testResult.value = null
  availableModels.value = []
  config.value.model = ''
}

const fetchModels = async () => {
  loadingModels.value = true
  try {
    const response = await api.getAIModels({
      primary_provider: config.value.primary_provider,
      api_endpoint: config.value.api_endpoint,
      api_key: config.value.api_key
    })
    availableModels.value = response.data.models || []
    if (availableModels.value.length > 0) {
      toast.success(`Found ${availableModels.value.length} models`)
    } else {
      toast.warning('No models found')
    }
  } catch (error) {
    toast.error('Failed to fetch models')
  } finally {
    loadingModels.value = false
  }
}

const testConnection = async () => {
  testing.value = true
  testResult.value = null
  try {
    const response = await api.testAIConnection({
      primary_provider: config.value.primary_provider,
      api_endpoint: config.value.api_endpoint,
      api_key: config.value.api_key
    })
    testResult.value = response.data
    if (response.data.success) {
      toast.success('Connection successful!')
      // Auto-fetch models on success
      fetchModels()
    }
  } catch (error) {
    testResult.value = { success: false, error: error.message }
  } finally {
    testing.value = false
  }
}

const testOllamaConnection = async () => {
  testingOllama.value = true
  ollamaTestResult.value = null
  try {
    // Pass the current form values, not saved DB values
    const response = await api.testOllama(config.value.ollama_host, config.value.ollama_port)
    ollamaTestResult.value = response.data
    if (response.data.success) {
      toast.success('Ollama connected!')
      // Auto-fetch models on success
      fetchOllamaModels()
    }
  } catch (error) {
    ollamaTestResult.value = { success: false, error: error.message }
  } finally {
    testingOllama.value = false
  }
}

const fetchOllamaModels = async () => {
  loadingOllamaModels.value = true
  try {
    const response = await api.getOllamaModels()
    ollamaModels.value = response.data || []
    // Add current model if not in list
    if (config.value.ollama_model && !ollamaModels.value.find(m => m.name === config.value.ollama_model)) {
      ollamaModels.value.unshift({ name: config.value.ollama_model })
    }
  } catch (error) {
    console.error('Failed to fetch Ollama models:', error)
    // Keep current model
    if (config.value.ollama_model) {
      ollamaModels.value = [{ name: config.value.ollama_model }]
    }
  } finally {
    loadingOllamaModels.value = false
  }
}

const saveConfig = async () => {
  saving.value = true
  try {
    await api.updateAIConfig(config.value)
    toast.success('AI configuration saved!')
  } catch (error) {
    toast.error('Failed to save configuration')
  } finally {
    saving.value = false
  }
}

const formatTokens = (tokens) => {
  if (!tokens) return '0'
  if (tokens >= 1000000) return (tokens / 1000000).toFixed(1) + 'M'
  if (tokens >= 1000) return (tokens / 1000).toFixed(1) + 'K'
  return tokens.toString()
}
</script>
