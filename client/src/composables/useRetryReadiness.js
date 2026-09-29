/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { computed, ref } from 'vue'
import { useNow } from '@vueuse/core'
import api from '@/api'
import { useSWR } from './useSWR'
import { parseRetryReadiness } from '@/utils/retryReadiness'

export function useRetryReadiness() {
  const paused = ref(false)
  const lastReport = ref(null)
  const denied = ref(false)
  const nextCheckAt = ref(null)
  const now = useNow({ interval: 15_000 })
  const swr = useSWR('command-center:retry-readiness', async () => {
    if (denied.value || paused.value || document.visibilityState !== 'visible') return lastReport.value
    nextCheckAt.value = new Date(Date.now() + 60_000).toISOString()
    try {
      const report = parseRetryReadiness(await api.getRetryReadiness())
      if (!report) throw new TypeError('Invalid retry readiness response')
      if (!paused.value) lastReport.value = report
      return lastReport.value
    } catch (error) {
      if ([401, 403].includes(error?.response?.status)) {
        denied.value = true
        lastReport.value = null
      }
      // Keep transport details and response bodies out of the generic SWR logger.
      // eslint-disable-next-line preserve-caught-error -- Transport errors may contain private response bodies or credentials.
      throw new Error('Retry readiness is unavailable')
    }
  }, { persist: false, autoRetry: false, pollOnlyWhenVisible: true,
    ttl: 60_000, pollInterval: () => paused.value || denied.value ? null : 60_000 })
  const forbidden = computed(() => denied.value)
  // Preserve only the last timestamp/counts for explicit unavailable presentation.
  // Authorization loss clears this snapshot; it is never persisted.
  const report = computed(() => forbidden.value ? null : lastReport.value)
  const unavailable = computed(() => Boolean(swr.error.value || swr.isOffline.value))
  const stale = computed(() => {
    if (!report.value) return false
    const age = now.value.getTime() - Date.parse(report.value.observedAt)
    return age > 120_000 || age < -5_000
  })
  function togglePaused() {
    paused.value = !paused.value
    if (!paused.value) void swr.refresh()
  }
  return { report, paused, unavailable, stale, forbidden, nextCheckAt,
    loading: swr.isLoading, togglePaused }
}
