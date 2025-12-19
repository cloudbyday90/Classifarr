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

export const useLibrariesStore = defineStore('libraries', () => {
  const libraries = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function fetchLibraries() {
    loading.value = true
    error.value = null
    try {
      const response = await api.getLibraries()
      libraries.value = response.data
    } catch (err) {
      error.value = err.message
      console.error('Failed to fetch libraries:', err)
    } finally {
      loading.value = false
    }
  }

  return {
    libraries,
    loading,
    error,
    fetchLibraries,
  }
})
