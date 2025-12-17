<template>
  <div class="tmdb-settings">
    <div class="card">
      <div class="card-title">TMDB Configuration</div>
      
      <div v-if="connectionStatus" class="status-indicator" :class="`status-${connectionStatus.type}`">
        {{ connectionStatus.message }}
      </div>
      
      <form @submit.prevent="saveSettings">
        <div class="form-group">
          <label class="form-label">API Key</label>
          <div style="display: flex; gap: 0.5rem;">
            <input
              v-model="apiKey"
              :type="showApiKey ? 'text' : 'password'"
              class="form-input"
              placeholder="Enter your TMDB API key"
              required
            />
            <button type="button" @click="showApiKey = !showApiKey" class="btn btn-secondary">
              {{ showApiKey ? '👁️' : '👁️‍🗨️' }}
            </button>
          </div>
          <small style="color: #94a3b8; font-size: 0.75rem; margin-top: 0.25rem; display: block;">
            Get your API key from <a href="https://www.themoviedb.org/settings/api" target="_blank" style="color: #3b82f6;">themoviedb.org/settings/api</a>
          </small>
        </div>
        
        <div style="display: flex; gap: 1rem;">
          <button type="button" @click="testConnection" class="btn btn-secondary" :disabled="!apiKey || testing">
            {{ testing ? 'Testing...' : 'Test Connection' }}
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
  name: 'TMDBSettings',
  data() {
    return {
      apiKey: '',
      showApiKey: false,
      connectionStatus: null,
      testing: false,
      saving: false
    }
  },
  async mounted() {
    await this.loadSettings()
  },
  methods: {
    async loadSettings() {
      try {
        const response = await api.getTMDBSettings()
        if (response.data.api_key) {
          this.apiKey = response.data.api_key
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    },
    async testConnection() {
      if (!this.apiKey) return
      
      this.testing = true
      this.connectionStatus = null
      
      try {
        const response = await api.testTMDBConnection(this.apiKey)
        if (response.data.success) {
          this.connectionStatus = {
            type: 'success',
            message: '✓ Connected successfully!'
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
    async saveSettings() {
      this.saving = true
      
      try {
        await api.saveTMDBSettings({ api_key: this.apiKey })
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
.tmdb-settings {
  width: 100%;
}

.status-indicator {
  margin-bottom: 1rem;
}
</style>
