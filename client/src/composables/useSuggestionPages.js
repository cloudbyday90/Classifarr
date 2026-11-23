/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import api from '@/api'

function isSuggestionPage(result, beforeId) {
  const items = result?.items
  if (!Array.isArray(items) || items.length > 20) return false
  const validIds = items.every((item, index) => Number.isInteger(item?.id) && item.id > 0 &&
    item.id < (index ? items[index - 1].id : beforeId ?? 2147483648))
  return validIds && (result.nextBeforeId === null ||
    (items.length === 20 && result.nextBeforeId === items.at(-1).id))
}

export function useSuggestionPages(status, policyId) {
  const page = shallowRef(null)
  const pageIndex = ref(0)
  const state = ref('loading')
  let cursors = []
  let failedRequest = null
  let generation = 0

  const canShowNewer = computed(() => state.value !== 'loading' && pageIndex.value > 0)
  const canShowOlder = computed(() => state.value !== 'loading' && page.value?.nextBeforeId != null)
  const statusMessage = computed(() => {
    if (state.value === 'loading') return 'Loading suggestions…'
    if (state.value === 'error') return page.value
      ? 'Could not load the requested page. The previous results are still shown.'
      : 'Could not load suggestions.'
    const count = page.value.items.length
    if (!count) return pageIndex.value === 0 ? 'No suggestions found.' : `Page ${pageIndex.value + 1}. No suggestions at this position.`
    return `Page ${pageIndex.value + 1}. ${count} ${count === 1 ? 'suggestion' : 'suggestions'} on this page.`
  })

  async function load(index, beforeId) {
    const request = ++generation
    failedRequest = null
    state.value = 'loading'
    try {
      const result = await api.getSuggestionPage({
        status: status.value,
        ...(policyId.value ? { policyId: policyId.value } : {}),
        ...(beforeId === undefined ? {} : { beforeId }),
      })
      if (request !== generation) return false
      if (!isSuggestionPage(result, beforeId)) throw new Error('Invalid suggestion page')
      cursors = [...cursors.slice(0, index), beforeId]
      pageIndex.value = index
      page.value = result
      state.value = 'ready'
      return true
    } catch {
      if (request !== generation) return false
      failedRequest = { index, beforeId }
      state.value = 'error'
      return false
    }
  }

  function reset() {
    page.value = null
    pageIndex.value = 0
    cursors = []
    return load(0)
  }

  function showNewer() {
    if (!canShowNewer.value) return
    const index = pageIndex.value - 1
    return load(index, cursors[index])
  }

  function showOlder() {
    if (canShowOlder.value) return load(pageIndex.value + 1, page.value.nextBeforeId)
  }

  function retry() {
    if (failedRequest) return load(failedRequest.index, failedRequest.beforeId)
  }

  watch([status, policyId], reset, { flush: 'sync' })
  onMounted(reset)
  onBeforeUnmount(() => { generation++ })

  return { page, state, statusMessage, canShowNewer, canShowOlder, showNewer, showOlder, retry, reset }
}
