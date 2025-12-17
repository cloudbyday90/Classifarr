import api from './index'

export async function getConfig() {
  return api.get('/api/media-server/config')
}

export async function saveConfig(config) {
  return api.post('/api/media-server/config', config)
}

export async function testConnection(config) {
  return api.post('/api/media-server/test', config)
}
