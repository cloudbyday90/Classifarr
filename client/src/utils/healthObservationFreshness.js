/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeServiceHealthStatus } from './serviceHealthSummary'

/**
 * @template {{status?: unknown, trend?: string | null}} T
 * @param {T} service
 * @param {{freshness?: {state?: string, reason?: string, checkedAt?: string | null,
 * expiresAt?: string | null, ageMs?: number | null, maxAgeMs?: number}} | undefined} detail
 */
export function applyHealthObservation(service, detail) {
  const observedStatus = normalizeServiceHealthStatus(service.status)
  const inactive = observedStatus === 'disabled' || observedStatus === 'not_configured'
  const freshness = detail?.freshness
  const current = freshness?.state === 'fresh'
    && typeof freshness.ageMs === 'number' && Number.isFinite(freshness.ageMs) && freshness.ageMs >= 0
    && typeof freshness.maxAgeMs === 'number' && Number.isFinite(freshness.maxAgeMs) && freshness.maxAgeMs > freshness.ageMs
  const status = inactive || current ? observedStatus : 'unknown'
  return { ...service, status, observedStatus,
    freshness: inactive ? { ...freshness, state: 'inactive' }
      : current || freshness?.state === 'stale' ? freshness
        : { ...freshness, state: 'unknown' },
    trend: status === observedStatus ? service.trend : null }
}

/** @param {string} state @param {string} reason */
export function healthFreshnessGuidance(state, reason) {
  if (state === 'stale') return 'Check overdue. Use Refresh to request a new check. If it stays overdue, review the heartbeat and server logs.'
  if (state !== 'unknown') return ''
  if (reason === 'check_time_future' || reason === 'check_time_invalid') {
    return 'Check time cannot be verified. Review the server clock and logs, then use Refresh.'
  }
  return 'Check time unavailable. Use Refresh; if this persists, confirm the server is up to date and review its logs.'
}
