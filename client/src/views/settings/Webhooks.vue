<template>
  <div class="webhooks-settings">
    <div class="card">
      <div class="card-title">Webhook Configuration</div>
      
      <div v-if="connectionStatus" class="status-indicator" :class="`status-${connectionStatus.type}`">
        {{ connectionStatus.message }}
      </div>
      
      <div class="form-group">
        <label class="form-label">Webhook URL</label>
        <div style="display: flex; gap: 0.5rem;">
          <input
            :value="settings.webhook_url"
            type="text"
            class="form-input"
            readonly
          />
          <button type="button" @click="copyWebhookUrl" class="btn btn-secondary">
            📋 Copy
          </button>
        </div>
        <small style="color: #94a3b8; font-size: 0.75rem; margin-top: 0.25rem; display: block;">
          Use this URL in Overseerr or other services
        </small>
      </div>
      
      <form @submit.prevent="saveSettings">
        <div class="form-group">
          <label class="form-label">
            <input type="checkbox" v-model="settings.enabled" />
            Enable Webhooks
          </label>
        </div>
        
        <div class="form-group">
          <label class="form-label">
            <input type="checkbox" v-model="settings.require_auth" />
            Require Authentication
          </label>
        </div>
        
        <div v-if="settings.require_auth" class="form-group">
          <label class="form-label">API Key</label>
          <div style="display: flex; gap: 0.5rem;">
            <input
              :value="settings.api_key_masked || settings.api_key"
              type="text"
              class="form-input"
              readonly
            />
            <button type="button" @click="generateApiKey" class="btn btn-secondary">
              🔄 Generate New
            </button>
          </div>
        </div>
        
        <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Settings' }}
          </button>
        </div>
      </form>
    </div>
    
    <div class="card" style="margin-top: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div class="card-title" style="margin: 0;">Recent Webhooks</div>
        <button @click="clearLogs" class="btn btn-danger" :disabled="clearing">
          {{ clearing ? 'Clearing...' : 'Clear Logs' }}
        </button>
      </div>
      
      <div v-if="logs.length === 0" style="color: #94a3b8; text-align: center; padding: 2rem;">
        No webhook logs yet
      </div>
      
      <table v-else style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid #334155;">
            <th style="padding: 0.75rem; text-align: left;">Time</th>
            <th style="padding: 0.75rem; text-align: left;">Source</th>
            <th style="padding: 0.75rem; text-align: left;">Media</th>
            <th style="padding: 0.75rem; text-align: left;">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id" style="border-bottom: 1px solid #334155;">
            <td style="padding: 0.75rem;">{{ formatDate(log.created_at) }}</td>
            <td style="padding: 0.75rem;">{{ log.source }}</td>
            <td style="padding: 0.75rem;">{{ log.media_title }}</td>
            <td style="padding: 0.75rem;">
              <span :class="`status-indicator status-${log.status === 'completed' ? 'success' : 'error'}`">
                {{ log.status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import api from '../../services/api'

export default {
  name: 'WebhooksSettings',
  data() {
    return {
      settings: {
        enabled: true,
        require_auth: false,
        api_key: '',
        api_key_masked: '',
        webhook_url: ''
      },
      logs: [],
      connectionStatus: null,
      saving: false,
      clearing: false
    }
  },
  async mounted() {
    await this.loadSettings()
    await this.loadLogs()
  },
  methods: {
    async loadSettings() {
      try {
        const response = await api.getWebhookSettings()
        if (response.data) {
          this.settings = {
            enabled: response.data.enabled !== false,
            require_auth: response.data.require_auth || false,
            api_key: response.data.api_key || '',
            api_key_masked: response.data.api_key_masked || '',
            webhook_url: response.data.webhook_url || ''
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    },
    async loadLogs() {
      try {
        const response = await api.getWebhookLogs()
        this.logs = response.data.logs || []
      } catch (error) {
        console.error('Failed to load logs:', error)
      }
    },
    async saveSettings() {
      this.saving = true
      
      try {
        await api.saveWebhookSettings({
          enabled: this.settings.enabled,
          require_auth: this.settings.require_auth
        })
        this.connectionStatus = {
          type: 'success',
          message: '✓ Settings saved successfully!'
        }
        
        setTimeout(() => {
          this.connectionStatus = null
        }, 3000)
      } catch (error) {
        this.connectionStatus = {
          type: 'error',
          message: `✗ Failed to save: ${error.message}`
        }
      } finally {
        this.saving = false
      }
    },
    async generateApiKey() {
      try {
        const response = await api.generateWebhookKey()
        this.settings.api_key = response.data.api_key
        this.settings.api_key_masked = ''
        this.connectionStatus = {
          type: 'success',
          message: '✓ New API key generated! Save settings to apply.'
        }
      } catch (error) {
        this.connectionStatus = {
          type: 'error',
          message: `✗ Failed to generate key: ${error.message}`
        }
      }
    },
    async clearLogs() {
      if (!confirm('Are you sure you want to clear all webhook logs?')) return
      
      this.clearing = true
      
      try {
        await api.clearWebhookLogs()
        this.logs = []
        this.connectionStatus = {
          type: 'success',
          message: '✓ Logs cleared successfully!'
        }
      } catch (error) {
        this.connectionStatus = {
          type: 'error',
          message: `✗ Failed to clear logs: ${error.message}`
        }
      } finally {
        this.clearing = false
      }
    },
    copyWebhookUrl() {
      navigator.clipboard.writeText(this.settings.webhook_url)
      this.connectionStatus = {
        type: 'success',
        message: '✓ Webhook URL copied to clipboard!'
      }
      
      setTimeout(() => {
        this.connectionStatus = null
      }, 2000)
    },
    formatDate(dateString) {
      return new Date(dateString).toLocaleString()
    }
  }
}
</script>

<style scoped>
.webhooks-settings {
  width: 100%;
}

.status-indicator {
  margin-bottom: 1rem;
}

input[type="checkbox"] {
  margin-right: 0.5rem;
}
</style>
