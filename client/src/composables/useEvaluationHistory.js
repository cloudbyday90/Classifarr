/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { computed, ref, watch } from 'vue'
import api from '@/api'
import { useSWR } from '@/composables/useSWR'
import { normalizeEvaluationHistory } from '@/utils/evaluationHistorySummary'

export function useEvaluationHistory() {
  const available = ref(typeof api.getEvaluationHistory === 'function')
  const paused = ref(false), snapshot = ref(null)
  const { data, error, isLoading } = useSWR('evaluation-history', async () => {
    if (!available.value) return null
    try {
      const result = normalizeEvaluationHistory(await api.getEvaluationHistory())
      if (!result) throw new Error('Invalid evaluation history response')
      return result
    } catch (failure) {
      if ([401, 403].includes(failure?.response?.status)) { available.value = false; return null }
      // Do not log provider/transport response bodies through the generic SWR error handler.
      // eslint-disable-next-line preserve-caught-error -- HTTP errors may contain private response bodies or credentials.
      throw new Error('Evaluation history is unavailable')
    }
  }, { persist: false, pollInterval: () => available.value ? 300_000 : null })
  watch(data, value => { if (!value || !paused.value) snapshot.value = value }, { immediate: true })
  function togglePause() {
    paused.value = !paused.value
    if (!paused.value) snapshot.value = data.value
  }
  return { available, paused, snapshot, isLoading, togglePause,
    errorMessage: computed(() => error.value ? 'Evaluation history is unavailable. It will retry automatically.' : '') }
}
