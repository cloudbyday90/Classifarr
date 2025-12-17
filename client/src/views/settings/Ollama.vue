<template>
  <div class="ollama-settings">
    <div class="card">
      <div class="card-title">Ollama / AI Configuration</div>
      
      <div v-if="connectionStatus" class="status-indicator" :class="`status-${connectionStatus.type}`">
        {{ connectionStatus.message }}
      </div>
      
      <form @submit.prevent="saveSettings">
        <div class="form-group">
          <label class="form-label">Host</label>
          <input
            v-model="settings.host"
            type="text"
            class="form-input"
            placeholder="localhost or host.docker.internal"
            required
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">Port</label>
          <input
            v-model.number="settings.port"
            type="number"
            class="form-input"
            placeholder="11434"
            required
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">Model</label>
          <div style="display: flex; gap: 0.5rem;">
            <select v-model="settings.model" class="form-input" required>
              <option v-for="model in models" :key="model.name" :value="model.name">
                {{ model.name }}
              </option>
            </select>
            <button type="button" @click="refreshModels" class="btn btn-secondary" :disabled="refreshing">
              {{ refreshing ? '↻' : '🔄' }}
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Temperature ({{ settings.temperature }})</label>
          <input
            v-model.number="settings.temperature"
            type="range"
            min="0"
            max="1"
            step="0.1"
            class="form-input"
            style="cursor: pointer;"
          />
          <small style="color: #94a3b8; font-size: 0.75rem;">Lower = more consistent, Higher = more creative</small>
        </div>
        
        <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
          <button type="button" @click="testConnection" class="btn btn-secondary" :disabled="testing">
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
  name: 'OllamaSettings',
  data() {
    return {
      settings: {
        host: 'localhost',
        port: 11434,
        model: 'qwen3:14b',
        temperature: 0.30
      },
      models: [],
      connectionStatus: null,
      testing: false,
      saving: false,
      refreshing: false
    }
  },
  async mounted() {
    await this.loadSettings()
    await this.refreshModels()
  },
  methods: {
    async loadSettings() {
      try {
        const response = await api.getOllamaSettings()
        if (response.data) {
          this.settings = {
            host: response.data.host || 'localhost',
            port: response.data.port || 11434,
            model: response.data.model || 'qwen3:14b',
            temperature: response.data.temperature || 0.30
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    },
    async refreshModels() {
      this.refreshing = true
      try {
        const response = await api.getOllamaModels()
        this.models = response.data.models || []
        
        // Add default model if not in list
        if (this.models.length === 0) {
          this.models.push({ name: 'qwen3:14b' })
        }
      } catch (error) {
        console.error('Failed to load models:', error)
        // Add default model
        this.models = [{ name: 'qwen3:14b' }]
      } finally {
        this.refreshing = false
      }
    },
    async testConnection() {
      this.testing = true
      this.connectionStatus = null
      
      try {
        const response = await api.testOllamaConnection(this.settings.host, this.settings.port)
        if (response.data.success) {
          this.connectionStatus = {
            type: 'success',
            message: `✓ Connected! Version: ${response.data.version}`
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
        await api.saveOllamaSettings(this.settings)
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
.ollama-settings {
  width: 100%;
}

.status-indicator {
  margin-bottom: 1rem;
}
</style>
