/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { computed, ref, watch } from 'vue'
import { useSWR } from './useSWR'
import { createBrowserRequestId } from '@/utils/browserRequestId'
import { previewLibraryIngestion, reconcileLibraryIngestion, resumeLibraryIngestion, getLibraryIngestionReceipt } from '@/api/libraryIngestionApi'

/** Preview never grants authority. Only an explicit confirmation sends a mutation. */
export function useLegacyIngestionReview(libraryId, onReconciled = () => {}) {
  const opened = ref(false), acknowledged = ref(false), busy = ref(false)
  const receipt = ref(null), message = ref(''), pending = ref(null)
  const invalidated = ref(false)
  const resource = useSWR('legacy-ingestion-review', async () => {
    const id = libraryId.value
    return opened.value ? { id, preview: await previewLibraryIngestion(id) } : null
  }, { persist: false, autoRetry: false })
  const preview = computed(() => resource.data.value?.id === libraryId.value ? resource.data.value.preview : null)
  const error = computed(() => resource.isOffline.value ? 'Connection unavailable. Reconnect before continuing.'
    : resource.error.value ? 'Review unavailable. An active administrator session is required; try refreshing.' : message.value)
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
    await onReconciled()
  }
  async function confirm() {
    if (busy.value || invalidated.value || !acknowledged.value || !(preview.value?.canReconcile || preview.value?.canResume) || resource.error.value || resource.isOffline.value) return
    const id = libraryId.value
    try {
      pending.value ??= { id, requestId: createBrowserRequestId(), revision: preview.value.revision,
        resume: preview.value.canResume === true, uncertain: false }
    } catch {
      message.value = 'Confirmation unavailable: this browser must support secure random values. No request was sent.'
      return
    }
    const request = pending.value
    busy.value = true; message.value = ''
    try {
      const submit = request.resume ? resumeLibraryIngestion : reconcileLibraryIngestion
      const result = await submit(id, { requestId: request.requestId, workersStopped: true }, request.revision)
      await accept(result.data, id)
    } catch (cause) {
      if (id !== libraryId.value) return
      if (!request.uncertain && [400, 403, 404, 409, 412, 428].includes(cause.response?.status)) {
        pending.value = null; acknowledged.value = false
        invalidated.value = true
        message.value = 'Confirmation was not applied. Refresh the review; the state or your access may have changed.'
      } else {
        // Rejection of a retry says nothing about the original uncertain attempt.
        request.uncertain = true
        message.value = 'The original confirmation outcome is unverified. Check the recorded outcome before trying again.'
      }
    } finally { busy.value = false }
  }
  async function checkOutcome() {
    if (busy.value || !pending.value) return
    const request = pending.value
    busy.value = true
    try {
      const result = await getLibraryIngestionReceipt(request.id, request.requestId)
      if (request.id !== libraryId.value) return
      if (result.receipt) await accept(result, request.id)
      else message.value = 'No receipt was observed. This does not prove failure. Check again or retry the same confirmation.'
    } catch { if (request.id === libraryId.value) message.value = 'Receipt lookup is unavailable. Do not assume the confirmation failed.' }
    finally { busy.value = false }
  }
  return { opened, preview, acknowledged, receipt, busy, error, pending,
    loading: resource.isLoading, refresh, confirm, checkOutcome }
}
