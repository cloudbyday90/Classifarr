/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import api from '@/api'
import { parseLibraryProfileRefreshStatus } from '@/utils/libraryProfileRefreshStatus'

export const PROFILE_REFRESH_STATUS_INTERVAL_MS = 60_000
const LOAD_ERROR_MESSAGE = 'Library profile refresh status is unavailable. Try again later.'

/** No-store operational state: poll only while visible, never persist or trigger work. */
export function useCommandCenterProfileRefreshStatus({
  loadStatus = typeof api.getLibraryProfileRefreshStatus === 'function'
    ? () => api.getLibraryProfileRefreshStatus()
    : null,
  refreshIntervalMs = PROFILE_REFRESH_STATUS_INTERVAL_MS,
  documentRef = typeof document === 'undefined' ? null : document,
} = {}) {
  const status = ref(null)
  const errorMessage = ref('')
  const isLoading = ref(false)
  const isAvailable = ref(typeof loadStatus === 'function')
  let inFlight = null
  let intervalId = null

  function isVisible() {
    return !documentRef || documentRef.visibilityState === 'visible'
  }

  async function refresh() {
    if (!isAvailable.value || inFlight) return inFlight
    isLoading.value = status.value === null
    inFlight = Promise.resolve().then(loadStatus).then((response) => {
      const parsed = parseLibraryProfileRefreshStatus(response)
      if (!parsed) throw new TypeError('Invalid library profile refresh status')
      status.value = parsed
      errorMessage.value = ''
      return parsed
    }).catch((error) => {
      status.value = null
      if (Number(error?.response?.status) === 403) {
        isAvailable.value = false
        errorMessage.value = ''
      } else {
        errorMessage.value = LOAD_ERROR_MESSAGE
      }
      return null
    }).finally(() => {
      inFlight = null
      isLoading.value = false
    })
    return inFlight
  }

  function handleVisibilityChange() {
    if (isVisible()) void refresh()
  }

  onMounted(() => {
    documentRef?.addEventListener('visibilitychange', handleVisibilityChange)
    if (Number.isFinite(Number(refreshIntervalMs)) && Number(refreshIntervalMs) > 0) {
      intervalId = setInterval(() => { if (isVisible()) void refresh() }, Number(refreshIntervalMs))
    }
    if (isVisible()) void refresh()
  })

  onBeforeUnmount(() => {
    if (intervalId !== null) clearInterval(intervalId)
    documentRef?.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return { status, errorMessage, isLoading, isAvailable, refresh }
}
