/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { onScopeDispose, ref } from 'vue'

/** One manager owns one save; event emission never represents request completion. */
export function usePresetSave(api) {
  const pending = ref(false)
  const error = ref('')
  const needsReview = ref(false)
  let disposed = false

  onScopeDispose(() => { disposed = true })

  function reset({ reviewed = false } = {}) {
    if (pending.value || disposed || (needsReview.value && !reviewed)) return
    error.value = ''
    needsReview.value = false
  }

  async function save(data, id = null) {
    if (pending.value || needsReview.value || disposed) return false
    pending.value = true
    error.value = ''
    try {
      if (id != null) await api.updateCustomPreset(id, data)
      else await api.createCustomPreset(data)
      return !disposed
    } catch (failure) {
      if (disposed) return false
      const status = failure?.response?.status
      if (status === 401) error.value = 'Your session expired. Sign in again before saving.'
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

  return { pending, error, needsReview, reset, save }
}
