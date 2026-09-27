/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { apiClient, getDataRequest } from './core'
const path = id => `/media-server/libraries/${encodeURIComponent(id)}/archive`
export const previewLibraryArchive = id => getDataRequest(path(id))
export const confirmLibraryArchive = (id, body, revision) => apiClient.post(path(id), body, { headers: { 'If-Match': revision }, skipAutomaticRetry: true })
export const getLibraryArchiveReceipt = (id, requestId) => getDataRequest(`${path(id)}/receipts/${encodeURIComponent(requestId)}`)
export default { previewLibraryArchive, confirmLibraryArchive, getLibraryArchiveReceipt }
