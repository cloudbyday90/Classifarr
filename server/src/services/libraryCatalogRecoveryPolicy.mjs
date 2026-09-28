/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const CATALOG_REFRESH_MS = 6 * 60 * 60 * 1000;
export const CATALOG_MAX_ATTEMPTS = 5;
const transientReasons = new Set(['unreachable', 'timeout', 'rate_limited', 'provider_unavailable']);

export function catalogRecoveryPlan({ reason, httpStatus, attempts, retryAfter = null, random = Math.random }) {
  if (reason === 'complete') return { state: 'scheduled', delayMs: CATALOG_REFRESH_MS };
  if (['authentication', 'forbidden'].includes(reason)) return { state: 'waiting_configuration', delayMs: null };
  if (retryAfter?.blocked || !transientReasons.has(reason) || [501, 505].includes(httpStatus)) return { state: 'needs_review', delayMs: null };
  if (attempts >= CATALOG_MAX_ATTEMPTS) return { state: 'cooldown', delayMs: Math.max(CATALOG_REFRESH_MS, retryAfter?.delayMs ?? 0) };
  const base = Math.min(60 * 60 * 1000, 5 * 60 * 1000 * 2 ** Math.max(0, attempts - 1));
  const jitter = Math.min(1, Math.max(0, Number(random()) || 0));
  return { state: 'scheduled', delayMs: Math.max(Math.round(base * (1 + jitter / 2)), retryAfter?.delayMs ?? 0) };
}

/** Database timestamps keep admission independent of application clock skew. */
export function admitCatalogRecovery(row) {
  if (!row || row.configured !== true) return { allowed: false, reason: 'not_configured' };
  if (row.source_revision == null || String(row.current_revision) !== String(row.source_revision)) return { allowed: true };
  if (!['scheduled', 'cooldown'].includes(row.recovery_state)) return { allowed: false, reason: row.recovery_state === 'waiting_configuration' ? 'waiting_configuration' : 'needs_review' };
  const due = new Date(row.next_attempt_at).getTime(), now = new Date(row.observed_at).getTime();
  return Number.isFinite(due) && Number.isFinite(now) && row.next_attempt_at && due <= now
    ? { allowed: true } : { allowed: false, reason: 'not_due' };
}
