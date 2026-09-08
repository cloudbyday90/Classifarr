/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { ref } from 'vue'
import api from '@/api'

function getErrorMessage(error) {
  const responseMessage = error?.response?.data?.message
  const responseError = error?.response?.data?.error

  if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage
  if (typeof responseError === 'string' && responseError.trim()) return responseError
  return 'Unable to load held-out semantic study readiness.'
}

export function useHeldOutSemanticStudyReadiness() {
  const readiness = ref(null)
  const isLoading = ref(false)
  const errorMessage = ref('')

  async function loadReadiness() {
    isLoading.value = true
    errorMessage.value = ''

    try {
      readiness.value = await api.getHeldOutSemanticStudyReadiness()
      return readiness.value
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      return null
    } finally {
      isLoading.value = false
    }
  }

  return {
    readiness,
    isLoading,
    errorMessage,
    loadReadiness,
  }
}
