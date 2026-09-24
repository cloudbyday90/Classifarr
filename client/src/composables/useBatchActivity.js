/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { computed, ref } from 'vue'
import api from '@/api'
import { useSWR } from '@/composables/useSWR'

const COUNTS = ['total', 'completed', 'failed', 'skipped', 'cancelled', 'recovering', 'attention']
function validPage(page) {
  return Array.isArray(page?.batches) && page.batches.length <= 10 &&
    page.batches.every(batch => Number.isSafeInteger(batch?.id) && batch.id > 0 && batch.id <= 2147483647 &&
      typeof batch.status === 'string' && /^[a-z_]{1,50}$/.test(batch.status) &&
      COUNTS.every(key => Number.isSafeInteger(batch[key]) && batch[key] >= 0)) &&
    (page.nextCursor === null || (typeof page.nextCursor === 'string' &&
      /^[01]:[1-9][0-9]{0,9}$/.test(page.nextCursor) && Number(page.nextCursor.split(':')[1]) <= 2147483647))
}

export function useBatchActivity() {
  const cursor = ref(null)
  const available = ref(typeof api.getReclassificationBatchActivity === 'function')
  const fetching = ref(false)
  const { data, error, isLoading, refresh: revalidate } = useSWR('batch-activity', async () => {
    if (!available.value) return null
    const requestedCursor = cursor.value
    fetching.value = true
    try {
      const page = await api.getReclassificationBatchActivity(requestedCursor)
      if (!validPage(page)) {
        throw new Error('Invalid batch activity response')
      }
      return { cursor: requestedCursor, page }
    } catch (failure) {
      if ([401, 403].includes(failure?.response?.status)) {
        available.value = false
        return null
      }
      throw failure
    } finally {
      fetching.value = false
    }
  }, { persist: false, pollInterval: () => available.value ? 15_000 : null })

  const page = computed(() => data.value?.cursor === cursor.value ? data.value.page : null)
  async function refresh() {
    cursor.value = null
    await revalidate()
  }
  async function nextPage() {
    if (fetching.value || !page.value?.nextCursor) return
    cursor.value = page.value.nextCursor
    await revalidate()
  }
  return { page, available, fetching, isLoading, cursor, refresh, nextPage,
    errorMessage: computed(() => error.value ? 'Batch activity is unavailable. Refresh to try again.' : ''),
  }
}
