<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">Discord Bot Configuration</h2>
      <p class="text-gray-400 text-sm">Configure Discord notifications for classifications</p>
    </div>

    <!-- Setup Guide (Collapsible) -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      <button 
        @click="showSetupGuide = !showSetupGuide"
        class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-750 transition-colors"
      >
        <span class="font-medium flex items-center gap-2">
          <span>📚</span>
          <span>How to Set Up Discord Bot</span>
          <span v-if="!config.bot_token" class="text-xs bg-yellow-900/30 text-yellow-400 px-2 py-0.5 rounded">New? Start here</span>
        </span>
        <span :class="['transition-transform', showSetupGuide ? 'rotate-180' : '']">▼</span>
      </button>
      
      <div v-if="showSetupGuide" class="px-4 pb-4 border-t border-gray-700 mt-0 pt-4">
        <div class="space-y-4 text-sm">
          <div class="flex gap-3">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">1</span>
            <div>
              <p class="font-medium">Create a Discord Application</p>
              <p class="text-gray-400">Go to <a href="https://discord.com/developers/applications" target="_blank" class="text-blue-400 hover:underline">Discord Developer Portal</a> and click "New Application"</p>
            </div>
          </div>
          
          <div class="flex gap-3">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">2</span>
            <div>
              <p class="font-medium">Create the Bot</p>
              <p class="text-gray-400">Go to "Bot" tab → Click "Add Bot" → Enable "Message Content Intent"</p>
            </div>
          </div>
          
          <div class="flex gap-3">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">3</span>
            <div>
              <p class="font-medium">Get Your Bot Token</p>
              <p class="text-gray-400">In Bot tab → Click "Reset Token" → Copy and paste below</p>
              <p class="text-red-400 text-xs mt-1">⚠️ Never share your token publicly</p>
            </div>
          </div>
          
          <div class="flex gap-3">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">4</span>
            <div>
              <p class="font-medium">Invite Bot to Server</p>
              <p class="text-gray-400">Go to OAuth2 → URL Generator → Select "bot" scope → Select permissions: Send Messages, Embed Links, Attach Files, Read Message History</p>
            </div>
          </div>
          
          <div class="flex gap-3">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">5</span>
            <div>
              <p class="font-medium">Configure Below</p>
              <p class="text-gray-400">Enter your bot token, click "Test Connection" to load servers, then select your server and channel</p>
            </div>
          </div>
          
          <div class="mt-4 p-3 bg-gray-900 rounded-lg">
            <p class="text-gray-400 text-xs">Need more help? See the <a href="https://github.com/cloudbyday90/Classifarr/blob/main/DISCORD_SETUP.md" target="_blank" class="text-blue-400 hover:underline">full setup guide</a></p>
          </div>
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-2">Bot Token</label>
        <div class="relative">
          <input
            v-model="config.bot_token"
            :type="showToken ? 'text' : 'password'"
            placeholder="Your Discord bot token"
            class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            @click="showToken = !showToken"
            type="button"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
          >
            {{ showToken ? '👁️' : '👁️‍🗨️' }}
          </button>
        </div>
        <p class="text-xs text-gray-500 mt-1">
          Paste your bot token from the Discord Developer Portal
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium mb-2">Server</label>
        <div class="flex gap-2">
          <select
            v-model="selectedServer"
            @change="onServerChange"
            :disabled="!config.bot_token || servers.length === 0"
            class="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a server</option>
            <option v-for="server in servers" :key="server.id" :value="server.id">
              {{ server.name }} ({{ server.memberCount }} members)
            </option>
          </select>
          <button
            @click="loadServers"
            :disabled="!config.bot_token || loadingServers"
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 rounded-lg transition-colors"
          >
            {{ loadingServers ? '...' : '🔄' }}
          </button>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium mb-2">Channel</label>
        <select
          v-model="config.channel_id"
          :disabled="!selectedServer || channels.length === 0"
          class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select a channel</option>
          <option v-for="channel in channels" :key="channel.id" :value="channel.id">
            # {{ channel.name }}
          </option>
        </select>
      </div>

      <div class="border-t border-gray-700 pt-4">
        <h3 class="text-lg font-medium mb-3">Notification Settings</h3>
        <div class="space-y-2">
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="config.enabled" class="w-4 h-4 rounded" />
            <span class="text-sm">Enable Discord Notifications</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="config.notify_on_classification" class="w-4 h-4 rounded" />
            <span class="text-sm">Notify on Classification</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="config.notify_on_error" class="w-4 h-4 rounded" />
            <span class="text-sm">Notify on Error</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="config.notify_on_correction" class="w-4 h-4 rounded" />
            <span class="text-sm">Notify on Correction</span>
          </label>
        </div>
      </div>

      <div class="border-t border-gray-700 pt-4">
        <h3 class="text-lg font-medium mb-3">Display Options</h3>
        <div class="space-y-2">
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="config.show_poster" class="w-4 h-4 rounded" />
            <span class="text-sm">Show Poster Image</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="config.show_confidence" class="w-4 h-4 rounded" />
            <span class="text-sm">Show Confidence Score</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="config.show_method" class="w-4 h-4 rounded" />
            <span class="text-sm">Show Classification Method</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="config.show_reason" class="w-4 h-4 rounded" />
            <span class="text-sm">Show Reason</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="config.show_metadata" class="w-4 h-4 rounded" />
            <span class="text-sm">Show Metadata</span>
          </label>
        </div>
      </div>

      <div class="border-t border-gray-700 pt-4">
        <h3 class="text-lg font-medium mb-3">Correction Controls</h3>
        <div class="space-y-4">
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="config.enable_corrections" class="w-4 h-4 rounded" />
            <span class="text-sm">Enable Correction Buttons</span>
          </label>
          <div v-if="config.enable_corrections">
            <label class="block text-sm font-medium mb-2">
              Number of Quick Correction Buttons: {{ config.correction_buttons_count }}
            </label>
            <input
              v-model.number="config.correction_buttons_count"
              type="range"
              min="1"
              max="4"
              class="w-full"
            />
          </div>
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="config.include_library_dropdown" class="w-4 h-4 rounded" />
            <span class="text-sm">Include Library Dropdown</span>
          </label>
        </div>
      </div>

      <div v-if="status" :class="['p-3 rounded-lg', status.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400']">
        {{ status.message }}
      </div>

      <div class="flex gap-3">
        <button
          @click="testConnection"
          :disabled="loading || !config.bot_token"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {{ loading ? 'Testing...' : 'Test Connection' }}
        </button>
        <button
          @click="saveConfig"
          :disabled="saving || !config.bot_token || !config.channel_id"
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
  bot_token: '',
  channel_id: '',
  enabled: false,
  notify_on_classification: true,
  notify_on_error: true,
  notify_on_correction: true,
  show_poster: true,
  show_confidence: true,
  show_method: true,
  show_reason: true,
  show_metadata: false,
  enable_corrections: true,
  correction_buttons_count: 3,
  include_library_dropdown: true,
})

const showToken = ref(false)
const showSetupGuide = ref(false)
const servers = ref([])
const channels = ref([])
const selectedServer = ref('')
const loading = ref(false)
const saving = ref(false)
const loadingServers = ref(false)
const status = ref(null)

onMounted(async () => {
  try {
    const response = await axios.get('/api/settings/notifications')
    if (response.data) {
      config.value = {
        bot_token: response.data.bot_token || '',
        channel_id: response.data.channel_id || '',
        enabled: response.data.enabled !== false,
        notify_on_classification: response.data.notify_on_classification !== false,
        notify_on_error: response.data.notify_on_error !== false,
        notify_on_correction: response.data.notify_on_correction !== false,
        show_poster: response.data.show_poster !== false,
        show_confidence: response.data.show_confidence !== false,
        show_method: response.data.show_method !== false,
        show_reason: response.data.show_reason !== false,
        show_metadata: response.data.show_metadata === true,
        enable_corrections: response.data.enable_corrections !== false,
        correction_buttons_count: response.data.correction_buttons_count || 3,
        include_library_dropdown: response.data.include_library_dropdown !== false,
      }
    }
  } catch (error) {
    console.error('Failed to load Discord config:', error)
  }
})

const loadServers = async () => {
  loadingServers.value = true
  try {
    const response = await axios.get('/api/settings/discord/servers', {
      params: { bot_token: config.value.bot_token },
    })
    servers.value = response.data || []
  } catch (error) {
    console.error('Failed to load servers:', error)
    status.value = { type: 'error', message: 'Failed to load servers' }
  } finally {
    loadingServers.value = false
  }
}

const onServerChange = async () => {
  if (!selectedServer.value) {
    channels.value = []
    return
  }

  try {
    const response = await axios.get(`/api/settings/discord/channels/${selectedServer.value}`, {
      params: { bot_token: config.value.bot_token },
    })
    channels.value = response.data || []
  } catch (error) {
    console.error('Failed to load channels:', error)
    status.value = { type: 'error', message: 'Failed to load channels' }
  }
}

const testConnection = async () => {
  loading.value = true
  status.value = null
  try {
    const response = await axios.post('/api/settings/discord/test', {
      bot_token: config.value.bot_token,
    })
    
    if (response.data.success) {
      status.value = { 
        type: 'success', 
        message: `Bot connected! Username: ${response.data.botUser?.username}, Servers: ${response.data.guildsCount}` 
      }
      await loadServers()
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
    await axios.put('/api/settings/notifications', config.value)
    status.value = { type: 'success', message: 'Configuration saved successfully!' }
  } catch (error) {
    status.value = { type: 'error', message: `Failed to save: ${error.message}` }
  } finally {
    saving.value = false
  }
}
</script>
