/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { onScopeDispose, ref, watch } from 'vue'
import { getLibraryIngestionHistory } from '@/api/libraryIngestionApi'

/** Read only, on demand, and scoped to this visit; no browser-persisted authority. */
export function useIngestionRecoveryHistory(libraryId) {
  const opened = ref(false), loading = ref(false), history = ref(null), error = ref('')
  let generation = 0, disposed = false
  function clear() {
    generation++; history.value = null; error.value = ''; loading.value = false
  }
  watch(libraryId, () => { opened.value = false; clear() }, { flush: 'sync' })
  onScopeDispose(() => { disposed = true; clear() })
  async function refresh() {
    if (disposed || !opened.value || loading.value) return
    const context = ++generation
    history.value = null; error.value = ''; loading.value = true
    try {
      const result = await getLibraryIngestionHistory(libraryId.value)
      if (!disposed && context === generation) history.value = result
    } catch {
      if (!disposed && context === generation) {
        error.value = 'Recovery history is unavailable. Refresh when connected with an active administrator session.'
      }
    } finally {
      if (!disposed && context === generation) loading.value = false
    }
  }
  function setOpened(value) {
    if (disposed || value === opened.value) return
    opened.value = value
    if (value) return refresh()
    clear()
  }
  return { opened, loading, history, error, refresh, setOpened }
}
