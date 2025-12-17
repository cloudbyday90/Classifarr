import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

export default {
  // TMDB Settings
  getTMDBSettings() {
    return api.get('/settings/tmdb')
  },
  saveTMDBSettings(data) {
    return api.post('/settings/tmdb', data)
  },
  testTMDBConnection(apiKey) {
    return api.post('/settings/tmdb/test', { api_key: apiKey })
  },

  // Ollama Settings
  getOllamaSettings() {
    return api.get('/settings/ollama')
  },
  saveOllamaSettings(data) {
    return api.post('/settings/ollama', data)
  },
  testOllamaConnection(host, port) {
    return api.post('/settings/ollama/test', { host, port })
  },
  getOllamaModels() {
    return api.get('/settings/ollama/models')
  },

  // Discord Settings
  getDiscordSettings() {
    return api.get('/settings/discord')
  },
  saveDiscordSettings(data) {
    return api.post('/settings/discord', data)
  },
  testDiscordConnection(botToken) {
    return api.post('/settings/discord/test', { bot_token: botToken })
  },
  sendDiscordTestMessage() {
    return api.post('/settings/discord/test-message')
  },
  getDiscordServers() {
    return api.get('/settings/discord/servers')
  },
  getDiscordChannels(serverId) {
    return api.get(`/settings/discord/channels/${serverId}`)
  },

  // Webhook Settings
  getWebhookSettings() {
    return api.get('/settings/webhook')
  },
  saveWebhookSettings(data) {
    return api.post('/settings/webhook', data)
  },
  getWebhookLogs() {
    return api.get('/settings/webhook/logs')
  },
  clearWebhookLogs() {
    return api.delete('/settings/webhook/logs')
  },
  generateWebhookKey() {
    return api.post('/settings/webhook/generate-key')
  },

  // Setup Status
  getSetupStatus() {
    return api.get('/settings/setup-status')
  }
}
