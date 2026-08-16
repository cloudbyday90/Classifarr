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
    || 'Classifarr could not check proposed purpose coverage. Try again.'
}

export function usePolicyPurposeCoveragePreflight() {
  const preflight = ref(null)
  const isLoading = ref(false)
  const errorMessage = ref('')

  const reset = () => {
    preflight.value = null
    errorMessage.value = ''
  }

  const runPreflight = async ({ policyId, draft } = {}) => {
    if (isLoading.value) return null

    reset()
    isLoading.value = true
    try {
      preflight.value = unwrapResponse(await api.preflightPolicyPurposeCoverage(policyId, draft))
      return preflight.value
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      return null
    } finally {
      isLoading.value = false
    }
  }

  return {
    preflight,
    isLoading,
    errorMessage,
    reset,
    runPreflight,
  }
}
