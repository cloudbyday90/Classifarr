/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { apiClient, getDataRequest } from './core'

export function getMediaIdentityReviewItems(params = {}) {
  return getDataRequest('/media-identity-review', { params })
}

export function previewMediaIdentity(itemId, body) {
  return apiClient.post(`/media-identity-review/${encodeURIComponent(itemId)}/preview`, body)
}

export function confirmMediaIdentity(itemId, body) {
  return apiClient.post(`/media-identity-review/${encodeURIComponent(itemId)}/confirm`, body)
}

export default { getMediaIdentityReviewItems, previewMediaIdentity, confirmMediaIdentity }
