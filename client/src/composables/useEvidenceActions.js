/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Evidence administration: decay, promote, and purge actions.
 * Each action returns { ok: boolean, message: string }.
 */

import { ref } from 'vue'
import api from '@/api'

export function useEvidenceActions() {
  const actionLoading = ref(false)
  const actionError   = ref(null)
  const actionSuccess = ref(null)

  function clearFeedback() {
    actionError.value   = null
    actionSuccess.value = null
  }

  async function decay(id) {
    clearFeedback()
    actionLoading.value = true
    try {
      const result = await api.decay(id)
      actionSuccess.value = result.changed
        ? `Evidence #${id} set to candidate.`
        : `Evidence #${id} was already in candidate status.`
      return { ok: true, changed: result.changed, row: result.row }
    } catch (err) {
      actionError.value = err.message ?? 'Failed to decay evidence row'
      return { ok: false }
    } finally {
      actionLoading.value = false
    }
  }

  async function promote(id) {
    clearFeedback()
    actionLoading.value = true
    try {
      const result = await api.promote(id)
      actionSuccess.value = result.changed
        ? `Evidence #${id} set to active.`
        : `Evidence #${id} was already active.`
      return { ok: true, changed: result.changed, row: result.row }
    } catch (err) {
      actionError.value = err.message ?? 'Failed to promote evidence row'
      return { ok: false }
    } finally {
      actionLoading.value = false
    }
  }

  async function purge(filter) {
    clearFeedback()
    actionLoading.value = true
    try {
      const result = await api.purge(filter)
      actionSuccess.value = `Purged ${result.deleted} evidence row(s).`
      return { ok: true, deleted: result.deleted }
    } catch (err) {
      actionError.value = err.message ?? 'Failed to purge evidence'
      return { ok: false }
    } finally {
      actionLoading.value = false
    }
  }

  return {
    actionLoading,
    actionError,
    actionSuccess,
    clearFeedback,
    decay,
    promote,
    purge
  }
}
