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

const testing = ref(false)
const saving = ref(false)
const savingTmdb = ref(false)
const savingOllama = ref(false)
const testingOllama = ref(false)
const savingDiscord = ref(false)

onMounted(async () => {
  try {
    const [msRes, tmdbRes, ollamaRes, discordRes] = await Promise.all([
      api.getMediaServer(),
      api.getTMDBConfig(),
      api.getOllamaConfig(),
      api.getNotificationConfig(),
    ])

    if (msRes.data) mediaServer.value = msRes.data
    if (tmdbRes.data) tmdb.value = tmdbRes.data
    if (ollamaRes.data) ollama.value = ollamaRes.data
    if (discordRes.data) discord.value = discordRes.data
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
</script>
