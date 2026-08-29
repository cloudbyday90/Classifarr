/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { ref } from 'vue'
import api from '@/api'

function unwrapResponse(response) {
  return response?.data ?? response ?? null
}

function getErrorMessage(error) {
  return error?.response?.data?.message
    || error?.message
    || 'Classifarr could not preview destination competition. Try again.'
}

export function usePolicyDestinationCompetitionPreview() {
  const preview = ref(null)
  const isLoading = ref(false)
  const errorMessage = ref('')

  const reset = () => {
    preview.value = null
    errorMessage.value = ''
  }

  const runPreview = async ({ policyId, draft } = {}) => {
    if (isLoading.value) return null

    reset()
    isLoading.value = true
    try {
      preview.value = unwrapResponse(await api.previewPolicyDestinationCompetition(policyId, draft))
      return preview.value
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      return null
    } finally {
      isLoading.value = false
    }
  }

  return {
    preview,
    isLoading,
    errorMessage,
    reset,
    runPreview,
  }
}
