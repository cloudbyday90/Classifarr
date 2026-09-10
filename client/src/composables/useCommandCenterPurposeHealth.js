/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { onBeforeUnmount, onMounted, ref } from 'vue'
import api from '@/api'
import { parsePolicyPurposeHealth } from '@/utils/policyPurposeHealth'

export const PURPOSE_HEALTH_REFRESH_MS = 60_000
const LOAD_ERROR_MESSAGE = 'Classifarr could not refresh library purpose health.'

function isForbidden(error) {
  return Number(error?.response?.status) === 403
}

/**
 * Maintains the Command Center's small, non-persistent policy-purpose status.
 * Purpose-health stays out of useSWR because its no-store API response must
 * never be copied to localStorage or shared between browser tabs.
 */
export function useCommandCenterPurposeHealth({
  loadPurposeHealth = () => api.getPolicyPurposeHealth(),
  refreshIntervalMs = PURPOSE_HEALTH_REFRESH_MS,
  documentRef = typeof document === 'undefined' ? null : document,
} = {}) {
  const health = ref(null)
  const errorMessage = ref('')
  const isLoading = ref(false)
  const isAvailable = ref(true)
  const lastUpdatedAt = ref(null)
  let inFlight = null
  let intervalId = null

  function isDocumentVisible() {
    return !documentRef || documentRef.visibilityState === 'visible'
  }

  async function refresh() {
    if (inFlight || !isAvailable.value) return inFlight

    isLoading.value = health.value === null
    inFlight = Promise.resolve()
      .then(loadPurposeHealth)
      .then((response) => {
        const parsedHealth = parsePolicyPurposeHealth(response)
        if (!parsedHealth) throw new TypeError('Policy purpose health response is invalid.')

        health.value = parsedHealth
        errorMessage.value = ''
        lastUpdatedAt.value = Date.now()
        return parsedHealth
      })
      .catch((error) => {
        if (isForbidden(error)) {
          health.value = null
          errorMessage.value = ''
          isAvailable.value = false
          return null
        }

        errorMessage.value = LOAD_ERROR_MESSAGE
        return null
      })
      .finally(() => {
        isLoading.value = false
        inFlight = null
      })

    return inFlight
  }

  function handleVisibilityChange() {
    if (isDocumentVisible()) refresh()
  }

  function startPolling() {
    if (!Number.isFinite(Number(refreshIntervalMs)) || Number(refreshIntervalMs) <= 0) return
    intervalId = setInterval(() => {
      if (isDocumentVisible()) refresh()
    }, Number(refreshIntervalMs))
  }

  onMounted(() => {
    documentRef?.addEventListener('visibilitychange', handleVisibilityChange)
    startPolling()
    refresh()
  })

  onBeforeUnmount(() => {
    if (intervalId !== null) clearInterval(intervalId)
    documentRef?.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return {
    health,
    errorMessage,
    isAvailable,
    isLoading,
    lastUpdatedAt,
    refresh,
  }
}
