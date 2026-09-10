/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { onBeforeUnmount, onMounted, ref } from 'vue'
import api from '@/api'
import {
  normalizeHeldOutSemanticStudyReadiness,
} from '@/utils/heldOutSemanticStudyReadiness'

export const SEMANTIC_EVALUATION_READINESS_REFRESH_MS = 5 * 60 * 1000

const LOAD_ERROR_MESSAGE = 'Classifarr could not refresh semantic evaluation readiness.'

function isForbidden(error) {
  return Number(error?.response?.status) === 403
}

function defaultLoadReadiness() {
  return typeof api.getHeldOutSemanticStudyReadiness === 'function'
    ? api.getHeldOutSemanticStudyReadiness()
    : Promise.reject(new TypeError('Semantic evaluation readiness is unavailable.'))
}

/**
 * Owns the Command Center's small, current-state semantic-evaluation read.
 * The server marks this aggregate no-store, so it must not use the shared
 * localStorage-backed Command Center cache. This composable only refreshes
 * status; it cannot create a cohort, labels, retrieval work, or routing.
 */
export function useCommandCenterSemanticEvaluationReadiness(options = {}) {
  const {
    refreshIntervalMs = SEMANTIC_EVALUATION_READINESS_REFRESH_MS,
    documentRef = typeof document === 'undefined' ? null : document,
  } = options
  const loadReadiness = Object.hasOwn(options, 'loadReadiness')
    ? options.loadReadiness
    : typeof api.getHeldOutSemanticStudyReadiness === 'function'
      ? defaultLoadReadiness
      : null
  const readiness = ref(null)
  const errorMessage = ref('')
  const isLoading = ref(false)
  const isAvailable = ref(typeof loadReadiness === 'function')
  let inFlight = null
  let intervalId = null

  function isDocumentVisible() {
    return !documentRef || documentRef.visibilityState === 'visible'
  }

  async function refresh() {
    if (inFlight || !isAvailable.value) return inFlight

    isLoading.value = readiness.value === null
    inFlight = Promise.resolve()
      .then(loadReadiness)
      .then((response) => {
        const parsedReadiness = normalizeHeldOutSemanticStudyReadiness(response)
        if (!parsedReadiness) throw new TypeError('Semantic evaluation readiness response is invalid.')

        readiness.value = parsedReadiness
        errorMessage.value = ''
        return parsedReadiness
      })
      .catch((error) => {
        if (isForbidden(error)) {
          readiness.value = null
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
    if (isDocumentVisible()) void refresh()
  }

  function startPolling() {
    if (!Number.isFinite(Number(refreshIntervalMs)) || Number(refreshIntervalMs) <= 0) return
    intervalId = setInterval(() => {
      if (isDocumentVisible()) void refresh()
    }, Number(refreshIntervalMs))
  }

  onMounted(() => {
    documentRef?.addEventListener('visibilitychange', handleVisibilityChange)
    startPolling()
    void refresh()
  })

  onBeforeUnmount(() => {
    if (intervalId !== null) clearInterval(intervalId)
    documentRef?.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return {
    readiness,
    errorMessage,
    isAvailable,
    isLoading,
    refresh,
  }
}
