/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { computed, ref, watch } from 'vue'
import { useSWR } from './useSWR'
import { createBrowserRequestId } from '@/utils/browserRequestId'
import { previewLibraryArchive, confirmLibraryArchive, getLibraryArchiveReceipt } from '@/api/libraryArchiveApi'

export function useLibraryArchiveReview(libraryId, onChanged = () => {}) {
  const opened = ref(false), acknowledged = ref(false), busy = ref(false)
  const receipt = ref(null), message = ref(''), pending = ref(null), invalidated = ref(false)
  const resource = useSWR('library-archive-review', async () => {
    const id = libraryId.value
    return opened.value ? { id, preview: await previewLibraryArchive(id) } : null
  }, { persist: false, autoRetry: false })
  const preview = computed(() => resource.data.value?.id === libraryId.value ? resource.data.value.preview : null)
  const error = computed(() => resource.isOffline.value ? 'Reconnect before continuing.'
    : resource.error.value ? 'Review unavailable. Check your administrator session and media-server connection.' : message.value)
  watch(resource.data, () => { if (!pending.value) acknowledged.value = false })
  watch(libraryId, () => {
    opened.value = false; acknowledged.value = false; pending.value = null; receipt.value = null; message.value = ''; invalidated.value = false
  })
  async function refresh() {
    if (busy.value || pending.value) return
    opened.value = true; acknowledged.value = false; message.value = ''; receipt.value = null
    await resource.refresh()
    invalidated.value = Boolean(resource.error.value)
  }
  async function accept(result, id) {
    if (id !== libraryId.value) return
    receipt.value = result.receipt; pending.value = null; acknowledged.value = false; message.value = ''
    await onChanged()
  }
  async function confirm() {
    if (busy.value || invalidated.value || !acknowledged.value || !preview.value?.canConfirm || resource.error.value || resource.isOffline.value) return
    const id = libraryId.value
    try {
      pending.value ??= { id, requestId: createBrowserRequestId(), revision: preview.value.revision, operation: preview.value.operation, uncertain: false }
    } catch {
      message.value = 'Secure random values are unavailable. No confirmation was sent.'
      return
    }
    const request = pending.value
    busy.value = true; message.value = ''
    try {
      const result = await confirmLibraryArchive(id, { requestId: request.requestId, operation: request.operation, workersStopped: true }, request.revision)
      await accept(result.data, id)
    } catch (cause) {
      if (id !== libraryId.value) return
      if (!request.uncertain && [400, 403, 404, 409, 412, 428].includes(cause.response?.status)) {
        pending.value = null; acknowledged.value = false; invalidated.value = true
        message.value = 'Not applied. Refresh the review; the library or your access may have changed.'
      } else {
        request.uncertain = true
        message.value = 'Outcome unverified. Check the recorded outcome before trying again.'
      }
    } finally { busy.value = false }
  }
  async function checkOutcome() {
    if (busy.value || !pending.value) return
    const request = pending.value
    busy.value = true
    try {
      const result = await getLibraryArchiveReceipt(request.id, request.requestId)
      if (request.id !== libraryId.value) return
      if (result.receipt) await accept(result, request.id)
      else message.value = 'No receipt observed. This does not prove failure. Check again or retry the same confirmation.'
    } catch { if (request.id === libraryId.value) message.value = 'Receipt lookup unavailable. Do not assume the change failed.' }
    finally { busy.value = false }
  }
  return { opened, preview, acknowledged, receipt, busy, error, pending, loading: resource.isLoading, refresh, confirm, checkOutcome }
}
