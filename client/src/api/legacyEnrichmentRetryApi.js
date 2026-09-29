/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { apiClient, getDataRequest } from './core'

const path = id => `/libraries/${encodeURIComponent(id)}/legacy-enrichment-retries`
export const previewLegacyEnrichmentRetries = id => getDataRequest(path(id))
export const recoverLegacyEnrichmentRetries = (id, body, revision) => apiClient.post(path(id), body, { headers: { 'If-Match': revision } })
export const getLegacyEnrichmentRetryReceipt = (id, requestId) => getDataRequest(`${path(id)}/receipts/${encodeURIComponent(requestId)}`)
export default { previewLegacyEnrichmentRetries, recoverLegacyEnrichmentRetries, getLegacyEnrichmentRetryReceipt }
