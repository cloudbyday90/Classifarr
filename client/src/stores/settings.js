/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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
