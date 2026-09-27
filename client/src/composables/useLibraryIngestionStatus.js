/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { computed, watch } from 'vue'
import { useSWR } from './useSWR'
import { getLibrary } from '@/api/libraryCatalogApi'
import { ingestionPollInterval, libraryIngestionState } from '@/utils/libraryIngestionStatus'

/** Read-only, non-persistent status polling; never overwrites unsaved settings. */
export function useLibraryIngestionStatus(library, requesting) {
  const pollInterval = computed(() => ingestionPollInterval(library.value, requesting.value))
  const resource = useSWR('library-ingestion-status', async () => {
    const id = library.value?.id
    return id ? { id, library: await getLibrary(id) } : null
  }, { persist: false, pollInterval })

  watch(resource.data, result => {
    if (!result || result.id !== library.value?.id) return
    Object.assign(library.value, { sync_status: result.library.sync_status,
      ingestion_status: result.library.ingestion_status, item_count: result.library.item_count })
    requesting.value = false
  })
  watch(() => library.value?.id, () => resource.refresh())
  return {
    refresh: resource.refresh,
    unavailable: computed(() => Boolean(resource.error.value) || resource.isOffline.value),
    isSyncing: computed(() => libraryIngestionState(library.value, requesting.value) !== 'complete'),
  }
}
