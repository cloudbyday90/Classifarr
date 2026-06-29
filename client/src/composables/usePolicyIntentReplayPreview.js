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

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
}

function uniqueStrings(values) {
  return Array.from(new Set((values || []).filter(value => typeof value === 'string' && value.trim())))
}

function withTmdbLivePreviewOptIn(payload) {
  const currentPreviewConfig = objectValue(payload.replay_enrichment_preview)
  const sources = uniqueStrings([
    ...(Array.isArray(currentPreviewConfig.sources) ? currentPreviewConfig.sources : []),
    ...(Array.isArray(payload.replay_enrichment_sources) ? payload.replay_enrichment_sources : []),
    'tmdb_metadata',
  ])

  return {
    ...payload,
    replay_enrichment_preview: {
      ...currentPreviewConfig,
      enabled: true,
      sources,
      tmdb_metadata: {
        ...objectValue(currentPreviewConfig.tmdb_metadata),
        enabled: true,
      },
    },
  }
}

export function buildPolicyIntentReplayPreviewPayload(payload, replayLimit = DEFAULT_REPLAY_LIMIT, options = {}) {
  const replayPayload = {
    ...(payload || {}),
    replay_limit: normalizeReplayLimit(replayLimit),
  }

  if (options?.tmdbLivePreviewOptIn === true) {
    return withTmdbLivePreviewOptIn(replayPayload)
  }

  return replayPayload
}

export function usePolicyIntentReplayPreview({
  previewPolicyIntentReplay,
  buildPayload,
  payloadSource = null,
  replayLimit = DEFAULT_REPLAY_LIMIT,
  tmdbLivePreviewOptIn = false,
} = {}) {
  const preview = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const previewedPayloadFingerprint = ref(null)

  const currentPayload = computed(() => {
    const payload = payloadSource ? unref(payloadSource) : (typeof buildPayload === 'function' ? buildPayload() : null)
    return buildPolicyIntentReplayPreviewPayload(payload, unref(replayLimit), {
      tmdbLivePreviewOptIn: unref(tmdbLivePreviewOptIn) === true,
    })
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
      const payload = buildPolicyIntentReplayPreviewPayload(buildPayload(), unref(replayLimit), {
        tmdbLivePreviewOptIn: unref(tmdbLivePreviewOptIn) === true,
      })
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
