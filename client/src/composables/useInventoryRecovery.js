/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { computed, ref, watch } from 'vue'
import { getInventoryRecovery, getInventoryRecoveryProgress } from '@/api/inventoryRecoveryApi'
import { useSWR } from '@/composables/useSWR'
import { parseInventoryRecovery } from '@/utils/inventoryRecovery'
import { parseInventoryRecoveryProgress } from '@/utils/inventoryRecoveryProgress'

export function useInventoryRecovery() {
  const afterId = ref(0), previousPages = ref([]), paused = ref(false), frozen = ref(null), busy = ref(false)
  let pauseRevision = 0
  const state = useSWR('inventory-recovery', async () => {
    const requested = afterId.value
    const [cases, progress] = await Promise.all([getInventoryRecovery(requested), getInventoryRecoveryProgress()])
    return { ...parseInventoryRecovery(cases, requested), progress: parseInventoryRecoveryProgress(progress) }
  }, { persist: false, autoRetry: false, pollInterval: () => paused.value ? null : 30000 })
  const report = computed(() => {
    if (state.error.value || state.isOffline.value) return null
    const value = paused.value ? frozen.value : state.data.value
    return value?.afterId === afterId.value ? value : null
  })
  async function refresh() {
    const revision = pauseRevision, refreshFrozen = paused.value
    busy.value = true
    try {
      await state.refresh()
      if (refreshFrozen && paused.value && revision === pauseRevision) frozen.value = state.data.value
    }
    finally { busy.value = false }
  }
  function togglePause() {
    pauseRevision++
    if (!paused.value) frozen.value = report.value
    paused.value = !paused.value
    if (!paused.value) void refresh()
  }
  function nextPage() {
    if (!report.value?.nextCursor) return
    previousPages.value.push(afterId.value)
    afterId.value = report.value.nextCursor
  }
  function previousPage() { afterId.value = previousPages.value.pop() ?? 0 }
  watch(afterId, () => { void refresh() })
  return { report, afterId, previousPages, paused, busy, error: state.error,
    refresh, togglePause, nextPage, previousPage }
}
