import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as mediaServerApi from '@/api/mediaServer'

export const useMediaServerStore = defineStore('mediaServer', () => {
  const serverType = ref(null) // 'plex', 'emby', 'jellyfin'
  const serverUrl = ref('')
  const apiKey = ref('')
  const connected = ref(false)
  const loading = ref(false)
  const error = ref(null)

  async function testConnection() {
    loading.value = true
    error.value = null
    try {
      const result = await mediaServerApi.testConnection({
        type: serverType.value,
        url: serverUrl.value,
        apiKey: apiKey.value,
      })
      connected.value = result.success
      return result
    } catch (err) {
      error.value = err.message
      connected.value = false
      throw err
    } finally {
      loading.value = false
    }
  }

  async function saveConfig(config) {
    loading.value = true
    error.value = null
    try {
      const result = await mediaServerApi.saveConfig(config)
      serverType.value = config.type
      serverUrl.value = config.url
      apiKey.value = config.apiKey
      return result
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchConfig() {
    loading.value = true
    error.value = null
    try {
      const config = await mediaServerApi.getConfig()
      serverType.value = config.type
      serverUrl.value = config.url
      apiKey.value = config.apiKey
      connected.value = config.connected || false
      return config
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    serverType,
    serverUrl,
    apiKey,
    connected,
    loading,
    error,
    testConnection,
    saveConfig,
    fetchConfig,
  }
})
