/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { reviewSourceScope } from '@/api/mediaIdentityReviewApi'

export function useSourceScopeReview(source, offset) {
  const result = ref(null), error = ref(''), busy = ref(false)
  let sequence = 0
  function clear() { sequence++; result.value = null; error.value = ''; busy.value = false }
  watch(() => [source().key, source().sourceVersion, offset()], clear)
  onBeforeUnmount(clear)
  async function review(scope) {
    clear()
    const ticket = sequence
    const item = source()
    busy.value = true
    try {
      const { data } = await reviewSourceScope(item.key, { offset: offset(), sourceVersion: item.sourceVersion, scope })
      if (ticket !== sequence) return
      if (data?.version !== 'source_scope_review.v1' || data.sourceKey !== item.key ||
          data.sourceVersion !== item.sourceVersion || data.status !== 'valid_draft' ||
          data.canApply !== false || data.persisted !== false || data.verification !== 'structure_only' ||
          typeof data.draftFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(data.draftFingerprint) ||
          !['whole_work', 'seasons'].includes(data.scope?.kind) ||
          (data.scope.kind === 'seasons' && (!Array.isArray(data.scope.mappings) || !Array.isArray(data.scope.sourceSeasonNumbers))) ||
          data.backfill?.eligible !== false || data.backfill.excludedScope !== 'all') throw new Error('invalid_response')
      result.value = data
    } catch (failure) {
      if (ticket !== sequence) return
      const status = failure?.response?.status
      error.value = status === 409 ? 'The source changed. Refresh items, then check this draft again.'
        : [401, 403].includes(status) ? 'An active administrator session is required.'
          : status === 400 ? 'Check the draft: use unique source seasons and targets, and list every season in the proposed scope.'
            : status === 429 ? 'Too many checks. Wait before trying again.'
              : 'Draft review is unavailable. No mapping was saved. Try again later.'
    } finally { if (ticket === sequence) busy.value = false }
  }
  return { result, error, busy, clear, review }
}
