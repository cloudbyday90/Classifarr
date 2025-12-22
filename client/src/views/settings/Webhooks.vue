<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold mb-2">Request Manager Webhook</h2>
        <p class="text-gray-400 text-sm">Configure webhook integration for automatic media classification from requests.</p>
      </div>
      <Button @click="showSetupHelp = true" variant="secondary" size="sm">
        ❓ Setup Guide
      </Button>
    </div>

    <div v-if="loading" class="text-center py-8">
      <Spinner />
    </div>

    <!-- Setup Guide Modal -->
    <div v-if="showSetupHelp" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div class="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 shadow-xl">
        <div class="p-6 border-b border-gray-700 flex justify-between items-center">
          <h3 class="text-lg font-medium">How to Configure Overseerr/Jellyseerr</h3>
          <button @click="showSetupHelp = false" class="text-gray-400 hover:text-white">✕</button>
        </div>
        <div class="p-6 space-y-6 text-gray-300">
          <div class="space-y-4">
            <div class="flex gap-4">
              <div class="flex-none w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold">1</div>
              <div>
                <h4 class="font-medium text-white mb-1">Open Overseerr Settings</h4>
                <p class="text-sm">Go to <strong>Settings → Notifications → Webhook</strong>.</p>
              </div>
            </div>

            <div class="flex gap-4">
              <div class="flex-none w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold">2</div>
              <div>
                <h4 class="font-medium text-white mb-1">Add Webhook URL</h4>
                <p class="text-sm mb-2">Copy the <strong>Webhook Endpoint</strong> from this page and paste it into the <strong>Webhook URL</strong> field in Overseerr.</p>
              </div>
            </div>

            <div class="flex gap-4">
              <div class="flex-none w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold">3</div>
              <div>
                <h4 class="font-medium text-white mb-1">Set JSON Payload</h4>
                <p class="text-sm mb-2">Copy the <strong>JSON Payload</strong> template from this page and paste it into the <strong>JSON Payload</strong> field in Overseerr.</p>
                <div class="text-xs bg-yellow-900/20 text-yellow-500 p-2 rounded border border-yellow-900/30">
                  ⚠️ This is critical. Without the correct payload, Classifarr cannot read the request data.
                </div>
              </div>
            </div>

            <div class="flex gap-4">
              <div class="flex-none w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold">4</div>
              <div>
                <h4 class="font-medium text-white mb-1">Select Notification Types</h4>
                <p class="text-sm mb-2">Check the events you want to trigger classification:</p>
                <ul class="list-disc list-inside text-sm text-gray-400 ml-2 space-y-1">
                  <li><strong>Request Pending Approval</strong> (Recommended)</li>
                  <li><strong>Request Approved</strong></li>
                  <li><strong>Request Automatically Approved</strong></li>
                </ul>
              </div>
            </div>

            <div class="flex gap-4">
              <div class="flex-none w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold">5</div>
              <div>
                <h4 class="font-medium text-white mb-1">Test and Save</h4>
                <p class="text-sm">Click <strong>Test</strong> in Overseerr to verify connectivity. You should see a success message and a new entry in the Classifarr logs. Finally, click <strong>Save</strong>.</p>
              </div>
            </div>
          </div>
        </div>
        <div class="p-6 border-t border-gray-700 bg-gray-800/50 flex justify-end">
          <Button @click="showSetupHelp = false" variant="primary">
            Got it
          </Button>
        </div>
      </div>
    </div>

    <div v-else class="space-y-6">
      <!-- View Mode: Status & Summary -->
      <div v-if="!isEditing" class="space-y-6">
        <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-4">
              <div :class="['p-3 rounded-full', config.enabled ? 'bg-green-900/30 text-green-400' : 'bg-gray-700/50 text-gray-400']">
                <span class="text-2xl">📡</span>
              </div>
              <div>
                <h3 class="text-lg font-medium flex items-center gap-2">
                  Webhook Listener
                  <span v-if="config.enabled" class="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full border border-green-900">Active</span>
                  <span v-else class="text-xs bg-gray-700/50 text-gray-400 px-2 py-0.5 rounded-full border border-gray-600">Inactive</span>
                </h3>
                <p class="text-sm text-gray-400">
                  {{ sources.length > 0 ? `Receiving from ${sources.length} source${sources.length !== 1 ? 's' : ''}` : 'No sources configured' }}
                </p>
              </div>
            </div>
            <div class="flex gap-3">
              <Button @click="testWebhook" :disabled="testing" variant="secondary">
                {{ testing ? '⏳ Testing...' : '🧪 Test' }}
              </Button>
              <button 
                @click="isEditing = true"
                class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
              >
                Configure
              </button>
            </div>
          </div>

          <!-- URL Display -->
          <div class="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50 mb-6">
            <label class="block text-xs text-gray-500 uppercase tracking-widest mb-2">Webhook Endpoint</label>
            <div class="flex gap-2">
              <code class="flex-1 bg-gray-950 px-3 py-2 rounded text-gray-300 font-mono text-sm overflow-x-auto whitespace-nowrap">
                {{ webhookUrl }}
              </code>
              <Button @click="copyUrl" variant="secondary" size="sm">
                📋 Copy
              </Button>
            </div>
            
            <div class="mt-4 pt-4 border-t border-gray-800">
               <label class="block text-xs text-gray-500 uppercase tracking-widest mb-2">JSON Payload</label>
               <p class="text-xs text-gray-400 mb-2">
                 Paste this into the "JSON Payload" field in your Overseerr/Jellyseerr Webhook settings:
               </p>
               <div class="relative group">
                 <pre class="bg-gray-950 p-3 rounded text-gray-300 font-mono text-xs overflow-x-auto">{{ jsonPayload }}</pre>
                 <button 
                  @click="copyPayload" 
                  class="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Copy JSON"
                 >
                   📋
                 </button>
               </div>
            </div>
          </div>

          <!-- Quick Stats -->
          <div v-if="stats" class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-700">
            <div>
              <div class="text-2xl font-bold text-blue-400">{{ stats.total }}</div>
              <div class="text-xs text-gray-500 uppercase">Total Received</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-green-400">{{ stats.completed }}</div>
              <div class="text-xs text-gray-500 uppercase">Processed</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-red-400">{{ stats.failed }}</div>
              <div class="text-xs text-gray-500 uppercase">Failed</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-yellow-400">{{ stats.avgProcessingTime }}ms</div>
              <div class="text-xs text-gray-500 uppercase">Avg Time</div>
            </div>
          </div>
        </div>

        <!-- Recent Logs (Always Visible) -->
        <Card>
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium">Recent Activity</h3>
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

      <!-- Edit Mode: Full Configuration -->
      <div v-else class="space-y-6">
        <div class="flex justify-between items-center bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 class="text-lg font-medium">Configuration</h3>
          <div class="flex gap-2">
             <button 
              @click="isEditing = false"
              class="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Done
            </button>
          </div>
        </div>

        <!-- Enable/Disable -->
        <Card>
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-medium">Enable Webhook Listener</h3>
              <p class="text-sm text-gray-400">Toggle the entire webhook processing system</p>
            </div>
            <Toggle v-model="config.enabled" @update:modelValue="saveConfig" />
          </div>
        </Card>

        <!-- Multi-Source Manager -->
        <Card>
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium">Authorized Sources</h3>
            <button
              @click="showAddSource = true"
              class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
            >
              + Add Source
            </button>
          </div>

          <div v-if="sources.length === 0" class="text-gray-500 text-center py-4 bg-gray-900/30 rounded-lg border border-dashed border-gray-700">
            No sources configured. Webhooks may be rejected.
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
                  ★ Set Primary
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
        </Card>

        <!-- Global Settings Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Event Processing -->
          <Card>
            <h3 class="text-lg font-medium mb-4">Event Rules</h3>
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="text-sm">Pending Requests</div>
                <Toggle v-model="config.process_pending" @update:modelValue="saveConfig" />
              </div>
              <div class="flex items-center justify-between">
                <div class="text-sm">Approved Requests</div>
                <Toggle v-model="config.process_approved" @update:modelValue="saveConfig" />
              </div>
              <div class="flex items-center justify-between">
                <div class="text-sm">Auto-Approved</div>
                <Toggle v-model="config.process_auto_approved" @update:modelValue="saveConfig" />
              </div>
              <div class="flex items-center justify-between">
                <div class="text-sm">Declined Requests</div>
                <Toggle v-model="config.process_declined" @update:modelValue="saveConfig" />
              </div>
            </div>
          </Card>

          <!-- Notifications & Auth -->
          <div class="space-y-6">
            <Card>
              <h3 class="text-lg font-medium mb-4">Notifications</h3>
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <div class="text-sm">Notify on Receive</div>
                  <Toggle v-model="config.notify_on_receive" @update:modelValue="saveConfig" />
                </div>
                <div class="flex items-center justify-between">
                  <div class="text-sm">Notify on Error</div>
                  <Toggle v-model="config.notify_on_error" @update:modelValue="saveConfig" />
                </div>
              </div>
            </Card>

            <Card>
              <h3 class="text-lg font-medium mb-4">Security</h3>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium mb-2">Secret Key</label>
                  <div class="flex gap-2">
                    <PasswordInput
                      v-model="displaySecretKey"
                      :readonly="true"
                      placeholder="Optional"
                      class="flex-1"
                    />
                    <Button @click="generateKey" variant="primary" size="sm" :disabled="generating">
                      {{ config.secret_key ? 'Regenerate' : 'Generate' }}
                    </Button>
                  </div>
                  <p class="text-xs text-gray-500 mt-2">
                    Adds <code class="bg-gray-800 px-1 rounded">?key=YOUR_KEY</code> to the URL
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div class="flex justify-end pt-4">
            <button 
              @click="isEditing = false"
              class="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
            >
              Done Configuration
            </button>
        </div>
      </div>

      <!-- Add Source Modal -->
      <div v-if="showAddSource" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700 shadow-xl">
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
const isEditing = ref(false)

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

const showSetupHelp = ref(false)

// ... (existing code)

const jsonPayload = `{
  "notification_type": "{{notification_type}}",
  "event": "{{event}}",
  "subject": "{{subject}}",
  "message": "{{message}}",
  "image": "{{image}}",
  "email": "{{email}}",
  "username": "{{username}}",
  "avatar": "{{avatar}}",
  "media": {{media}},
  "request": {{request}},
  "extra": []
}`

// ... (existing code)


const copyPayload = async () => {
  try {
    await navigator.clipboard.writeText(jsonPayload)
    toast.success('JSON payload copied to clipboard')
  } catch (error) {
    toast.error('Failed to copy payload')
  }
}

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
