/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { approveSourceScope } from '@/api/mediaIdentityReviewApi'

export function useSourceMappingApproval(intent) {
  const confirmed = ref(false), busy = ref(false), attempted = ref(false), error = ref(''), notice = ref('')
  let controller, sequence = 0
  function clear() {
    sequence++; controller?.abort(); controller = null
    confirmed.value = false; busy.value = false; attempted.value = false; error.value = ''; notice.value = ''
  }
  watch(() => JSON.stringify(intent()), clear)
  onBeforeUnmount(clear)
  async function approve() {
    if (!confirmed.value || busy.value || attempted.value) return
    const current = JSON.parse(JSON.stringify(intent())), ticket = sequence
    attempted.value = true; busy.value = true; controller = new AbortController()
    try {
      const { data } = await approveSourceScope(current.key, { ...current.body, confirmed: true }, controller.signal)
      if (ticket !== sequence) return
      if (data?.version !== 'source_mapping_approval.v1' || data.status !== 'approved' || data.materialized !== false ||
          !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(data.mappingId)) throw new Error('invalid_receipt')
      notice.value = `Mapping saved. Reference: ${data.mappingId}. The item remains unresolved until a scheduled library sync verifies and applies the complete mapping. View saved mappings below for progress or revocation.`
    } catch (failure) {
      if (ticket !== sequence) return
      error.value = failure?.response?.status === 409
        ? 'The evidence changed or a mapping already exists. Check saved mappings, then refresh items and review again.'
        : 'Approval could not be confirmed. Check saved mappings before submitting again; a lost response does not mean nothing was saved.'
    } finally { if (ticket === sequence) { busy.value = false; controller = null } }
  }
  return { confirmed, busy, attempted, error, notice, approve }
}
