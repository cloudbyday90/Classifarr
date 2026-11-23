/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { apiClient, getDataRequest } from './core'
import { canonicalClassificationHistoryId } from '@/utils/classificationHistoryId'

export function getPendingPrompts(params = {}) {
  return getDataRequest('/prompts/pending', { params })
}

export function getPrompt(classificationId) {
  const id = canonicalClassificationHistoryId(classificationId)
  if (!id) return Promise.reject(new TypeError('Invalid prompt ID'))

  return getDataRequest(`/prompts/${id}`)
}

export function getPromptBatch(params = {}) {
  return getDataRequest('/prompts/batch', { params })
}

/**
 * Requires an administrator session. Pass large History IDs as decimal strings.
 * The raw response preserves the committed upsert count, including existing
 * patterns updated. PROMPT_NOT_PENDING requires a refresh.
 */
export function respondToPrompt(classificationId, response) {
  const id = canonicalClassificationHistoryId(classificationId)
  if (!id) return Promise.reject(new TypeError('Invalid prompt ID'))

  return apiClient.post(`/prompts/${id}/respond`, response)
}

export default { getPendingPrompts, getPrompt, getPromptBatch, respondToPrompt }
