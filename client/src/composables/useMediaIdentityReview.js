/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { onScopeDispose, ref } from 'vue'
import api from '@/api'

export function useMediaIdentityReview() {
  const items = ref([])
  const mediaType = ref('')
  const nextCursor = ref(null)
  const selected = ref(null)
  const preview = ref(null)
  const busy = ref(false)
  const error = ref('')
  const status = ref('')
  let generation = 0
  onScopeDispose(() => { generation++ })

  function message(failure) {
    if (failure.response?.status === 403) return 'An active administrator session is required. Sign in with an administrator account.'
    return typeof failure.response?.data?.error === 'string'
      ? failure.response.data.error : 'The request could not be completed. Refresh the queue to check its current state.'
  }

  function select(item) {
    generation++
    selected.value = item
    preview.value = null
    busy.value = false
    error.value = ''
    status.value = ''
  }

  async function load(more = false, savedMessage = '') {
    const request = ++generation
    busy.value = true
    error.value = ''
    selected.value = null
    preview.value = null
    status.value = savedMessage || 'Loading items for review…'
    try {
      const params = { limit: 25 }
      if (mediaType.value) params.mediaType = mediaType.value
      if (more && nextCursor.value) params.afterId = nextCursor.value
      const result = await api.getMediaIdentityReviewItems(params)
      if (request !== generation) return
      items.value = more ? [...items.value, ...result.items] : result.items
      nextCursor.value = result.nextCursor
      status.value = savedMessage || `${items.value.length} items loaded for review.`
    } catch (failure) {
      if (request !== generation) return
      error.value = message(failure)
      if (!more) {
        items.value = []
        nextCursor.value = null
      }
      status.value = savedMessage
    } finally {
      if (request === generation) busy.value = false
    }
  }

  async function prepare(tmdbId) {
    if (!selected.value || busy.value) return
    const request = ++generation
    const source = selected.value
    busy.value = true
    preview.value = null
    error.value = ''
    status.value = 'Checking TMDb details…'
    try {
      const { data } = await api.previewMediaIdentity(source.id, { tmdbId, sourceVersion: source.sourceVersion })
      if (request !== generation) return
      preview.value = data
      status.value = 'Candidate ready. Compare the details before confirming.'
    } catch (failure) {
      if (request !== generation) return
      error.value = message(failure)
      status.value = ''
    } finally {
      if (request === generation) busy.value = false
    }
  }

  async function confirm() {
    if (!preview.value || !selected.value || busy.value) return
    const request = ++generation
    const source = selected.value
    busy.value = true
    error.value = ''
    status.value = 'Saving the verified identity…'
    try {
      const { data } = await api.confirmMediaIdentity(source.id, { previewId: preview.value.previewId, confirmed: true })
      if (request !== generation) return
      await load(false, `Identity saved for ${source.title}. Audit receipt ${data.auditId}.`)
    } catch (failure) {
      if (request !== generation) return
      preview.value = null
      error.value = message(failure)
      status.value = ''
    } finally {
      if (request === generation) busy.value = false
    }
  }

  return { items, mediaType, nextCursor, selected, preview, busy, error, status, select, load, prepare, confirm }
}
