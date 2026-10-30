/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { computed, ref, watch, unref, toRaw, onMounted, onUnmounted } from 'vue'
import api from '@/api'
import { useSWR } from './useSWR'
import { normalizePurposeEvaluation } from '@/utils/purposeEvaluation'

export function usePurposeEvaluation({ paused, enabled, steadyNow = () => performance.now() }) {
  const available = ref(typeof api.getPurposeEvaluation === 'function'), snapshot = ref(null), tick = ref(0)
  const requestedAt = new WeakMap()
  let receivedAt = 0, timer
  const { data, error, isLoading } = useSWR('purpose-evaluation', async () => {
    if (!available.value || !unref(enabled)) return null
    const started = steadyNow()
    try {
      const value = normalizePurposeEvaluation(await api.getPurposeEvaluation())
      if (!available.value || !unref(enabled)) return null
      if (!value) throw new Error('Invalid destination review summary')
      requestedAt.set(value, started)
      return value
    } catch (failure) {
      if ([401, 403].includes(failure?.response?.status)) { available.value = false; return null }
      // eslint-disable-next-line preserve-caught-error -- Transport errors may carry private response bodies.
      throw new Error('Destination review summary is unavailable')
    }
  }, { persist: false, pollInterval: () => available.value && unref(enabled) ? 300000 : null })
  const assign = value => { snapshot.value = value; receivedAt = value ? requestedAt.get(toRaw(value)) ?? steadyNow() : steadyNow(); tick.value++ }
  watch(data, value => {
    if (!available.value || !unref(enabled)) assign(null)
    else if (!value || value.status !== 'complete' || !unref(paused)) assign(value)
  }, { immediate: true })
  watch(() => unref(paused), value => { if (!value) assign(data.value) })
  watch(() => unref(enabled), value => { if (!value) { available.value = false; data.value = null; assign(null) } })
  onMounted(() => { timer = setInterval(() => { tick.value++ }, 30000) })
  onUnmounted(() => clearInterval(timer))
  const displayed = computed(() => {
    void tick.value
    const value = snapshot.value
    if (value?.status !== 'complete') return value
    const age = Date.parse(value.checkedAt) - Date.parse(value.observedAt) + Math.max(0, steadyNow() - receivedAt)
    return age >= 15 * 60000 ? { ...value, status: 'stale', report: null } : value
  })
  return { available, snapshot: displayed, isLoading,
    errorMessage: computed(() => error.value ? 'Destination review summary is unavailable. It will retry automatically.' : '') }
}
