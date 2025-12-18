<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">Ollama AI Configuration</h2>
      <p class="text-gray-400 text-sm">Configure AI classification engine</p>
    </div>

    <div class="space-y-4">
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

      <div v-if="status" :class="['p-3 rounded-lg', status.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400']">
        {{ status.message }}
      </div>

      <div class="flex gap-3">
        <button
          @click="testConnection"
          :disabled="loading"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {{ loading ? 'Testing...' : 'Test Connection' }}
        </button>
        <button
          @click="saveConfig"
          :disabled="saving"
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
const status = ref(null)

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
    }
    await refreshModels()
  } catch (error) {
    console.error('Failed to load Ollama config:', error)
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
  status.value = null
  try {
    const response = await axios.post('/api/settings/ollama/test', {
      host: config.value.host,
      port: config.value.port,
    })
    
    if (response.data.success) {
      status.value = { type: 'success', message: `Connection successful! Found ${response.data.models?.length || 0} models.` }
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
    await axios.put('/api/settings/ollama', config.value)
    status.value = { type: 'success', message: 'Configuration saved successfully!' }
  } catch (error) {
    status.value = { type: 'error', message: `Failed to save: ${error.message}` }
  } finally {
    saving.value = false
  }
}
</script>
