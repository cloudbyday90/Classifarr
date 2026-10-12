/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const statuses = new Map([
  ['healthy', 'healthy'], ['connected', 'healthy'], ['available', 'healthy'],
  ['degraded', 'degraded'], ['partial', 'degraded'], ['configured', 'degraded'], ['circuit_open', 'degraded'],
  ['unhealthy', 'unhealthy'], ['error', 'unhealthy'], ['disconnected', 'unhealthy'], ['unavailable', 'unhealthy'],
  ['disabled', 'disabled'], ['not configured', 'not_configured'], ['not_configured', 'not_configured'],
])
/** @param {unknown} value */
export function normalizeServiceHealthStatus(value) {
  return typeof value === 'string' ? statuses.get(value.toLowerCase()) ?? 'unknown' : 'unknown'
}

/** @param {unknown} services @param {{ observationAvailable?: boolean }} options */
export function getOverallHealth(services, { observationAvailable = true } = {}) {
  const rows = Array.isArray(services) ? services : []
  const counts = { total: rows.length, active: 0, healthy: 0, unhealthy: 0, degraded: 0, unknown: 0, disabled: 0, notConfigured: 0 }
  for (const service of rows) {
    switch (normalizeServiceHealthStatus(service?.status)) {
      case 'healthy': counts.healthy++; break
      case 'unhealthy': counts.unhealthy++; break
      case 'degraded': counts.degraded++; break
      case 'disabled': counts.disabled++; break
      case 'not_configured': counts.notConfigured++; break
      default: counts.unknown++
    }
  }
  counts.active = counts.total - counts.disabled - counts.notConfigured
  let status = 'unknown'
  let message = 'No health observations available'
  if (!observationAvailable) message = 'Health summary unavailable'
  else if (counts.unhealthy) {
    status = 'unhealthy'
    message = `${counts.unhealthy} service${counts.unhealthy > 1 ? 's' : ''} down`
  } else if (counts.degraded) {
    status = 'degraded'
    message = `${counts.degraded} service${counts.degraded > 1 ? 's' : ''} degraded`
  } else if (counts.unknown) message = 'Health status incomplete'
  else if (counts.active) { status = 'healthy'; message = 'All active services reported healthy' }
  else if (counts.total) message = 'No active services to assess'
  return { status, message, ...counts }
}
