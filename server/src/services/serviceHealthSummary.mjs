/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const statuses = new Map([
  ['healthy', 'healthy'], ['connected', 'healthy'], ['available', 'healthy'],
  ['degraded', 'degraded'], ['partial', 'degraded'], ['configured', 'degraded'], ['circuit_open', 'degraded'],
  ['unhealthy', 'unhealthy'], ['error', 'unhealthy'], ['disconnected', 'unhealthy'], ['unavailable', 'unhealthy'],
  ['disabled', 'disabled'], ['not configured', 'not_configured'], ['not_configured', 'not_configured'],
]);

export function normalizeServiceHealthStatus(value) {
  return typeof value === 'string' ? statuses.get(value.toLowerCase()) ?? 'unknown' : 'unknown';
}

/** Pure observation summary. Does not run probes or change readiness/HTTP codes. */
export function summarizeServiceHealth(services) {
  const rows = Array.isArray(services) ? services : [];
  const counts = { total: rows.length, active: 0, healthy: 0, failed: 0, degraded: 0, unknown: 0, disabled: 0, notConfigured: 0 };
  for (const service of rows) {
    switch (normalizeServiceHealthStatus(service?.status)) {
      case 'healthy': counts.healthy++; break;
      case 'unhealthy': counts.failed++; break;
      case 'degraded': counts.degraded++; break;
      case 'disabled': counts.disabled++; break;
      case 'not_configured': counts.notConfigured++; break;
      default: counts.unknown++;
    }
  }
  counts.active = counts.total - counts.disabled - counts.notConfigured;
  const overall = counts.failed > 0 ? 'unhealthy' : counts.degraded > 0 ? 'degraded'
    : counts.unknown > 0 || counts.active === 0 ? 'unknown' : 'healthy';
  // Keep the existing field, but stop counting unknown/inactive rows as failures.
  return { overall, summary: { ...counts, unhealthy: counts.failed + counts.degraded } };
}
