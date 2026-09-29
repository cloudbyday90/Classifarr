/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { apiClient, getDataRequest } from './core'

const path = id => `/libraries/${encodeURIComponent(id)}/ingestion-reconciliation`
export const previewLibraryIngestion = id => getDataRequest(path(id))
export const reconcileLibraryIngestion = (id, body, revision) => apiClient.post(path(id), body, { headers: { 'If-Match': revision } })
export const resumeLibraryIngestion = (id, body, revision) => reconcileLibraryIngestion(id, { ...body, resume: true }, revision)
export const getLibraryIngestionReceipt = (id, requestId) => getDataRequest(`${path(id)}/receipts/${encodeURIComponent(requestId)}`)
export default { previewLibraryIngestion, reconcileLibraryIngestion, resumeLibraryIngestion, getLibraryIngestionReceipt }
