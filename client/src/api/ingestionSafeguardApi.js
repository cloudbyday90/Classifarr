/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { apiClient, getDataRequest } from './core'

export function previewIngestionSafeguardRepair() {
  return getDataRequest('/libraries/ingestion-safeguards')
}
export function repairIngestionSafeguards(token) {
  return apiClient.post('/libraries/ingestion-safeguards', { token, confirm: true },
    { timeout: 150000, skipAutomaticRetry: true })
}
export default { previewIngestionSafeguardRepair, repairIngestionSafeguards }
