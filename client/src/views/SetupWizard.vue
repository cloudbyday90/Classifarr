<template>
  <div class="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
    <div class="max-w-2xl w-full">
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold mb-2">Welcome to Classifarr</h1>
        <p class="text-gray-400">Let's get you set up</p>
      </div>

      <div class="bg-gray-800 rounded-lg shadow-xl p-8">
        <!-- Progress Steps -->
        <div class="flex justify-between mb-8">
          <div
            v-for="(stepInfo, index) in steps"
            :key="index"
            :class="[
              'flex-1 text-center',
              index < steps.length - 1 ? 'border-r border-gray-700' : ''
            ]"
          >
            <div
              :class="[
                'w-8 h-8 rounded-full mx-auto mb-2',
                step === index ? 'bg-blue-600' :
                step > index ? 'bg-green-600' :
                'bg-gray-700'
              ]"
            >
              <span class="leading-8">{{ step > index ? '✓' : index + 1 }}</span>
            </div>
            <div class="text-xs text-gray-400">{{ stepInfo.name }}</div>
          </div>
        </div>

        <!-- Step 1: TMDB (Required) -->
        <div v-if="step === 0" class="space-y-4">
          <h2 class="text-2xl font-semibold mb-4">TMDB Configuration</h2>
          <p class="text-gray-400 mb-4">Required for metadata enrichment</p>

          <div>
            <label class="block text-sm font-medium mb-2">API Key *</label>
            <input
              v-model="tmdb.api_key"
              type="text"
              placeholder="Your TMDB API key"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p class="text-xs text-gray-500 mt-1">
              Get your API key from <a href="https://www.themoviedb.org/settings/api" target="_blank" class="text-blue-400 hover:underline">TMDB Settings</a>
            </p>
          </div>

          <div v-if="stepStatus" :class="['p-3 rounded-lg', stepStatus.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400']">
            {{ stepStatus.message }}
          </div>

          <div class="flex gap-3">
            <button
              @click="testTmdb"
              :disabled="!tmdb.api_key || testing"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {{ testing ? 'Testing...' : 'Test Connection' }}
            </button>
            <button
              @click="nextStep"
              :disabled="!tmdb.api_key"
              class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Next
            </button>
          </div>
        </div>

        <!-- Step 2: Ollama (Optional) -->
        <div v-else-if="step === 1" class="space-y-4">
          <h2 class="text-2xl font-semibold mb-4">Ollama AI (Optional)</h2>
          <p class="text-gray-400 mb-4">Configure AI classification engine</p>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">Host</label>
              <input
                v-model="ollama.host"
                type="text"
                placeholder="host.docker.internal"
                class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Port</label>
              <input
                v-model.number="ollama.port"
                type="number"
                placeholder="11434"
                class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div v-if="stepStatus" :class="['p-3 rounded-lg', stepStatus.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400']">
            {{ stepStatus.message }}
          </div>

          <div class="flex gap-3">
            <button
              @click="prevStep"
              class="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              @click="testOllama"
              :disabled="testing"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {{ testing ? 'Testing...' : 'Test Connection' }}
            </button>
            <button
              @click="skipOllama"
              class="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
            >
              Skip
            </button>
            <button
              @click="nextStep"
              class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              Next
            </button>
          </div>
        </div>

        <!-- Step 3: Discord (Optional) -->
        <div v-else-if="step === 2" class="space-y-4">
          <h2 class="text-2xl font-semibold mb-4">Discord Notifications (Optional)</h2>
          <p class="text-gray-400 mb-4">Configure Discord bot for notifications</p>

          <div>
            <label class="block text-sm font-medium mb-2">Bot Token</label>
            <input
              v-model="discord.bot_token"
              type="text"
              placeholder="Your Discord bot token"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Channel ID</label>
            <input
              v-model="discord.channel_id"
              type="text"
              placeholder="Discord channel ID"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div v-if="stepStatus" :class="['p-3 rounded-lg', stepStatus.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400']">
            {{ stepStatus.message }}
          </div>

          <div class="flex gap-3">
            <button
              @click="prevStep"
              class="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              @click="testDiscord"
              :disabled="!discord.bot_token || testing"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {{ testing ? 'Testing...' : 'Test Connection' }}
            </button>
            <button
              @click="skipDiscord"
              class="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
            >
              Skip
            </button>
            <button
              @click="finishSetup"
              :disabled="finishing"
              class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {{ finishing ? 'Finishing...' : 'Finish Setup' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()

const step = ref(0)
const testing = ref(false)
const finishing = ref(false)
const stepStatus = ref(null)

const steps = [
  { name: 'TMDB', required: true },
  { name: 'Ollama', required: false },
  { name: 'Discord', required: false },
]

const tmdb = ref({
  api_key: '',
  language: 'en-US',
})

const ollama = ref({
  host: 'host.docker.internal',
  port: 11434,
  model: 'qwen3:14b',
  temperature: 0.30,
})

const discord = ref({
  bot_token: '',
  channel_id: '',
  enabled: false,
})

const nextStep = () => {
  stepStatus.value = null
  step.value++
}

const prevStep = () => {
  stepStatus.value = null
  step.value--
}

const testTmdb = async () => {
  testing.value = true
  stepStatus.value = null
  try {
    const response = await axios.post('/api/settings/tmdb/test', {
      api_key: tmdb.value.api_key,
    })
    
    if (response.data.success) {
      stepStatus.value = { type: 'success', message: 'Connection successful!' }
    } else {
      stepStatus.value = { type: 'error', message: `Connection failed: ${response.data.error}` }
    }
  } catch (error) {
    stepStatus.value = { type: 'error', message: `Connection failed: ${error.message}` }
  } finally {
    testing.value = false
  }
}

const testOllama = async () => {
  testing.value = true
  stepStatus.value = null
  try {
    const response = await axios.post('/api/settings/ollama/test', {
      host: ollama.value.host,
      port: ollama.value.port,
    })
    
    if (response.data.success) {
      stepStatus.value = { type: 'success', message: 'Connection successful!' }
    } else {
      stepStatus.value = { type: 'error', message: `Connection failed: ${response.data.error}` }
    }
  } catch (error) {
    stepStatus.value = { type: 'error', message: `Connection failed: ${error.message}` }
  } finally {
    testing.value = false
  }
}

const skipOllama = () => {
  ollama.value = {
    host: 'host.docker.internal',
    port: 11434,
    model: 'qwen3:14b',
    temperature: 0.30,
  }
  nextStep()
}

const testDiscord = async () => {
  testing.value = true
  stepStatus.value = null
  try {
    const response = await axios.post('/api/settings/discord/test', {
      bot_token: discord.value.bot_token,
    })
    
    if (response.data.success) {
      stepStatus.value = { type: 'success', message: 'Bot connected successfully!' }
    } else {
      stepStatus.value = { type: 'error', message: `Connection failed: ${response.data.error}` }
    }
  } catch (error) {
    stepStatus.value = { type: 'error', message: `Connection failed: ${error.message}` }
  } finally {
    testing.value = false
  }
}

const skipDiscord = () => {
  discord.value = {
    bot_token: '',
    channel_id: '',
    enabled: false,
  }
  finishSetup()
}

const finishSetup = async () => {
  finishing.value = true
  stepStatus.value = null
  
  try {
    // Save TMDB (required)
    await axios.put('/api/settings/tmdb', tmdb.value)
    
    // Save Ollama if configured
    if (ollama.value.host && ollama.value.port) {
      await axios.put('/api/settings/ollama', ollama.value)
    }
    
    // Save Discord if configured
    if (discord.value.bot_token && discord.value.channel_id) {
      discord.value.enabled = true
      await axios.put('/api/settings/notifications', discord.value)
    }
    
    // Redirect to dashboard
    router.push('/')
  } catch (error) {
    stepStatus.value = { type: 'error', message: `Failed to save settings: ${error.message}` }
  } finally {
    finishing.value = false
  }
}
</script>
