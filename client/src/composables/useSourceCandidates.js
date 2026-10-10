/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { lookupSourceCandidates } from '@/api/mediaIdentityReviewApi'
import { candidateFailureMessage, parseSourceCandidates } from '@/utils/sourceCandidates'

export function useSourceCandidates(source, offset) {
  const result = ref(null), error = ref(''), busy = ref(false), notice = ref('')
  let controller = null, sequence = 0
  function clear() { sequence++; controller?.abort(); controller = null; result.value = null; error.value = ''; notice.value = ''; busy.value = false }
  function cancel() { clear(); notice.value = 'Candidate lookup cancelled. Nothing was saved.' }
  watch(() => [source().key, source().sourceVersion, offset()], clear)
  onBeforeUnmount(clear)
  async function lookup() {
    clear()
    const ticket = sequence, current = { ...source() }
    controller = new AbortController()
    busy.value = true
    try {
      const { data } = await lookupSourceCandidates(current.key,
        { sourceVersion: current.sourceVersion, offset: offset() }, controller.signal)
      if (ticket !== sequence) return
      const parsed = parseSourceCandidates(data, current)
      if (!parsed) throw new Error('invalid_response')
      result.value = parsed
    } catch (failure) {
      if (ticket !== sequence) return
      error.value = candidateFailureMessage(failure)
    } finally { if (ticket === sequence) { busy.value = false; controller = null } }
  }
  return { result, error, busy, notice, lookup, cancel }
}
