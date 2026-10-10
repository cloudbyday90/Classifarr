/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { inspectSourceScope } from '@/api/mediaIdentityReviewApi'
import { parseSourceScopeEvidence } from '@/utils/sourceScopeEvidence'
import { sourceScopeFailureMessage } from '@/utils/sourceMappingGuidance'

export function useSourceScopeEvidence(draft, offset) {
  const result = ref(null), error = ref(''), busy = ref(false), notice = ref('')
  let controller = null, sequence = 0
  function clear() { sequence++; controller?.abort(); controller = null; result.value = null; error.value = ''; notice.value = ''; busy.value = false }
  function cancel() { clear(); notice.value = 'Evidence check cancelled. Nothing was saved.' }
  watch(() => [draft().draftFingerprint, offset()], clear)
  onBeforeUnmount(clear)
  async function inspect() {
    clear()
    const ticket = sequence, current = draft()
    controller = new AbortController()
    busy.value = true
    try {
      const { data } = await inspectSourceScope(current.sourceKey,
        { sourceVersion: current.sourceVersion, scope: current.scope, offset: offset() }, controller.signal)
      if (ticket !== sequence) return
      const parsed = parseSourceScopeEvidence(data, current)
      if (!parsed) throw new Error('invalid_response')
      result.value = parsed
    } catch (failure) {
      if (ticket !== sequence) return
      error.value = sourceScopeFailureMessage(failure)
    } finally { if (ticket === sequence) { busy.value = false; controller = null } }
  }
  return { result, error, busy, notice, inspect, cancel }
}
