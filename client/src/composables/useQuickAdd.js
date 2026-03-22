/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { ref } from 'vue'
import api from '@/api'
import { normalizeTmdbResults, validateQuickAddQuery } from '@/utils/quickAdd'

export function useQuickAdd({ refreshData }) {
  const quickAddQuery = ref('')
  const quickAddSearching = ref(false)
  const quickAddResults = ref([])
  const quickAddSelected = ref(null)
  const quickAddSubmitting = ref(false)
  const quickAddError = ref('')
  const quickAddSuccess = ref('')

  function updateQuickAddQuery(value) {
    const nextQuery = String(value || '')
    if (nextQuery !== quickAddQuery.value) {
      quickAddQuery.value = nextQuery
      quickAddResults.value = []
      quickAddSelected.value = null
      clearQuickAddFeedback()
      return
    }

    quickAddQuery.value = nextQuery
  }

  function clearQuickAddFeedback() {
    quickAddError.value = ''
    quickAddSuccess.value = ''
  }

  function selectQuickAddResult(result) {
    quickAddSelected.value = result
    clearQuickAddFeedback()
  }

  async function searchQuickAdd() {
    const { query, error } = validateQuickAddQuery(quickAddQuery.value)
    clearQuickAddFeedback()
    quickAddResults.value = []
    quickAddSelected.value = null

    if (error) {
      quickAddError.value = error
      return
    }

    quickAddSearching.value = true
    try {
      const response = await api.searchTMDB(query, 'multi')
      const normalized = normalizeTmdbResults(response?.data)
      quickAddResults.value = normalized
      if (!normalized.length) quickAddError.value = 'No TMDB results found for that query.'
    } catch (error) {
      quickAddError.value = error?.response?.data?.error || error?.message || 'TMDB search failed.'
    } finally {
      quickAddSearching.value = false
    }
  }

  async function submitQuickAdd() {
    if (!quickAddSelected.value) return

    quickAddSubmitting.value = true
    clearQuickAddFeedback()
    try {
      await api.submitManualRequest({
        tmdbId: quickAddSelected.value.id,
        mediaType: quickAddSelected.value.media_type,
        title: quickAddSelected.value.title,
      })
      quickAddSuccess.value = `"${quickAddSelected.value.title}" was added to the queue.`
      quickAddQuery.value = ''
      quickAddResults.value = []
      quickAddSelected.value = null
      if (refreshData) await refreshData()
    } catch (error) {
      quickAddError.value = error?.response?.data?.error || error?.message || 'Failed to add request.'
    } finally {
      quickAddSubmitting.value = false
    }
  }

  return {
    quickAddError,
    quickAddQuery,
    quickAddResults,
    quickAddSearching,
    quickAddSelected,
    quickAddSubmitting,
    quickAddSuccess,
    searchQuickAdd,
    selectQuickAddResult,
    submitQuickAdd,
    updateQuickAddQuery,
  }
}
