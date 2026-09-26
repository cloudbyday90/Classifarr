/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { computed, ref, watch } from 'vue'
import { getLibrarySourceIdentityIssues } from '@/api/libraryCatalogApi'
import { useSWR } from '@/composables/useSWR'
import { parseSourceIdentityIssues } from '@/utils/sourceIdentityIssues'

export function useSourceIdentityIssues() {
  const offset = ref(0)
  const state = useSWR('command-center:source-identity-issues', async () => {
    const requestedOffset = offset.value
    const parsed = parseSourceIdentityIssues(await getLibrarySourceIdentityIssues(requestedOffset), requestedOffset)
    if (!parsed) throw new TypeError('Invalid source issue snapshot')
    return parsed
  }, { persist: false, pollInterval: null })
  // Never show a previous page beneath the new page controls, including races.
  const report = computed(() => !state.error.value && !state.isOffline.value &&
    state.data.value?.offset === offset.value ? state.data.value : null)
  watch(offset, () => { void state.refresh() })
  return { report, offset, error: state.error, refresh: state.refresh, isStale: state.isStale }
}
