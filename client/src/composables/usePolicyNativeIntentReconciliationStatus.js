/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { ref } from 'vue'
import api from '@/api'

function getErrorMessage(error) {
  const responseMessage = error?.response?.data?.message
  const responseError = error?.response?.data?.error

  if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage
  if (typeof responseError === 'string' && responseError.trim()) return responseError
  return 'Unable to load native intent reconciliation status.'
}

export function usePolicyNativeIntentReconciliationStatus() {
  const status = ref(null)
  const isLoading = ref(false)
  const errorMessage = ref('')

  async function loadStatus() {
    isLoading.value = true
    errorMessage.value = ''

    try {
      status.value = await api.getNativeIntentReconciliationStatus()
      return status.value
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      return null
    } finally {
      isLoading.value = false
    }
  }

  return {
    status,
    isLoading,
    errorMessage,
    loadStatus,
  }
}
