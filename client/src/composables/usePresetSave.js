/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { onScopeDispose, ref } from 'vue'
import { presetSaveReceipt } from '@/utils/presetSaveReceipt'

/** One manager owns one save; event emission never represents request completion. */
export function usePresetSave(api) {
  const pending = ref(false)
  const error = ref('')
  const needsReview = ref(false)
  const notice = ref('')
  let disposed = false, initialized = false, request = null, creationReview = false

  onScopeDispose(() => { disposed = true })

  function reset({ reviewed = false } = {}) {
    if (pending.value || disposed || creationReview || (needsReview.value && !reviewed)) return
    error.value = ''
    needsReview.value = false
    notice.value = ''
  }

  async function readPending() {
    const data = await api.getPendingCustomPresetSave()
    if (disposed) return
    if (!data || !Object.hasOwn(data, 'request')) throw new Error('Invalid save status')
    request = data.request === null ? null : presetSaveReceipt(data.request)
    initialized = true
    creationReview = Boolean(request)
    needsReview.value = creationReview
    error.value = creationReview ? 'A previous save needs checking before you create another preset.' : ''
  }

  async function initialize() {
    if (pending.value || disposed) return
    pending.value = true
    try { await readPending() }
    catch {
      if (!disposed) {
        creationReview = true
        needsReview.value = true
        error.value = 'Could not check the previous save. Check save status to continue.'
      }
    } finally { pending.value = false }
  }

  async function reviewCreation() {
    if (!creationReview || pending.value || disposed) return null
    pending.value = true
    try {
      if (!request) await readPending()
      if (disposed) return null
      const result = request ? presetSaveReceipt((await api.resolveCustomPresetSave(request.requestId)).data) : null
      if (result && (!result.resolved || result.state === 'pending' || result.requestId !== request.requestId)) throw new Error('Unresolved save')
      if (disposed) return null
      request = null
      creationReview = false
      needsReview.value = false
      initialized = true
      error.value = ''
      notice.value = result?.state === 'saved'
        ? (result.presetId ? 'Preset saved.' : 'The preset was saved, but has since been deleted.')
        : 'Not saved. You can try again.'
      return result?.state ?? 'cancelled'
    } catch {
      if (!disposed) {
        creationReview = true
        needsReview.value = true
        error.value = 'Could not confirm the save. Check save status again when the connection returns.'
      }
      return null
    } finally { pending.value = false }
  }

  async function save(data, id = null) {
    if (pending.value || needsReview.value || disposed) return false
    if (id == null && !initialized) { await initialize(); if (needsReview.value || disposed) return false }
    pending.value = true
    error.value = ''
    notice.value = ''
    try {
      if (id != null) await api.updateCustomPreset(id, data)
      else {
        request = presetSaveReceipt((await api.beginCustomPresetSave()).data)
        if (disposed) return false
        if (request.state !== 'pending' || request.resolved) throw new Error('Invalid reservation')
        const saved = presetSaveReceipt((await api.completeCustomPresetSave(request.requestId, data)).data)
        if (saved.state !== 'saved' || saved.requestId !== request.requestId) throw new Error('Save not confirmed')
        if (disposed) return false
        // An acknowledgement failure must not turn a confirmed save into a retry.
        try {
          const resolved = presetSaveReceipt((await api.resolveCustomPresetSave(request.requestId)).data)
          if (!resolved.resolved || resolved.state !== 'saved' || resolved.requestId !== request.requestId) throw new Error('Invalid acknowledgement')
          request = null
        } catch {
          if (!disposed) {
            creationReview = true
            needsReview.value = true
            error.value = 'Preset saved. Check save status before creating another.'
          }
        }
      }
      return !disposed
    } catch (failure) {
      if (disposed) return false
      const status = failure?.response?.status
      if (id == null) {
        creationReview = true
        needsReview.value = true
        error.value = 'Could not confirm the save. Check save status before trying again.'
      } else if (status === 401) error.value = 'Your session expired. Sign in again before saving.'
      else if (status === 403) error.value = 'You do not have permission to save presets.'
      else if (status === 429) error.value = 'Too many requests. Wait before trying again.'
      else if (Number.isInteger(status) && status >= 400 && status < 500 && ![408, 409].includes(status)) {
        error.value = 'Could not save this preset. Check its name and settings, then try again.'
      } else {
        needsReview.value = true
        error.value = 'Could not confirm the save. Check saved presets before trying again.'
      }
      return false
    } finally {
      pending.value = false
    }
  }

  return { pending, error, needsReview, notice, reset, save, initialize, reviewCreation,
    isCreationReview: () => creationReview }
}
