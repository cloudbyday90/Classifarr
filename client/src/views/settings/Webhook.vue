<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Webhook Settings</h1>
        <p class="text-gray-400 mt-1">Configure Overseerr/Jellyseerr webhook integration</p>
      </div>
      <Button @click="loadData" :loading="loading">
        <span v-if="!loading">↻ Refresh</span>
        <span v-else>Loading...</span>
      </Button>
    </div>

    <!-- Webhook URL -->
    <Card title="Webhook URL" description="Configure this URL in Overseerr/Jellyseerr webhook settings">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2">Full Webhook URL (with key)</label>
          <div class="flex gap-2">
            <input
              :value="webhookUrl"
              readonly
              class="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono"
            />
            <Button @click="copyUrl(webhookUrl)" variant="secondary">Copy</Button>
          </div>
          <p class="text-xs text-gray-500 mt-1">Use this URL for secure webhook authentication</p>
        </div>

        <div v-if="!config.has_secret">
          <label class="block text-sm font-medium mb-2">Webhook URL (without key)</label>
          <div class="flex gap-2">
            <input
              :value="webhookUrlWithoutKey"
              readonly
              class="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono"
            />
            <Button @click="copyUrl(webhookUrlWithoutKey)" variant="secondary">Copy</Button>
          </div>
          <p class="text-xs text-yellow-500 mt-1">⚠️ No authentication - anyone can send webhooks</p>
        </div>
      </div>
    </Card>

    <!-- Authentication Settings -->
    <Card title="Authentication" description="Secure your webhook endpoint with a secret key">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2">Secret Key</label>
          <div class="flex gap-2">
            <Input
              v-model="config.secret_key"
              :type="showSecret ? 'text' : 'password'"
              placeholder="Enter secret key or generate one"
              class="flex-1"
            />
            <Button @click="showSecret = !showSecret" variant="secondary">
              {{ showSecret ? 'Hide' : 'Show' }}
            </Button>
            <Button @click="generateKey" variant="secondary">Generate</Button>
          </div>
          <p class="text-xs text-gray-500 mt-1">
            This key will be required as a query parameter (?key=...) or X-Webhook-Key header
          </p>
        </div>

        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            v-model="config.enabled"
            id="webhook-enabled"
            class="w-4 h-4"
          />
          <label for="webhook-enabled" class="text-sm">Enable webhook endpoint</label>
        </div>
      </div>
    </Card>

    <!-- Event Handling -->
    <Card title="Event Handling" description="Choose which Overseerr events to process">
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            v-model="config.process_pending"
            id="process-pending"
            class="w-4 h-4"
          />
          <label for="process-pending" class="text-sm">
            <span class="font-medium">Media Requested</span>
            <span class="text-gray-400 ml-2">(MEDIA_PENDING)</span>
          </label>
        </div>

        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            v-model="config.process_auto_approved"
            id="process-auto-approved"
            class="w-4 h-4"
          />
          <label for="process-auto-approved" class="text-sm">
            <span class="font-medium">Auto-Approved</span>
            <span class="text-gray-400 ml-2">(MEDIA_AUTO_APPROVED)</span>
          </label>
        </div>

        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            v-model="config.process_approved"
            id="process-approved"
            class="w-4 h-4"
          />
          <label for="process-approved" class="text-sm">
            <span class="font-medium">Manually Approved</span>
            <span class="text-gray-400 ml-2">(MEDIA_APPROVED)</span>
          </label>
        </div>

        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            v-model="config.process_declined"
            id="process-declined"
            class="w-4 h-4"
          />
          <label for="process-declined" class="text-sm">
            <span class="font-medium">Log Declined Requests</span>
            <span class="text-gray-400 ml-2">(MEDIA_DECLINED)</span>
          </label>
        </div>
      </div>
    </Card>

    <!-- Notification Options -->
    <Card title="Notifications" description="Discord notification preferences">
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            v-model="config.notify_on_receive"
            id="notify-receive"
            class="w-4 h-4"
          />
          <label for="notify-receive" class="text-sm">Notify when webhook received</label>
        </div>

        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            v-model="config.notify_on_error"
            id="notify-error"
            class="w-4 h-4"
          />
          <label for="notify-error" class="text-sm">Notify on webhook processing errors</label>
        </div>
      </div>
    </Card>

    <!-- Save Button -->
    <div class="flex gap-2">
      <Button @click="saveConfig" :loading="saving" variant="success">Save Configuration</Button>
      <Button @click="testWebhook" :loading="testing" variant="secondary">Send Test Webhook</Button>
    </div>

    <!-- Statistics -->
    <Card title="Statistics" description="Webhook processing metrics">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-gray-800 p-4 rounded">
          <div class="text-2xl font-bold">{{ stats.total || 0 }}</div>
          <div class="text-sm text-gray-400">Total Webhooks</div>
        </div>
        <div class="bg-gray-800 p-4 rounded">
          <div class="text-2xl font-bold text-green-500">{{ stats.completed || 0 }}</div>
          <div class="text-sm text-gray-400">Completed</div>
        </div>
        <div class="bg-gray-800 p-4 rounded">
          <div class="text-2xl font-bold text-red-500">{{ stats.failed || 0 }}</div>
          <div class="text-sm text-gray-400">Failed</div>
        </div>
        <div class="bg-gray-800 p-4 rounded">
          <div class="text-2xl font-bold">{{ stats.last_24h || 0 }}</div>
          <div class="text-sm text-gray-400">Last 24 Hours</div>
        </div>
      </div>
      <div class="mt-4 text-sm text-gray-400">
        Average processing time: {{ Math.round(stats.avg_processing_time || 0) }}ms
      </div>
    </Card>

    <!-- Recent Webhooks -->
    <Card title="Recent Webhooks" description="Latest webhook activity">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-b border-gray-700">
            <tr>
              <th class="text-left py-2 px-3">Time</th>
              <th class="text-left py-2 px-3">Type</th>
              <th class="text-left py-2 px-3">Media</th>
              <th class="text-left py-2 px-3">Status</th>
              <th class="text-left py-2 px-3">Processing Time</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id" class="border-b border-gray-800">
              <td class="py-2 px-3 text-gray-400">
                {{ formatDate(log.received_at) }}
              </td>
              <td class="py-2 px-3">
                <Badge :variant="getTypeVariant(log.notification_type)">
                  {{ log.notification_type }}
                </Badge>
              </td>
              <td class="py-2 px-3">
                <div class="font-medium">{{ log.media_title || 'Unknown' }}</div>
                <div class="text-xs text-gray-500">{{ log.media_type }}</div>
              </td>
              <td class="py-2 px-3">
                <Badge :variant="getStatusVariant(log.processing_status)">
                  {{ log.processing_status }}
                </Badge>
              </td>
              <td class="py-2 px-3 text-gray-400">
                {{ log.processing_time_ms ? log.processing_time_ms + 'ms' : '-' }}
              </td>
            </tr>
            <tr v-if="logs.length === 0">
              <td colspan="5" class="py-8 text-center text-gray-500">
                No webhooks received yet
              </td>
            </tr>
          </tbody>
        </table>
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
import Badge from '@/components/common/Badge.vue'

const config = ref({
  enabled: true,
  secret_key: '',
  process_pending: true,
  process_approved: true,
  process_auto_approved: true,
  process_declined: false,
  notify_on_receive: true,
  notify_on_error: true,
  has_secret: false
})

const webhookUrl = ref('')
const webhookUrlWithoutKey = ref('')
const stats = ref({})
const logs = ref([])

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const showSecret = ref(false)

onMounted(() => {
  loadData()
})

const loadData = async () => {
  loading.value = true
  try {
    const [configRes, urlRes, statsRes, logsRes] = await Promise.all([
      api.getWebhookConfig(),
      api.getWebhookUrl(),
      api.getWebhookStats(),
      api.getWebhookLogs({ limit: 20 })
    ])

    if (configRes.data) {
      config.value = { ...config.value, ...configRes.data }
    }
    if (urlRes.data) {
      webhookUrl.value = urlRes.data.url
      webhookUrlWithoutKey.value = urlRes.data.url_without_key
    }
    if (statsRes.data) {
      stats.value = statsRes.data
    }
    if (logsRes.data) {
      logs.value = logsRes.data
    }
  } catch (error) {
    console.error('Failed to load webhook data:', error)
    alert('Failed to load webhook data: ' + error.message)
  } finally {
    loading.value = false
  }
}

const saveConfig = async () => {
  saving.value = true
  try {
    await api.updateWebhookConfig(config.value)
    alert('Webhook configuration saved successfully!')
    await loadData()
  } catch (error) {
    alert('Failed to save configuration: ' + error.message)
  } finally {
    saving.value = false
  }
}

const generateKey = async () => {
  try {
    const response = await api.generateWebhookKey()
    config.value.secret_key = response.data.key
    showSecret.value = true
    alert('New secret key generated! Make sure to save the configuration.')
  } catch (error) {
    alert('Failed to generate key: ' + error.message)
  }
}

const copyUrl = async (url) => {
  try {
    await navigator.clipboard.writeText(url)
    alert('URL copied to clipboard!')
  } catch (error) {
    alert('Failed to copy URL: ' + error.message)
  }
}

const testWebhook = async () => {
  testing.value = true
  try {
    const response = await api.testWebhook({
      notification_type: 'TEST_NOTIFICATION'
    })
    if (response.data.success) {
      alert('Test webhook sent successfully!')
      await loadData()
    } else {
      alert('Test webhook failed: ' + response.data.error)
    }
  } catch (error) {
    alert('Failed to send test webhook: ' + error.message)
  } finally {
    testing.value = false
  }
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString()
}

const getTypeVariant = (type) => {
  const variants = {
    'TEST_NOTIFICATION': 'info',
    'MEDIA_PENDING': 'warning',
    'MEDIA_APPROVED': 'success',
    'MEDIA_AUTO_APPROVED': 'success',
    'MEDIA_DECLINED': 'danger',
    'MEDIA_AVAILABLE': 'success',
    'MEDIA_FAILED': 'danger'
  }
  return variants[type] || 'secondary'
}

const getStatusVariant = (status) => {
  const variants = {
    'received': 'info',
    'processing': 'warning',
    'completed': 'success',
    'failed': 'danger',
    'skipped': 'secondary'
  }
  return variants[status] || 'secondary'
}
</script>
