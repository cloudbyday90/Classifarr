import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as classificationApi from '@/api/classification'

export const useClassificationStore = defineStore('classification', () => {
  const history = ref([])
  const stats = ref({
    total: 0,
    successRate: 0,
    correctionsNeeded: 0,
  })
  const loading = ref(false)
  const error = ref(null)

  async function fetchHistory(filters = {}) {
    loading.value = true
    error.value = null
    try {
      const data = await classificationApi.getHistory(filters)
      history.value = data
      return data
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchStats() {
    loading.value = true
    error.value = null
    try {
      const data = await classificationApi.getStats()
      stats.value = data
      return data
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function correctClassification(id, corrections) {
    loading.value = true
    error.value = null
    try {
      const result = await classificationApi.correctClassification(id, corrections)
      // Update in history
      const index = history.value.findIndex(item => item.id === id)
      if (index !== -1) {
        history.value[index] = { ...history.value[index], ...corrections, corrected: true }
      }
      return result
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    history,
    stats,
    loading,
    error,
    fetchHistory,
    fetchStats,
    correctClassification,
  }
})
