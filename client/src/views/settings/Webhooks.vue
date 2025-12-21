<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">Request Manager Webhook</h2>
      <p class="text-gray-400 text-sm">Configure webhook integration for automatic media classification</p>
    </div>

    <div v-if="loading" class="text-center py-8">
      <Spinner />
    </div>

    <div v-else class="space-y-6">
      <!-- Enable/Disable -->
      <Card>
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-medium">Enable Webhook</h3>
            <p class="text-sm text-gray-400">Enable or disable webhook processing</p>
          </div>
          <Toggle v-model="config.enabled" @update:modelValue="saveConfig" />
        </div>
      </Card>

      <!-- Multi-Source Manager -->
      <Card>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium">Configured Sources</h3>
          <button
            @click="showAddSource = true"
            class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
          >
            + Add Source
          </button>
        </div>

        <div v-if="sources.length === 0" class="text-gray-500 text-center py-4">
          No sources configured
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="source in sources"
            :key="source.id"
            :class="[
              'flex items-center justify-between p-3 rounded-lg border transition-colors',
              source.is_primary ? 'bg-blue-900/20 border-blue-700' : 'bg-gray-800 border-gray-700'
            ]"
          >
            <div class="flex items-center gap-3">
              <span class="text-lg">
                {{ source.webhook_type === 'seer' ? '⭐' : source.webhook_type === 'jellyseerr' ? '🍇' : '🎬' }}
              </span>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ source.name || 'Unnamed' }}</span>
                  <span v-if="source.is_primary" class="text-xs bg-blue-600 px-1.5 py-0.5 rounded">Primary</span>
                  <span 
                    :class="['text-xs px-1.5 py-0.5 rounded', source.enabled ? 'bg-green-900/30 text-green-400' : 'bg-gray-900 text-gray-500']"
                  >
                    {{ source.enabled ? 'Active' : 'Disabled' }}
                  </span>
                </div>
                <div class="text-xs text-gray-400">{{ source.webhook_type }}</div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="!source.is_primary"
                @click="setPrimary(source.id)"
                class="px-2 py-1 text-xs bg-gray-700 hover:bg-blue-600 rounded transition-colors"
                title="Set as primary"
              >
                ★
              </button>
              <button
                v-if="sources.length > 1"
                @click="deleteSource(source.id)"
                class="px-2 py-1 text-xs bg-gray-700 hover:bg-red-600 rounded transition-colors"
                title="Delete"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <p class="text-xs text-gray-500 mt-3">
          Multiple sources allow webhooks from different Overseerr/Jellyseerr/Seer instances.
          The primary source's settings are shown below.
        </p>
      </Card>

      <!-- Add Source Modal -->
      <div v-if="showAddSource" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
          <h3 class="text-lg font-medium mb-4">Add Webhook Source</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">Name</label>
              <input
                v-model="newSource.name"
                type="text"
                placeholder="e.g. Plex Overseerr"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Type</label>
              <select
                v-model="newSource.webhook_type"
                class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="overseerr">Overseerr</option>
                <option value="jellyseerr">Jellyseerr</option>
                <option value="seer">Seer</option>
              </select>
            </div>
          </div>
          <div class="flex gap-3 mt-6">
            <button
              @click="showAddSource = false"
              class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              @click="addSource"
              :disabled="!newSource.name"
              class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
            >
              Add Source
            </button>
          </div>
        </div>
      </div>

      <!-- Request Manager Type -->
      <Card>
        <h3 class="text-lg font-medium mb-4">Request Manager</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Type</label>
            <select
              v-model="config.webhook_type"
              @change="saveConfig"
              class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="overseerr">Overseerr</option>
              <option value="jellyseerr">Jellyseerr</option>
              <option value="seer">Seer</option>
            </select>
            <p class="text-xs text-gray-500 mt-2">
              <span v-if="config.webhook_type === 'seer'" class="text-green-400">
                ✓ Seer is the unified successor to Overseerr and Jellyseerr
              </span>
              <span v-else>
                All three use the same webhook format, so the integration works identically
              </span>
            </p>
          </div>
        </div>
      </Card>

      <!-- Webhook URL -->
      <Card>
        <h3 class="text-lg font-medium mb-4">Webhook URL</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Endpoint URL</label>
            <div class="flex gap-2">
              <input
                :value="webhookUrl"
                readonly
                class="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 font-mono text-sm"
              />
              <Button @click="copyUrl" variant="secondary">
                📋 Copy
              </Button>
            </div>
            <p class="text-xs text-gray-500 mt-2">
              Configure this URL in Overseerr/Jellyseerr Settings → Notifications → Webhook
            </p>
          </div>
        </div>
      </Card>

      <!-- Secret Key -->
      <Card>
        <h3 class="text-lg font-medium mb-4">Authentication</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Secret Key (Optional)</label>
            <div class="flex gap-2">
              <PasswordInput
                v-model="displaySecretKey"
                :readonly="true"
                placeholder="No secret key configured"
                class="flex-1"
              />
              <Button @click="copySecretKey" variant="secondary">
                📋 Copy
              </Button>
              <Button @click="generateKey" variant="primary" :disabled="generating">
                {{ config.secret_key ? '🔄 Regenerate' : '✨ Generate' }}
              </Button>
            </div>
            <p class="text-xs text-gray-500 mt-2">
              If set, include as query parameter: <code class="bg-gray-800 px-1 py-0.5 rounded">?key=YOUR_SECRET_KEY</code>
            </p>
            <p v-if="config.secret_key" class="text-xs text-yellow-500 mt-1">
              ⚠️ Regenerating will invalidate the existing key
            </p>
          </div>
        </div>
      </Card>

      <!-- Event Processing -->
      <Card>
        <h3 class="text-lg font-medium mb-4">Event Processing</h3>
        <p class="text-sm text-gray-400 mb-4">Choose which {{ requestManagerName }} events to process and classify</p>
        <div class="space-y-3">
          <div class="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <div>
              <div class="font-medium">Pending Requests</div>
              <div class="text-sm text-gray-400">Process newly submitted requests</div>
            </div>
            <Toggle v-model="config.process_pending" @update:modelValue="saveConfig" />
          </div>
          <div class="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <div>
              <div class="font-medium">Approved Requests</div>
              <div class="text-sm text-gray-400">Process manually approved requests</div>
            </div>
            <Toggle v-model="config.process_approved" @update:modelValue="saveConfig" />
          </div>
          <div class="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <div>
              <div class="font-medium">Auto-Approved Requests</div>
              <div class="text-sm text-gray-400">Process automatically approved requests</div>
            </div>
            <Toggle v-model="config.process_auto_approved" @update:modelValue="saveConfig" />
          </div>
          <div class="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <div>
              <div class="font-medium">Declined Requests</div>
              <div class="text-sm text-gray-400">Track declined requests (no classification)</div>
            </div>
            <Toggle v-model="config.process_declined" @update:modelValue="saveConfig" />
          </div>
        </div>
      </Card>

      <!-- Notifications -->
      <Card>
        <h3 class="text-lg font-medium mb-4">Notifications</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <div>
              <div class="font-medium">Notify on Receive</div>
              <div class="text-sm text-gray-400">Send notification when webhook is received</div>
            </div>
            <Toggle v-model="config.notify_on_receive" @update:modelValue="saveConfig" />
          </div>
          <div class="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <div>
              <div class="font-medium">Notify on Error</div>
              <div class="text-sm text-gray-400">Send notification on processing errors</div>
            </div>
            <Toggle v-model="config.notify_on_error" @update:modelValue="saveConfig" />
          </div>
        </div>
      </Card>

      <!-- Statistics -->
      <Card v-if="stats">
        <h3 class="text-lg font-medium mb-4">Statistics</h3>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div class="bg-gray-800 p-4 rounded-lg text-center">
            <div class="text-2xl font-bold text-blue-400">{{ stats.total }}</div>
            <div class="text-sm text-gray-400">Total</div>
          </div>
          <div class="bg-gray-800 p-4 rounded-lg text-center">
            <div class="text-2xl font-bold text-green-400">{{ stats.completed }}</div>
            <div class="text-sm text-gray-400">Completed</div>
          </div>
          <div class="bg-gray-800 p-4 rounded-lg text-center">
            <div class="text-2xl font-bold text-red-400">{{ stats.failed }}</div>
            <div class="text-sm text-gray-400">Failed</div>
          </div>
          <div class="bg-gray-800 p-4 rounded-lg text-center">
            <div class="text-2xl font-bold text-purple-400">{{ stats.last24h }}</div>
            <div class="text-sm text-gray-400">Last 24h</div>
          </div>
          <div class="bg-gray-800 p-4 rounded-lg text-center">
            <div class="text-2xl font-bold text-yellow-400">{{ stats.avgProcessingTime }}ms</div>
            <div class="text-sm text-gray-400">Avg Time</div>
          </div>
        </div>
      </Card>

      <!-- Test Webhook -->
      <Card>
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-medium">Test Webhook</h3>
            <p class="text-sm text-gray-400">Send a test webhook to verify configuration</p>
          </div>
          <Button @click="testWebhook" :disabled="testing">
            {{ testing ? '⏳ Testing...' : '🧪 Send Test' }}
          </Button>
        </div>
      </Card>

      <!-- Recent Webhooks -->
      <Card>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium">Recent Webhooks</h3>
          <Button @click="loadLogs" variant="secondary" size="sm">
            🔄 Refresh
          </Button>
        </div>

        <div v-if="loadingLogs" class="text-center py-8 text-gray-500">
          <Spinner />
        </div>

        <div v-else-if="logs.length === 0" class="text-center py-8 text-gray-500">
          No webhook activity yet
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="log in logs"
            :key="log.id"
            class="p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <div class="flex items-start justify-between mb-2">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-medium">{{ log.media_title || 'Unknown' }}</span>
                  <span
                    v-if="log.media_type"
                    class="px-2 py-0.5 bg-blue-900/30 text-blue-400 text-xs rounded"
                  >
                    {{ log.media_type }}
                  </span>
                </div>
                <div class="text-sm text-gray-400">
                  {{ log.notification_type || log.event_name }}
                </div>
              </div>
              <span
                :class="[
                  'px-2 py-1 rounded text-xs font-medium',
                  log.processing_status === 'completed' ? 'bg-green-900/30 text-green-400' :
                  log.processing_status === 'failed' ? 'bg-red-900/30 text-red-400' :
                  log.processing_status === 'skipped' ? 'bg-yellow-900/30 text-yellow-400' :
                  'bg-gray-900/30 text-gray-400'
                ]"
              >
                {{ log.processing_status }}
              </span>
            </div>

            <div class="flex items-center gap-4 text-xs text-gray-500">
              <span>{{ formatDate(log.received_at) }}</span>
              <span v-if="log.routed_to_library">→ {{ log.routed_to_library }}</span>
              <span v-if="log.processing_time_ms">{{ log.processing_time_ms }}ms</span>
              <span v-if="log.ip_address">{{ log.ip_address }}</span>
            </div>

            <div v-if="log.error_message" class="mt-2 text-xs text-red-400 bg-red-900/20 p-2 rounded">
              {{ log.error_message }}
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="logsData.totalPages > 1" class="flex justify-center gap-2 mt-4">
            <Button
              @click="changePage(logsData.page - 1)"
              :disabled="logsData.page <= 1"
              variant="secondary"
              size="sm"
            >
              ← Previous
            </Button>
            <span class="px-4 py-2 text-sm text-gray-400">
              Page {{ logsData.page }} of {{ logsData.totalPages }}
            </span>
            <Button
              @click="changePage(logsData.page + 1)"
              :disabled="logsData.page >= logsData.totalPages"
              variant="secondary"
              size="sm"
            >
              Next →
            </Button>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'
import { Card, Button, Toggle, PasswordInput, Spinner } from '@/components/common'

const toast = useToast()

const loading = ref(true)
const loadingLogs = ref(false)
const generating = ref(false)
const testing = ref(false)

const config = ref({
  enabled: true,
  webhook_type: 'overseerr',
  secret_key: '',
  process_pending: true,
  process_approved: true,
  process_auto_approved: true,
  process_declined: false,
  notify_on_receive: true,
  notify_on_error: true
})

// Multi-source management
const sources = ref([])
const showAddSource = ref(false)
const newSource = ref({ name: '', webhook_type: 'overseerr' })

const loadSources = async () => {
  try {
    const response = await api.getWebhookConfigs()
    sources.value = response.data || []
  } catch (error) {
    console.error('Failed to load sources:', error)
  }
}

const addSource = async () => {
  try {
    await api.createWebhookConfig(newSource.value)
    await loadSources()
    showAddSource.value = false
    newSource.value = { name: '', webhook_type: 'overseerr' }
    toast.success('Source added')
  } catch (error) {
    console.error('Failed to add source:', error)
    toast.error('Failed to add source')
  }
}

const deleteSource = async (id) => {
  if (!confirm('Delete this webhook source?')) return
  try {
    await api.deleteWebhookConfig(id)
    await loadSources()
    toast.success('Source deleted')
  } catch (error) {
    console.error('Failed to delete source:', error)
    toast.error(error.response?.data?.error || 'Failed to delete source')
  }
}

const setPrimary = async (id) => {
  try {
    await api.setPrimaryWebhookConfig(id)
    await loadSources()
    toast.success('Primary source updated')
  } catch (error) {
    console.error('Failed to set primary:', error)
    toast.error('Failed to set primary')
  }
}

const requestManagerName = computed(() => {
  const names = { overseerr: 'Overseerr', jellyseerr: 'Jellyseerr', seer: 'Seer' }
  return names[config.value.webhook_type] || 'Overseerr'
})

const stats = ref(null)
const logsData = ref({ logs: [], page: 1, limit: 20, totalPages: 1 })
const logs = computed(() => logsData.value.logs || [])

// Masked token pattern - matches backend maskToken format
const MASKED_TOKEN_PREFIX = '••••••••'

const isMaskedToken = (token) => {
  return token && token.startsWith(MASKED_TOKEN_PREFIX)
}

const webhookUrl = computed(() => {
  const baseUrl = window.location.origin
  // Universal webhook endpoint - works for all request managers
  let url = `${baseUrl}/api/webhook/request`
  if (config.value.secret_key && !isMaskedToken(config.value.secret_key)) {
    url += `?key=${config.value.secret_key}`
  }
  return url
})

const displaySecretKey = computed(() => config.value.secret_key || '')

onMounted(async () => {
  await Promise.all([
    loadConfig(),
    loadStats(),
    loadLogs(),
    loadSources()
  ])
  loading.value = false
})

const loadConfig = async () => {
  try {
    const response = await api.getWebhookConfig()
    if (response.data) {
      config.value = response.data
    }
  } catch (error) {
    console.error('Failed to load webhook config:', error)
    toast.error('Failed to load webhook configuration')
  }
}

const saveConfig = async () => {
  try {
    const response = await api.updateWebhookConfig(config.value)
    config.value = response.data
    toast.success('Webhook configuration saved')
  } catch (error) {
    console.error('Failed to save config:', error)
    toast.error('Failed to save configuration')
  }
}

const generateKey = async () => {
  if (config.value.secret_key) {
    if (!confirm('Are you sure? This will invalidate the existing secret key.')) {
      return
    }
  }

  generating.value = true
  try {
    const response = await api.generateWebhookKey()
    config.value = response.data
    toast.success('Secret key generated successfully! Make sure to copy it.')
  } catch (error) {
    console.error('Failed to generate key:', error)
    toast.error('Failed to generate secret key')
  } finally {
    generating.value = false
  }
}

const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(webhookUrl.value)
    toast.success('Webhook URL copied to clipboard')
  } catch (error) {
    toast.error('Failed to copy URL')
  }
}

const copySecretKey = async () => {
  if (!config.value.secret_key) {
    toast.error('No secret key to copy')
    return
  }
  try {
    await navigator.clipboard.writeText(config.value.secret_key)
    toast.success('Secret key copied to clipboard')
  } catch (error) {
    toast.error('Failed to copy secret key')
  }
}

const loadStats = async () => {
  try {
    const response = await api.getWebhookStats()
    stats.value = response.data
  } catch (error) {
    console.error('Failed to load stats:', error)
  }
}

const loadLogs = async (page = 1) => {
  loadingLogs.value = true
  try {
    const response = await api.getWebhookLogs({ 
      page, 
      limit: logsData.value.limit 
    })
    logsData.value = response.data
  } catch (error) {
    console.error('Failed to load logs:', error)
    toast.error('Failed to load webhook logs')
  } finally {
    loadingLogs.value = false
  }
}

const changePage = (page) => {
  loadLogs(page)
}

const testWebhook = async () => {
  testing.value = true
  try {
    const response = await api.testWebhook()
    toast.success('Test webhook sent successfully')
    // Reload logs and stats to show the test
    await Promise.all([loadLogs(), loadStats()])
  } catch (error) {
    console.error('Failed to send test webhook:', error)
    toast.error('Failed to send test webhook: ' + (error.response?.data?.error || error.message))
  } finally {
    testing.value = false
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleString()
}
</script>
