/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { apiClient, getDataRequest } from './core'

export function getPendingPrompts(params = {}) {
  return getDataRequest('/prompts/pending', { params })
}

export function getPrompt(id) {
  return getDataRequest(`/prompts/${id}`)
}

export function getPromptBatch(params = {}) {
  return getDataRequest('/prompts/batch', { params })
}

/**
 * Returns the raw response after commit. data.data.patternsCreated counts distinct
 * persisted patterns (including existing rows updated). Invalid actions reject the
 * whole request; PROMPT_NOT_PENDING requires a refresh, never an automatic retry.
 */
export function respondToPrompt(id, response) {
  return apiClient.post(`/prompts/${id}/respond`, response)
}

export default { getPendingPrompts, getPrompt, getPromptBatch, respondToPrompt }
