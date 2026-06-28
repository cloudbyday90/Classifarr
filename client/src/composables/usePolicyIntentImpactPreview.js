/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { computed, ref, unref } from 'vue'
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

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject)
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.keys(value)
    .sort()
    .reduce((sorted, key) => ({
      ...sorted,
      [key]: sortObject(value[key]),
    }), {})
}

export function fingerprintPolicyIntentPreviewPayload(payload) {
  try {
    return JSON.stringify(sortObject(payload || {}))
  } catch {
    return null
  }
}

export function usePolicyIntentImpactPreview({
  previewPolicyIntentImpact,
  buildPayload,
  payloadSource = null,
} = {}) {
  const preview = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const previewedPayloadFingerprint = ref(null)

  const currentPayloadFingerprint = computed(() => {
    if (payloadSource) {
      return fingerprintPolicyIntentPreviewPayload(unref(payloadSource))
    }

    if (typeof buildPayload === 'function') {
      return fingerprintPolicyIntentPreviewPayload(buildPayload())
    }

    return null
  })

  const notice = computed(() => buildPolicyIntentImpactPreviewNotice(preview.value))
  const changedBuckets = computed(() => summarizePolicyIntentImpactChangedBuckets(preview.value))
  const hasPreview = computed(() => preview.value !== null)
  const isStale = computed(() => (
    hasPreview.value &&
    previewedPayloadFingerprint.value !== null &&
    currentPayloadFingerprint.value !== null &&
    previewedPayloadFingerprint.value !== currentPayloadFingerprint.value
  ))

  const resetPreview = () => {
    preview.value = null
    error.value = null
    previewedPayloadFingerprint.value = null
  }

  const runPreview = async () => {
    if (typeof previewPolicyIntentImpact !== 'function' || typeof buildPayload !== 'function') {
      error.value = 'Policy impact preview is not available.'
      return null
    }

    loading.value = true
    error.value = null

    try {
      const payload = buildPayload()
      const payloadFingerprint = fingerprintPolicyIntentPreviewPayload(payload)
      const response = await previewPolicyIntentImpact(payload)
      preview.value = normalizePolicyIntentImpactPreview(responsePayload(response))
      previewedPayloadFingerprint.value = payloadFingerprint
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
    isStale,
    loading,
    error,
    resetPreview,
    runPreview,
  }
}
