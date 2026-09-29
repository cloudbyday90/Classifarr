/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { computed, ref, onUnmounted } from 'vue'
import { useNow } from '@vueuse/core'
import api from '@/api'
import { useSWR } from './useSWR'
import { parseRetryReadiness } from '@/utils/retryReadiness'

// Scope is fixed per mounted observer. The selector remounts to isolate late results.
export function useRetryReadiness(scope = 'web_search', initiallyPaused = false) {
  if (!['web_search', 'omdb'].includes(scope)) throw new TypeError('Unsupported retry scope')
  const paused = ref(initiallyPaused)
  let disposed = false
  onUnmounted(() => { disposed = true })
  const lastReport = ref(null)
  const denied = ref(false)
  const nextCheckAt = ref(null)
  const now = useNow({ interval: 15_000 })
  const cacheKey = scope === 'omdb' ? 'command-center:retry-readiness:omdb' : 'command-center:retry-readiness'
  const swr = useSWR(cacheKey, async () => {
    if (disposed || denied.value || paused.value || document.visibilityState !== 'visible') return lastReport.value
    nextCheckAt.value = new Date(Date.now() + 60_000).toISOString()
    try {
      const response = await (scope === 'omdb' ? api.getOmdbRetryReadiness() : api.getRetryReadiness())
      const report = parseRetryReadiness(response, scope)
      if (!report) throw new TypeError('Invalid retry readiness response')
      if (!disposed && !paused.value) lastReport.value = report
      return lastReport.value
    } catch (error) {
      if (!disposed && [401, 403].includes(error?.response?.status)) {
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
