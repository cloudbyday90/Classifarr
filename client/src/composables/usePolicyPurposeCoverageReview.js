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
  return 'Unable to load policy purpose coverage review.'
}

export function usePolicyPurposeCoverageReview() {
  const review = ref(null)
  const isLoading = ref(false)
  const errorMessage = ref('')

  async function loadReview() {
    isLoading.value = true
    errorMessage.value = ''

    try {
      review.value = await api.getPolicyPurposeCoverageReview()
      return review.value
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      return null
    } finally {
      isLoading.value = false
    }
  }

  return {
    review,
    isLoading,
    errorMessage,
    loadReview,
  }
}
