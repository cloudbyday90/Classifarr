import api from './index'

export async function getSettings() {
  return api.get('/api/settings')
}

export async function updateSettings(data) {
  return api.put('/api/settings', data)
}

export async function testRadarrConnection(config) {
  return api.post('/api/settings/radarr/test', config)
}

export async function testSonarrConnection(config) {
  return api.post('/api/settings/sonarr/test', config)
}

export async function testOllamaConnection(config) {
  return api.post('/api/settings/ollama/test', config)
}

export async function testDiscordWebhook(webhook) {
  return api.post('/api/settings/notifications/test', { webhook })
}
