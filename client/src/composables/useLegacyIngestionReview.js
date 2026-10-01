/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useSWR } from './useSWR'
import { createBrowserRequestId } from '@/utils/browserRequestId'
import { previewLibraryIngestion, reconcileLibraryIngestion, resumeLibraryIngestion, getLibraryIngestionReceipt } from '@/api/libraryIngestionApi'

/** Preview never grants authority. Only an explicit confirmation sends a mutation. */
export function useLegacyIngestionReview(libraryId, onReconciled = () => {}) {
  const opened = ref(false), acknowledged = ref(false), busy = ref(false)
  const receipt = ref(null), message = ref(''), pending = ref(null)
  const invalidated = ref(false), reviewing = ref(false), visit = ref(0)
  let disposed = false
  const isCurrent = context => !disposed && context === visit.value
  const resource = useSWR('legacy-ingestion-review', async () => {
    // Reconnection must not replace the evidence bound to an uncertain request.
    if (!opened.value || pending.value || receipt.value) return resource.data.value
    const id = libraryId.value
    const context = visit.value
    reviewing.value = true; acknowledged.value = false
    try {
      return { id, context, preview: await previewLibraryIngestion(id) }
    } catch (cause) {
      if (isCurrent(context)) throw cause
      return null
    } finally {
      if (isCurrent(context)) reviewing.value = false
    }
  }, { persist: false, autoRetry: false })
  const preview = computed(() => opened.value && resource.data.value?.id === libraryId.value &&
    resource.data.value.context === visit.value ? resource.data.value.preview : null)
  const error = computed(() => resource.isOffline.value ? 'Connection unavailable. Reconnect before continuing.'
    : resource.error.value ? 'Review unavailable. An active administrator session is required; try refreshing.' : message.value)
  watch(resource.data, () => { if (!pending.value) acknowledged.value = false })
  watch(libraryId, () => {
    visit.value++
    opened.value = false; acknowledged.value = false; pending.value = null; receipt.value = null; message.value = ''; invalidated.value = false
    busy.value = false; reviewing.value = false; resource.error.value = null
  }, { flush: 'sync' })
  onScopeDispose(() => { disposed = true; visit.value++ })
  const canConfirm = computed(() => !disposed && !busy.value && !reviewing.value && !invalidated.value &&
    !receipt.value && acknowledged.value && (preview.value?.canReconcile || preview.value?.canResume) &&
    !resource.error.value && !resource.isOffline.value)
  async function refresh() {
    if (disposed || busy.value || pending.value || reviewing.value) return
    const context = visit.value
    invalidated.value = true
    opened.value = true; acknowledged.value = false; message.value = ''; receipt.value = null
    await resource.refresh()
    if (isCurrent(context)) invalidated.value = Boolean(resource.error.value) || !preview.value
  }
  async function accept(result, context) {
    if (!isCurrent(context)) return
    receipt.value = result.receipt; pending.value = null; acknowledged.value = false; message.value = ''
    // A failed progress refresh cannot turn a recorded receipt into a failed write.
    try { await onReconciled() }
    catch {
      if (isCurrent(context)) message.value = 'Recovery is recorded, but progress could not refresh. Refresh the library to see current progress.'
    }
  }
  async function confirm() {
    if (!canConfirm.value) return
    const id = libraryId.value
    const context = visit.value
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
      await accept(result.data, context)
    } catch (cause) {
      if (!isCurrent(context)) return
      if (!request.uncertain && [400, 403, 404, 409, 412, 428].includes(cause.response?.status)) {
        pending.value = null; acknowledged.value = false
        invalidated.value = true
        message.value = 'Confirmation was not applied. Refresh the review; the state or your access may have changed.'
      } else {
        // Rejection of a retry says nothing about the original uncertain attempt.
        request.uncertain = true
        message.value = 'The original confirmation outcome is unverified. Check the recorded outcome before trying again.'
      }
    } finally { if (isCurrent(context)) busy.value = false }
  }
  async function checkOutcome() {
    if (disposed || busy.value || !pending.value) return
    const request = pending.value
    const context = visit.value
    busy.value = true
    try {
      const result = await getLibraryIngestionReceipt(request.id, request.requestId)
      if (!isCurrent(context)) return
      if (result.receipt) await accept(result, context)
      else message.value = 'No receipt was observed. This does not prove failure. Check again or retry the same confirmation.'
    } catch { if (isCurrent(context)) message.value = 'Receipt lookup is unavailable. Do not assume the confirmation failed.' }
    finally { if (isCurrent(context)) busy.value = false }
  }
  return { opened, preview, acknowledged, receipt, busy, error, pending, canConfirm,
    loading: reviewing, refresh, confirm, checkOutcome }
}
