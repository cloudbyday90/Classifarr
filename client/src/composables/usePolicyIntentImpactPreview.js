/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { computed, ref } from 'vue'
import {
  buildPolicyIntentImpactPreviewNotice,
  normalizePolicyIntentImpactPreview,
  summarizePolicyIntentImpactChangedBuckets,
} from '@/utils/policyIntentImpactPreview'

function responsePayload(response) {
  return response?.data ?? response
}

function errorMessage(error) {
  return error?.response?.data?.error || error?.message || 'Failed to preview policy impact.'
}

export function usePolicyIntentImpactPreview({
  previewPolicyIntentImpact,
  buildPayload,
} = {}) {
  const preview = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const notice = computed(() => buildPolicyIntentImpactPreviewNotice(preview.value))
  const changedBuckets = computed(() => summarizePolicyIntentImpactChangedBuckets(preview.value))
  const hasPreview = computed(() => preview.value !== null)

  const resetPreview = () => {
    preview.value = null
    error.value = null
  }

  const runPreview = async () => {
    if (typeof previewPolicyIntentImpact !== 'function' || typeof buildPayload !== 'function') {
      error.value = 'Policy impact preview is not available.'
      return null
    }

    loading.value = true
    error.value = null

    try {
      const response = await previewPolicyIntentImpact(buildPayload())
      preview.value = normalizePolicyIntentImpactPreview(responsePayload(response))
      return preview.value
    } catch (caughtError) {
      error.value = errorMessage(caughtError)
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    preview,
    notice,
    changedBuckets,
    hasPreview,
    loading,
    error,
    resetPreview,
    runPreview,
  }
}
