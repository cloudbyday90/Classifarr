import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as librariesApi from '@/api/libraries'

export const useLibrariesStore = defineStore('libraries', () => {
  const libraries = ref([])
  const currentLibrary = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function fetchLibraries() {
    loading.value = true
    error.value = null
    try {
      const data = await librariesApi.getLibraries()
      libraries.value = data
      return data
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchLibrary(id) {
    loading.value = true
    error.value = null
    try {
      const data = await librariesApi.getLibrary(id)
      currentLibrary.value = data
      return data
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateLibrary(id, updates) {
    loading.value = true
    error.value = null
    try {
      const data = await librariesApi.updateLibrary(id, updates)
      currentLibrary.value = data
      // Update in list too
      const index = libraries.value.findIndex(lib => lib.id === id)
      if (index !== -1) {
        libraries.value[index] = data
      }
      return data
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    libraries,
    currentLibrary,
    loading,
    error,
    fetchLibraries,
    fetchLibrary,
    updateLibrary,
  }
})
