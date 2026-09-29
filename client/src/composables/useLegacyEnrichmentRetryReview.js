/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { computed, ref, watch, onUnmounted } from 'vue'
import { useSWR } from './useSWR'
import { createBrowserRequestId } from '@/utils/browserRequestId'
import { previewLegacyEnrichmentRetries, recoverLegacyEnrichmentRetries, getLegacyEnrichmentRetryReceipt } from '@/api/legacyEnrichmentRetryApi'

export function useLegacyEnrichmentRetryReview(libraryId) {
  const opened = ref(false), acknowledged = ref(false), busy = ref(false), reading = ref(false)
  const receipt = ref(null), message = ref(''), pending = ref(null), invalidated = ref(false)
  const generation = ref(0)
  const resource = useSWR('legacy-enrichment-retry-review', async () => {
    if (!opened.value || pending.value) return resource.data.value
    const current = generation.value, id = libraryId.value
    return { generation: current, preview: await previewLegacyEnrichmentRetries(id) }
  }, { persist: false, autoRetry: false })
  const preview = computed(() => resource.data.value?.generation === generation.value ? resource.data.value.preview : null)
  const error = computed(() => message.value || (resource.isOffline.value ? 'Reconnect before continuing.'
    : resource.error.value ? 'Review unavailable. Sign in as an administrator and refresh.' : ''))
  watch(resource.data, () => { if (!pending.value) acknowledged.value = false })
  watch(libraryId, () => {
    generation.value++; opened.value = false; acknowledged.value = false; pending.value = null
    receipt.value = null; message.value = ''; invalidated.value = false
  })
  onUnmounted(() => { generation.value++ })
  const canConfirm = computed(() => !busy.value && !reading.value && !resource.isOffline.value &&
    (pending.value || (acknowledged.value && preview.value?.canRecover && !invalidated.value && !resource.error.value && !receipt.value)))
  async function refresh() {
    if (busy.value || reading.value || pending.value) return
    opened.value = true; acknowledged.value = false; message.value = ''; receipt.value = null; reading.value = true
    const current = generation.value
    await resource.refresh()
    if (current === generation.value) invalidated.value = Boolean(resource.error.value)
    reading.value = false
  }
  function accept(result) {
    const recorded = result?.receipt, request = pending.value
    if (!request || !recorded || recorded.requestId !== request.requestId || recorded.libraryId !== request.id ||
      !Number.isSafeInteger(recorded.auditId) || recorded.auditId <= 0 ||
      !Number.isInteger(recorded.queued) || recorded.queued < 0 ||
      !Number.isInteger(recorded.exhausted) || recorded.exhausted < 0 ||
      recorded.queued + recorded.exhausted !== request.count ||
      typeof recorded.confirmedAt !== 'string' || !Number.isFinite(Date.parse(recorded.confirmedAt))) {
      throw new Error('Unverified recovery receipt')
    }
    receipt.value = recorded; pending.value = null; acknowledged.value = false; message.value = ''
  }
  async function confirm() {
    if (!canConfirm.value) return
    try {
      pending.value ??= { id: libraryId.value, generation: generation.value, requestId: createBrowserRequestId(),
        revision: preview.value.revision, count: preview.value.items.length, uncertain: false }
    } catch {
      message.value = 'Secure random values are unavailable. No confirmation was sent.'; return
    }
    const request = pending.value
    busy.value = true; message.value = ''
    try {
      const result = await recoverLegacyEnrichmentRetries(request.id, { requestId: request.requestId, workersStopped: true }, request.revision)
      if (request.generation === generation.value) accept(result.data)
    } catch (cause) {
      if (request.generation !== generation.value) return
      if (!request.uncertain && [400, 401, 403, 404, 409, 412, 428, 429].includes(cause.response?.status)) {
        pending.value = null; acknowledged.value = false; invalidated.value = true
        message.value = 'Confirmation was rejected. Refresh and review again before confirming.'
      } else {
        request.uncertain = true
        message.value = 'Outcome unverified. Keep this page open and check the recorded outcome; do not assume failure.'
      }
    } finally { busy.value = false }
  }
  async function checkOutcome() {
    if (busy.value || !pending.value) return
    const request = pending.value
    busy.value = true
    try {
      const result = await getLegacyEnrichmentRetryReceipt(request.id, request.requestId)
      if (request.generation !== generation.value) return
      if (result.receipt) accept(result)
      else message.value = 'No receipt observed. This does not prove failure. Check again or retry the same confirmation.'
    } catch {
      if (request.generation === generation.value) message.value = 'Receipt lookup unavailable. The original outcome is still unverified.'
    } finally { busy.value = false }
  }
  return { opened, preview, acknowledged, receipt, busy, reading, error, pending, canConfirm, refresh, confirm, checkOutcome }
}
