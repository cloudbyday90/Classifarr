/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { ref } from 'vue'
import { getPolicyScopedEvidenceDigest } from '@/api/policiesApi'

function toPositiveInteger(value) {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null
}

function getErrorMessage(error) {
  if (error?.response?.status === 404) return 'The selected policy is no longer available.'
  return 'Unable to load the selected policy evidence digest.'
}

export function usePolicyScopedEvidenceDigest() {
  const digest = ref(null)
  const isLoading = ref(false)
  const errorMessage = ref('')

  async function loadDigest(policyId) {
    const normalizedPolicyId = toPositiveInteger(policyId)
    digest.value = null
    errorMessage.value = ''

    if (!normalizedPolicyId) return null

    isLoading.value = true
    try {
      digest.value = await getPolicyScopedEvidenceDigest(normalizedPolicyId)
      return digest.value
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      return null
    } finally {
      isLoading.value = false
    }
  }

  return {
    digest,
    isLoading,
    errorMessage,
    loadDigest,
  }
}
