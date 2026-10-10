/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { apiClient, getDataRequest } from './core'

export function getMediaIdentityReviewItems(params = {}) {
  return getDataRequest('/media-identity-review', { params })
}

export function previewMediaIdentity(itemId, body) {
  return apiClient.post(`/media-identity-review/${encodeURIComponent(itemId)}/preview`, body)
}

export function confirmMediaIdentity(itemId, body) {
  return apiClient.post(`/media-identity-review/${encodeURIComponent(itemId)}/confirm`, body, { skipAutomaticRetry: true })
}

export function getMediaIdentityReceipt(itemId, previewId) {
  return getDataRequest(`/media-identity-review/${encodeURIComponent(itemId)}/receipts/${encodeURIComponent(previewId)}`, { skipAutomaticRetry: true })
}

export function reviewSourceScope(key, body) {
  return apiClient.post(`/media-identity-review/source-scopes/${encodeURIComponent(key)}/review`, body, { skipAutomaticRetry: true })
}

export function inspectSourceScope(key, body, signal) {
  return apiClient.post(`/media-identity-review/source-scopes/${encodeURIComponent(key)}/evidence`, body,
    { skipAutomaticRetry: true, timeout: 105000, signal })
}

export default { getMediaIdentityReviewItems, previewMediaIdentity, confirmMediaIdentity, getMediaIdentityReceipt, reviewSourceScope, inspectSourceScope }
