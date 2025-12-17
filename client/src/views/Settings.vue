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
        <div class="flex gap-2">
          <Button @click="testMediaServer" :loading="testing">Test Connection</Button>
          <Button @click="saveMediaServer" :loading="saving" variant="success">Save</Button>
        </div>
      </div>
    </Card>

    <Card title="TMDB API" description="Configure TMDB for metadata enrichment">
      <div class="space-y-4">
        <Input v-model="tmdb.api_key" label="API Key" type="password" placeholder="Your TMDB API key" />
        <Input v-model="tmdb.language" label="Language" placeholder="en-US" />
        <Button @click="saveTMDB" :loading="savingTmdb" variant="success">Save</Button>
      </div>
    </Card>

    <Card title="Ollama AI" description="Configure AI classification engine">
      <div class="space-y-4">
        <Input v-model="ollama.host" label="Host" placeholder="host.docker.internal" />
        <Input v-model.number="ollama.port" label="Port" type="number" placeholder="11434" />
        <Input v-model="ollama.model" label="Model" placeholder="qwen3:14b" />
        <Input v-model.number="ollama.temperature" label="Temperature" type="number" step="0.01" />
        <div class="flex gap-2">
          <Button @click="testOllama" :loading="testingOllama">Test Connection</Button>
          <Button @click="saveOllama" :loading="savingOllama" variant="success">Save</Button>
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
        <Button @click="saveDiscord" :loading="savingDiscord" variant="success">Save</Button>
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
        <div class="flex gap-2">
          <Button @click="testTavily" :loading="testingTavily">Test Connection</Button>
          <Button @click="saveTavily" :loading="savingTavily" variant="success">Save</Button>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Input from '@/components/common/Input.vue'
import Select from '@/components/common/Select.vue'

const mediaServer = ref({ type: '', name: '', url: '', api_key: '' })
const tmdb = ref({ api_key: '', language: 'en-US' })
const ollama = ref({ host: 'host.docker.internal', port: 11434, model: 'qwen3:14b', temperature: 0.30 })
const discord = ref({ bot_token: '', channel_id: '', enabled: false })
const tavily = ref({ api_key: '', search_depth: 'basic', max_results: 5, is_active: false })

const testing = ref(false)
const saving = ref(false)
const savingTmdb = ref(false)
const savingOllama = ref(false)
const testingOllama = ref(false)
const savingDiscord = ref(false)
const testingTavily = ref(false)
const savingTavily = ref(false)

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
  testing.value = true
  try {
    const response = await api.testMediaServer(mediaServer.value)
    if (response.data.success) {
      alert('Connection successful!')
    } else {
      alert('Connection failed: ' + response.data.error)
    }
  } catch (error) {
    alert('Connection failed: ' + error.message)
  } finally {
    testing.value = false
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
  testingOllama.value = true
  try {
    const response = await api.testOllama()
    if (response.data.success) {
      alert('Ollama connection successful!')
    } else {
      alert('Connection failed: ' + response.data.error)
    }
  } catch (error) {
    alert('Connection failed: ' + error.message)
  } finally {
    testingOllama.value = false
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
  testingTavily.value = true
  try {
    const response = await api.testTavily({ api_key: tavily.value.api_key })
    if (response.data.success) {
      alert('Tavily connection successful!')
    } else {
      alert('Connection failed: ' + response.data.error)
    }
  } catch (error) {
    alert('Connection failed: ' + error.message)
  } finally {
    testingTavily.value = false
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
