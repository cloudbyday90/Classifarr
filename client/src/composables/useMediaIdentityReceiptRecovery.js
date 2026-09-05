/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { onScopeDispose, ref } from 'vue'
import api from '@/api'
import { clearRecoveryReference, readRecoveryReference, recoveryReference, storeRecoveryReference, validReviewInteger } from '@/utils/mediaIdentityRecoveryStorage'

function verifiedReceipt(result, reference) {
  const receipt = result?.receipt
  if (result?.version !== 1 || result.status !== 'confirmed' || !receipt ||
    receipt.itemId !== reference.itemId || receipt.previewId !== reference.previewId ||
    !validReviewInteger(receipt.auditId) || !validReviewInteger(receipt.tmdbId) ||
    !['movie', 'tv'].includes(receipt.mediaType) || typeof receipt.sourceVersion !== 'string' ||
    !/^[a-f0-9]{64}$/.test(receipt.sourceVersion) || typeof receipt.confirmedAt !== 'string' ||
    Number.isNaN(Date.parse(receipt.confirmedAt))) return null
  return receipt
}

export function useMediaIdentityReceiptRecovery() {
  const pending = ref(null)
  const phase = ref('idle')
  const receipt = ref(null)
  const notice = ref('')
  const storageWarning = ref('')
  let generation = 0
  onScopeDispose(() => { generation++ })

  function remember(itemId, previewId) {
    generation++
    pending.value = recoveryReference({ version: 1, itemId, previewId })
    if (!pending.value) throw new Error('Invalid confirmation reference')
    receipt.value = null
    phase.value = 'confirming'
    storageWarning.value = storeRecoveryReference(pending.value) ? '' : 'This tab cannot save the recovery reference. Keep this page open; recovery after a reload is unavailable.'
  }

  function restore() {
    pending.value = readRecoveryReference()
    return Boolean(pending.value)
  }

  function clear() {
    generation++
    clearRecoveryReference(pending.value)
    pending.value = null
    phase.value = 'idle'
    receipt.value = null
    notice.value = ''
    storageWarning.value = ''
  }

  async function check() {
    if (!pending.value || phase.value === 'checking') return
    const request = ++generation
    const reference = pending.value
    phase.value = 'checking'
    notice.value = 'Checking for a committed confirmation receipt…'
    try {
      const result = await api.getMediaIdentityReceipt(reference.itemId, reference.previewId)
      if (request !== generation) return
      receipt.value = verifiedReceipt(result, reference)
      if (receipt.value) {
        phase.value = 'confirmed'
        clearRecoveryReference(reference)
        storageWarning.value = ''
        notice.value = 'A committed confirmation receipt was recovered. It records the earlier confirmation; the inventory may have changed since then.'
        return
      }
      notice.value = 'No verified receipt is visible yet. The confirmation may still be finishing. This does not establish whether the identity was saved.'
    } catch (failure) {
      if (request !== generation) return
      notice.value = [401, 403].includes(failure.response?.status)
        ? 'Receipt recovery requires the same active administrator account that confirmed the identity. Sign in with that account and check again.'
        : 'The receipt could not be checked. The confirmation outcome remains unknown. Check again when the connection is available.'
    }
    phase.value = 'unknown'
  }

  return { pending, phase, receipt, notice, storageWarning, remember, restore, clear, check }
}
