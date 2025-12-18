<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">Webhook Configuration</h2>
      <p class="text-gray-400 text-sm">Configure webhooks for external integrations</p>
    </div>

    <div class="space-y-4">
      <div v-if="webhook">
        <label class="block text-sm font-medium mb-2">Webhook URL</label>
        <div class="flex gap-2">
          <input
            :value="webhookUrl"
            readonly
            class="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400"
          />
          <button
            @click="copyUrl"
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            📋 Copy
          </button>
        </div>
      </div>

      <div v-if="webhook">
        <label class="block text-sm font-medium mb-2">API Key</label>
        <div class="flex gap-2">
          <input
            :value="webhook.api_key"
            readonly
            class="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400"
          />
          <button
            @click="copyApiKey"
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            📋 Copy
          </button>
        </div>
        <p class="text-xs text-gray-500 mt-1">
          Include this API key in the Authorization header: <code class="bg-gray-800 px-1 py-0.5 rounded">Bearer YOUR_API_KEY</code>
        </p>
      </div>

      <div>
        <button
          @click="generateKey"
          :disabled="generating"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {{ generating ? 'Generating...' : webhook ? 'Regenerate API Key' : 'Generate API Key' }}
        </button>
        <p class="text-xs text-gray-500 mt-1">
          {{ webhook ? 'Warning: Regenerating will invalidate the old key' : 'Generate a new webhook API key' }}
        </p>
      </div>

      <div v-if="status" :class="['p-3 rounded-lg', status.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400']">
        {{ status.message }}
      </div>

      <div class="border-t border-gray-700 pt-4">
        <h3 class="text-lg font-medium mb-3">Recent Activity</h3>
        <div v-if="loadingLogs" class="text-center py-4 text-gray-500">
          Loading logs...
        </div>
        <div v-else-if="logs.length === 0" class="text-center py-4 text-gray-500">
          No webhook activity yet
        </div>
        <div v-else class="space-y-2 max-h-96 overflow-y-auto">
          <div
            v-for="log in logs"
            :key="log.id"
            class="p-3 bg-gray-800 rounded-lg border border-gray-700"
          >
            <div class="flex justify-between items-start mb-1">
              <span class="font-mono text-sm">{{ log.method }} {{ log.endpoint }}</span>
              <span
                :class="[
                  'px-2 py-0.5 rounded text-xs font-medium',
                  log.status_code >= 200 && log.status_code < 300 ? 'bg-green-900/30 text-green-400' :
                  log.status_code >= 400 && log.status_code < 500 ? 'bg-yellow-900/30 text-yellow-400' :
                  'bg-red-900/30 text-red-400'
                ]"
              >
                {{ log.status_code }}
              </span>
            </div>
            <div class="text-xs text-gray-500">
              {{ new Date(log.created_at).toLocaleString() }}
            </div>
            <div v-if="log.ip_address" class="text-xs text-gray-500 mt-1">
              IP: {{ log.ip_address }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'

const webhook = ref(null)
const logs = ref([])
const generating = ref(false)
const loadingLogs = ref(false)
const status = ref(null)

const webhookUrl = computed(() => {
  if (!webhook.value) return ''
  return `${window.location.origin}/api/webhook/classify`
})

onMounted(async () => {
  await loadWebhook()
  await loadLogs()
})

const loadWebhook = async () => {
  try {
    const response = await axios.get('/api/settings/webhook')
    webhook.value = response.data
  } catch (error) {
    console.error('Failed to load webhook:', error)
  }
}

const loadLogs = async () => {
  loadingLogs.value = true
  try {
    const response = await axios.get('/api/settings/webhook/logs')
    logs.value = response.data || []
  } catch (error) {
    console.error('Failed to load logs:', error)
  } finally {
    loadingLogs.value = false
  }
}

const generateKey = async () => {
  if (webhook.value) {
    const confirmed = confirm('Are you sure? This will invalidate the old API key.')
    if (!confirmed) return
  }

  generating.value = true
  status.value = null
  try {
    const response = await axios.post('/api/settings/webhook/generate-key', {
      name: 'Webhook API Key',
    })
    webhook.value = response.data
    status.value = { type: 'success', message: 'API key generated successfully! Make sure to copy it now.' }
  } catch (error) {
    status.value = { type: 'error', message: `Failed to generate key: ${error.message}` }
  } finally {
    generating.value = false
  }
}

const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(webhookUrl.value)
    status.value = { type: 'success', message: 'Webhook URL copied to clipboard!' }
  } catch (error) {
    status.value = { type: 'error', message: 'Failed to copy URL' }
  }
}

const copyApiKey = async () => {
  try {
    if (!webhook.value || !webhook.value.api_key) {
      status.value = { type: 'error', message: 'No API key available to copy' }
      return
    }
    await navigator.clipboard.writeText(webhook.value.api_key)
    status.value = { type: 'success', message: 'API key copied to clipboard!' }
  } catch (error) {
    status.value = { type: 'error', message: 'Failed to copy API key' }
  }
}
</script>
