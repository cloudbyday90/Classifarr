<template>
  <div class="discord-settings">
    <div class="card">
      <div class="card-title">Discord Bot Configuration</div>
      
      <div v-if="connectionStatus" class="status-indicator" :class="`status-${connectionStatus.type}`">
        {{ connectionStatus.message }}
      </div>
      
      <form @submit.prevent="saveSettings">
        <div class="form-group">
          <label class="form-label">
            <input type="checkbox" v-model="settings.enabled" />
            Enable Discord Notifications
          </label>
        </div>
        
        <div class="form-group">
          <label class="form-label">Bot Token</label>
          <div style="display: flex; gap: 0.5rem;">
            <input
              v-model="settings.bot_token"
              :type="showToken ? 'text' : 'password'"
              class="form-input"
              placeholder="Enter your Discord bot token"
              :required="settings.enabled"
            />
            <button type="button" @click="showToken = !showToken" class="btn btn-secondary">
              {{ showToken ? '👁️' : '👁️‍🗨️' }}
            </button>
          </div>
          <small style="color: #94a3b8; font-size: 0.75rem; margin-top: 0.25rem; display: block;">
            Create bot at <a href="https://discord.com/developers/applications" target="_blank" style="color: #3b82f6;">discord.com/developers</a>
          </small>
        </div>
        
        <div class="form-group">
          <label class="form-label">Channel ID</label>
          <input
            v-model="settings.channel_id"
            type="text"
            class="form-input"
            placeholder="Channel ID where notifications will be sent"
            :required="settings.enabled"
          />
        </div>
        
        <div class="card" style="background: #0f172a; padding: 1rem; margin: 1rem 0;">
          <h4 style="margin-bottom: 0.75rem; font-size: 0.875rem;">Notification Options</h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;">
            <label class="form-label">
              <input type="checkbox" v-model="settings.on_classification" />
              On New Classification
            </label>
            <label class="form-label">
              <input type="checkbox" v-model="settings.on_correction" />
              On Correction
            </label>
            <label class="form-label">
              <input type="checkbox" v-model="settings.notify_on_error" />
              On Error
            </label>
            <label class="form-label">
              <input type="checkbox" v-model="settings.notify_daily_summary" />
              Daily Summary
            </label>
          </div>
        </div>
        
        <div class="card" style="background: #0f172a; padding: 1rem; margin: 1rem 0;">
          <h4 style="margin-bottom: 0.75rem; font-size: 0.875rem;">Display Options</h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;">
            <label class="form-label">
              <input type="checkbox" v-model="settings.show_poster" />
              Show Poster
            </label>
            <label class="form-label">
              <input type="checkbox" v-model="settings.show_confidence" />
              Show Confidence
            </label>
            <label class="form-label">
              <input type="checkbox" v-model="settings.show_reason" />
              Show Reason
            </label>
            <label class="form-label">
              <input type="checkbox" v-model="settings.show_correction_buttons" />
              Show Correction Buttons
            </label>
            <label class="form-label">
              <input type="checkbox" v-model="settings.show_library_dropdown" />
              Show Library Dropdown
            </label>
          </div>
          
          <div class="form-group" style="margin-top: 1rem;">
            <label class="form-label">Quick Correct Button Count ({{ settings.quick_correct_count }})</label>
            <input
              v-model.number="settings.quick_correct_count"
              type="range"
              min="1"
              max="5"
              step="1"
              class="form-input"
              style="cursor: pointer;"
            />
          </div>
        </div>
        
        <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
          <button type="button" @click="testConnection" class="btn btn-secondary" :disabled="!settings.bot_token || testing">
            {{ testing ? 'Testing...' : 'Test Connection' }}
          </button>
          <button type="button" @click="sendTestMessage" class="btn btn-secondary" :disabled="!settings.enabled || sendingTest">
            {{ sendingTest ? 'Sending...' : 'Send Test Message' }}
          </button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Settings' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import api from '../../services/api'

export default {
  name: 'DiscordSettings',
  data() {
    return {
      settings: {
        enabled: false,
        bot_token: '',
        channel_id: '',
        on_classification: true,
        on_correction: true,
        notify_on_error: false,
        notify_daily_summary: false,
        show_poster: true,
        show_confidence: true,
        show_reason: true,
        show_correction_buttons: true,
        quick_correct_count: 3,
        show_library_dropdown: true
      },
      showToken: false,
      connectionStatus: null,
      testing: false,
      saving: false,
      sendingTest: false
    }
  },
  async mounted() {
    await this.loadSettings()
  },
  methods: {
    async loadSettings() {
      try {
        const response = await api.getDiscordSettings()
        if (response.data) {
          this.settings = {
            enabled: response.data.enabled || false,
            bot_token: response.data.bot_token || '',
            channel_id: response.data.channel_id || '',
            on_classification: response.data.on_classification !== false,
            on_correction: response.data.on_correction !== false,
            notify_on_error: response.data.notify_on_error || false,
            notify_daily_summary: response.data.notify_daily_summary || false,
            show_poster: response.data.show_poster !== false,
            show_confidence: response.data.show_confidence !== false,
            show_reason: response.data.show_reason !== false,
            show_correction_buttons: response.data.show_correction_buttons !== false,
            quick_correct_count: response.data.quick_correct_count || 3,
            show_library_dropdown: response.data.show_library_dropdown !== false
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    },
    async testConnection() {
      this.testing = true
      this.connectionStatus = null
      
      try {
        const response = await api.testDiscordConnection(this.settings.bot_token)
        if (response.data.success) {
          this.connectionStatus = {
            type: 'success',
            message: `✓ Connected as ${response.data.botName}!`
          }
        } else {
          this.connectionStatus = {
            type: 'error',
            message: `✗ Connection failed: ${response.data.error}`
          }
        }
      } catch (error) {
        this.connectionStatus = {
          type: 'error',
          message: `✗ Connection failed: ${error.message}`
        }
      } finally {
        this.testing = false
      }
    },
    async sendTestMessage() {
      this.sendingTest = true
      this.connectionStatus = null
      
      try {
        const response = await api.sendDiscordTestMessage()
        if (response.data.success) {
          this.connectionStatus = {
            type: 'success',
            message: '✓ Test message sent successfully!'
          }
        } else {
          this.connectionStatus = {
            type: 'error',
            message: `✗ Failed to send: ${response.data.error}`
          }
        }
      } catch (error) {
        this.connectionStatus = {
          type: 'error',
          message: `✗ Failed to send: ${error.message}`
        }
      } finally {
        this.sendingTest = false
      }
    },
    async saveSettings() {
      this.saving = true
      
      try {
        await api.saveDiscordSettings(this.settings)
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
    }
  }
}
</script>

<style scoped>
.discord-settings {
  width: 100%;
}

.status-indicator {
  margin-bottom: 1rem;
}

input[type="checkbox"] {
  margin-right: 0.5rem;
}
</style>
