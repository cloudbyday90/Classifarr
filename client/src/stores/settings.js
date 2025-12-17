import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref({})
  const loading = ref(false)
  const error = ref(null)

  async function fetchSettings() {
    loading.value = true
    error.value = null
    try {
      const response = await api.getSettings()
      settings.value = response.data
    } catch (err) {
      error.value = err.message
      console.error('Failed to fetch settings:', err)
    } finally {
      loading.value = false
    }
  }

  async function updateSettings(newSettings) {
    loading.value = true
    error.value = null
    try {
      await api.updateSettings(newSettings)
      settings.value = { ...settings.value, ...newSettings }
    } catch (err) {
      error.value = err.message
      console.error('Failed to update settings:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    settings,
    loading,
    error,
    fetchSettings,
    updateSettings,
  }
})
