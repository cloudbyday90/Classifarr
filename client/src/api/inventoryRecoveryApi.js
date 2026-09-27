/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getDataRequest } from './core'

export function getInventoryRecovery(afterId = 0) {
  return getDataRequest('/inventory-recovery', { params: afterId ? { afterId } : {}, skipAutomaticRetry: true })
}

export function getInventoryRecoveryPlexLink(itemId, caseId) {
  return getDataRequest(`/inventory-recovery/${encodeURIComponent(itemId)}/${encodeURIComponent(caseId)}/plex-link`, { skipAutomaticRetry: true })
}

export default { getInventoryRecovery, getInventoryRecoveryPlexLink }
