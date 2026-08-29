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
    || 'Classifarr could not simulate the proposed policy. Try again.'
}

export function usePolicyCohortSimulation() {
  const simulation = ref(null)
  const isLoading = ref(false)
  const errorMessage = ref('')

  const reset = () => {
    simulation.value = null
    errorMessage.value = ''
  }

  const runSimulation = async ({ policyId, draft } = {}) => {
    if (isLoading.value) return null

    reset()
    isLoading.value = true
    try {
      simulation.value = unwrapResponse(await api.simulatePolicyCohort(policyId, draft))
      return simulation.value
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      return null
    } finally {
      isLoading.value = false
    }
  }

  return {
    simulation,
    isLoading,
    errorMessage,
    reset,
    runSimulation,
  }
}
