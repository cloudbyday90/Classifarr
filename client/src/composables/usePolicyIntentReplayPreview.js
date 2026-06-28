/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { computed, ref, unref } from 'vue'
import { fingerprintPolicyIntentPreviewPayload } from '@/composables/usePolicyIntentImpactPreview'
import {
  buildPolicyIntentReplayPreviewNotice,
  normalizePolicyIntentReplayPreview,
  summarizePolicyIntentReplaySamples,
} from '@/utils/policyIntentReplayPreview'

const DEFAULT_REPLAY_LIMIT = 5

function responsePayload(response) {
  return response?.data ?? response
}

function errorMessage(error) {
  return error?.response?.data?.error || error?.message || 'Failed to preview representative replay samples.'
}

function normalizeReplayLimit(value) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed)) {
    return DEFAULT_REPLAY_LIMIT
  }

  return Math.min(25, Math.max(1, parsed))
}

export function buildPolicyIntentReplayPreviewPayload(payload, replayLimit = DEFAULT_REPLAY_LIMIT) {
  return {
    ...(payload || {}),
    replay_limit: normalizeReplayLimit(replayLimit),
  }
}

export function usePolicyIntentReplayPreview({
  previewPolicyIntentReplay,
  buildPayload,
  payloadSource = null,
  replayLimit = DEFAULT_REPLAY_LIMIT,
} = {}) {
  const preview = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const previewedPayloadFingerprint = ref(null)

  const currentPayload = computed(() => {
    const payload = payloadSource ? unref(payloadSource) : (typeof buildPayload === 'function' ? buildPayload() : null)
    return buildPolicyIntentReplayPreviewPayload(payload, unref(replayLimit))
  })

  const currentPayloadFingerprint = computed(() => fingerprintPolicyIntentPreviewPayload(currentPayload.value))
  const notice = computed(() => buildPolicyIntentReplayPreviewNotice(preview.value))
  const samples = computed(() => summarizePolicyIntentReplaySamples(preview.value))
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
    if (typeof previewPolicyIntentReplay !== 'function' || typeof buildPayload !== 'function') {
      error.value = 'Representative replay preview is not available.'
      return null
    }

    loading.value = true
    error.value = null

    try {
      const payload = buildPolicyIntentReplayPreviewPayload(buildPayload(), unref(replayLimit))
      const payloadFingerprint = fingerprintPolicyIntentPreviewPayload(payload)
      const response = await previewPolicyIntentReplay(payload)
      preview.value = normalizePolicyIntentReplayPreview(responsePayload(response))
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
    samples,
    hasPreview,
    isStale,
    loading,
    error,
    resetPreview,
    runPreview,
  }
}
