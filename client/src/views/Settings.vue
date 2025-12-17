<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">Settings</h1>

    <Card title="Media Server" description="Configure your Plex, Emby, or Jellyfin server">
      <div class="space-y-4">
        <Select
          v-model="mediaServer.type"
          label="Server Type"
          :options="[
            { label: 'Plex', value: 'plex' },
            { label: 'Emby', value: 'emby' },
            { label: 'Jellyfin', value: 'jellyfin' },
          ]"
          placeholder="Select server type"
        />
        <Input v-model="mediaServer.name" label="Name" placeholder="My Media Server" />
        <Input v-model="mediaServer.url" label="URL" placeholder="http://localhost:32400" />
        <Input v-model="mediaServer.api_key" label="API Key" type="password" />
        
        <!-- Connection Status -->
        <ConnectionStatus
          :status="mediaServerStatus.status"
          :service-name="mediaServer.type ? mediaServer.type.charAt(0).toUpperCase() + mediaServer.type.slice(1) : 'Media Server'"
          :details="mediaServerStatus.details"
          :error="mediaServerStatus.error"
          :last-checked="mediaServerStatus.lastChecked"
        />
        
        <div class="flex gap-2">
          <Button 
            @click="testMediaServer" 
            :loading="mediaServerStatus.status === 'testing'"
            :variant="mediaServerStatus.status === 'success' ? 'success' : 'secondary'"
          >
            {{ mediaServerStatus.status === 'success' ? '✓ Connected' : 'Test Connection' }}
          </Button>
          <Button @click="saveMediaServer" :loading="saving" variant="primary">Save</Button>
        </div>
      </div>
    </Card>

    <Card title="TMDB API" description="Configure TMDB for metadata enrichment">
      <div class="space-y-4">
        <Input v-model="tmdb.api_key" label="API Key" type="password" placeholder="Your TMDB API key" />
        <Input v-model="tmdb.language" label="Language" placeholder="en-US" />
        <Button @click="saveTMDB" :loading="savingTmdb" variant="primary">Save</Button>
      </div>
    </Card>

    <Card title="Ollama AI" description="Configure AI classification engine">
      <div class="space-y-4">
        <Input v-model="ollama.host" label="Host" placeholder="host.docker.internal" />
        <Input v-model.number="ollama.port" label="Port" type="number" placeholder="11434" />
        <Input v-model="ollama.model" label="Model" placeholder="qwen3:14b" />
        <Input v-model.number="ollama.temperature" label="Temperature" type="number" step="0.01" />
        
        <!-- Connection Status -->
        <ConnectionStatus
          :status="ollamaStatus.status"
          service-name="Ollama"
          :details="ollamaStatus.details"
          :error="ollamaStatus.error"
          :last-checked="ollamaStatus.lastChecked"
        />
        
        <div class="flex gap-2">
          <Button 
            @click="testOllama" 
            :loading="ollamaStatus.status === 'testing'"
            :variant="ollamaStatus.status === 'success' ? 'success' : 'secondary'"
          >
            {{ ollamaStatus.status === 'success' ? '✓ Connected' : 'Test Connection' }}
          </Button>
          <Button @click="saveOllama" :loading="savingOllama" variant="primary">Save</Button>
        </div>
      </div>
    </Card>

    <Card title="Discord Notifications" description="Configure Discord bot for notifications">
      <div class="space-y-4">
        <Input v-model="discord.bot_token" label="Bot Token" type="password" />
        <Input v-model="discord.channel_id" label="Channel ID" />
        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            v-model="discord.enabled"
            id="discord-enabled"
            class="w-4 h-4"
          />
          <label for="discord-enabled">Enable Discord Notifications</label>
        </div>
        <Button @click="saveDiscord" :loading="savingDiscord" variant="primary">Save</Button>
      </div>
    </Card>

    <Card title="Tavily Web Search" description="Configure Tavily for enhanced AI classification with web search">
      <div class="space-y-4">
        <Input v-model="tavily.api_key" label="API Key" type="password" placeholder="Your Tavily API key" />
        <Select
          v-model="tavily.search_depth"
          label="Search Depth"
          :options="[
            { label: 'Basic', value: 'basic' },
            { label: 'Advanced', value: 'advanced' },
          ]"
          placeholder="Select search depth"
        />
        <Input v-model.number="tavily.max_results" label="Max Results" type="number" min="1" max="10" placeholder="5" />
        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            v-model="tavily.is_active"
            id="tavily-enabled"
            class="w-4 h-4"
          />
          <label for="tavily-enabled">Enable Tavily Web Search</label>
        </div>
        
        <!-- Connection Status -->
        <ConnectionStatus
          :status="tavilyStatus.status"
          service-name="Tavily"
          :details="tavilyStatus.details"
          :error="tavilyStatus.error"
          :last-checked="tavilyStatus.lastChecked"
        />
        
        <div class="flex gap-2">
          <Button 
            @click="testTavily" 
            :loading="tavilyStatus.status === 'testing'"
            :variant="tavilyStatus.status === 'success' ? 'success' : 'secondary'"
          >
            {{ tavilyStatus.status === 'success' ? '✓ Connected' : 'Test Connection' }}
          </Button>
          <Button @click="saveTavily" :loading="savingTavily" variant="primary">Save</Button>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Input from '@/components/common/Input.vue'
import Select from '@/components/common/Select.vue'
import ConnectionStatus from '@/components/common/ConnectionStatus.vue'

const mediaServer = ref({ type: '', name: '', url: '', api_key: '' })
const tmdb = ref({ api_key: '', language: 'en-US' })
const ollama = ref({ host: 'host.docker.internal', port: 11434, model: 'qwen3:14b', temperature: 0.30 })
const discord = ref({ bot_token: '', channel_id: '', enabled: false })
const tavily = ref({ api_key: '', search_depth: 'basic', max_results: 5, is_active: false })

const saving = ref(false)
const savingTmdb = ref(false)
const savingOllama = ref(false)
const savingDiscord = ref(false)
const savingTavily = ref(false)

// Connection status for each service
const mediaServerStatus = reactive({
  status: 'idle',
  details: null,
  error: null,
  lastChecked: null
})

const ollamaStatus = reactive({
  status: 'idle',
  details: null,
  error: null,
  lastChecked: null
})

const tavilyStatus = reactive({
  status: 'idle',
  details: null,
  error: null,
  lastChecked: null
})

onMounted(async () => {
  try {
    const [msRes, tmdbRes, ollamaRes, discordRes, tavilyRes] = await Promise.all([
      api.getMediaServer(),
      api.getTMDBConfig(),
      api.getOllamaConfig(),
      api.getNotificationConfig(),
      api.getTavilyConfig(),
    ])

    if (msRes.data) mediaServer.value = msRes.data
    if (tmdbRes.data) tmdb.value = tmdbRes.data
    if (ollamaRes.data) ollama.value = ollamaRes.data
    if (discordRes.data) discord.value = discordRes.data
    if (tavilyRes.data) tavily.value = tavilyRes.data
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
})

const testMediaServer = async () => {
  mediaServerStatus.status = 'testing'
  mediaServerStatus.error = null
  
  try {
    const response = await api.testMediaServer(mediaServer.value)
    mediaServerStatus.lastChecked = new Date()
    
    if (response.data.success) {
      mediaServerStatus.status = 'success'
      mediaServerStatus.details = response.data.details
    } else {
      mediaServerStatus.status = 'error'
      mediaServerStatus.error = response.data.error
    }
  } catch (error) {
    mediaServerStatus.status = 'error'
    mediaServerStatus.lastChecked = new Date()
    mediaServerStatus.error = {
      message: error.response?.data?.error?.message || error.message,
      code: error.response?.data?.error?.code || 'NETWORK_ERROR',
      troubleshooting: error.response?.data?.error?.troubleshooting || [
        'Check your network connection',
        'The server may be temporarily unavailable'
      ]
    }
  }
}

const saveMediaServer = async () => {
  saving.value = true
  try {
    await api.saveMediaServer(mediaServer.value)
    alert('Media server saved successfully!')
  } catch (error) {
    alert('Failed to save: ' + error.message)
  } finally {
    saving.value = false
  }
}

const saveTMDB = async () => {
  savingTmdb.value = true
  try {
    await api.updateTMDBConfig(tmdb.value)
    alert('TMDB configuration saved!')
  } catch (error) {
    alert('Failed to save: ' + error.message)
  } finally {
    savingTmdb.value = false
  }
}

const testOllama = async () => {
  ollamaStatus.status = 'testing'
  ollamaStatus.error = null
  
  try {
    const response = await api.testOllama()
    ollamaStatus.lastChecked = new Date()
    
    if (response.data.success) {
      ollamaStatus.status = 'success'
      ollamaStatus.details = response.data.details
    } else {
      ollamaStatus.status = 'error'
      ollamaStatus.error = response.data.error
    }
  } catch (error) {
    ollamaStatus.status = 'error'
    ollamaStatus.lastChecked = new Date()
    ollamaStatus.error = {
      message: error.response?.data?.error?.message || error.message,
      code: error.response?.data?.error?.code || 'NETWORK_ERROR',
      troubleshooting: error.response?.data?.error?.troubleshooting || [
        'Check your network connection',
        'The server may be temporarily unavailable'
      ]
    }
  }
}

const saveOllama = async () => {
  savingOllama.value = true
  try {
    await api.updateOllamaConfig(ollama.value)
    alert('Ollama configuration saved!')
  } catch (error) {
    alert('Failed to save: ' + error.message)
  } finally {
    savingOllama.value = false
  }
}

const saveDiscord = async () => {
  savingDiscord.value = true
  try {
    await api.updateNotificationConfig(discord.value)
    alert('Discord configuration saved!')
  } catch (error) {
    alert('Failed to save: ' + error.message)
  } finally {
    savingDiscord.value = false
  }
}

const testTavily = async () => {
  tavilyStatus.status = 'testing'
  tavilyStatus.error = null
  
  try {
    const response = await api.testTavily({ api_key: tavily.value.api_key })
    tavilyStatus.lastChecked = new Date()
    
    if (response.data.success) {
      tavilyStatus.status = 'success'
      tavilyStatus.details = response.data.details
    } else {
      tavilyStatus.status = 'error'
      tavilyStatus.error = response.data.error
    }
  } catch (error) {
    tavilyStatus.status = 'error'
    tavilyStatus.lastChecked = new Date()
    tavilyStatus.error = {
      message: error.response?.data?.error?.message || error.message,
      code: error.response?.data?.error?.code || 'NETWORK_ERROR',
      troubleshooting: error.response?.data?.error?.troubleshooting || [
        'Check your network connection',
        'The server may be temporarily unavailable'
      ]
    }
  }
}

const saveTavily = async () => {
  savingTavily.value = true
  try {
    await api.updateTavilyConfig(tavily.value)
    alert('Tavily configuration saved!')
  } catch (error) {
    alert('Failed to save: ' + error.message)
  } finally {
    savingTavily.value = false
  }
}
</script>
