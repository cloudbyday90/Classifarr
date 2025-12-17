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
