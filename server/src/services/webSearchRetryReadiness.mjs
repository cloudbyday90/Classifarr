/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildImdbLookupRequest } from './webSearchEnrichmentRequests.mjs';
import { buildWebSearchProviderCacheIdentity } from './webSearchProviderCachePolicy.mjs';
import { webSearchPacingWait } from './webSearchPacingStore.mjs';
import { webSearchRequestCost } from './webSearchQuotaReservation.mjs';
import { WebSearchProviderContractError } from './webSearchProviderContract.mjs';

export function canReadWebSearchCandidateCache(candidate) {
  return candidate.status === 'available' || ['daily_quota_exhausted', 'monthly_quota_exhausted',
    'cooldown_active'].includes(candidate.skipReason);
}

function quotaWait(candidate, now) {
  const date = new Date(now), cost = webSearchRequestCost(candidate.providerKey, candidate.config);
  const nextDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  const nextMonth = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  return Math.max(0, (candidate.quota.dailyRemaining != null && candidate.quota.dailyRemaining < cost ? nextDay : now) - now,
    (candidate.quota.monthlyRemaining != null && candidate.quota.monthlyRemaining < cost ? nextMonth : now) - now,
    (new Date(candidate.config.cooldownUntil ?? 0).getTime() || 0) - now);
}

/** Read-only bounded hints, never authorization. The executor rechecks cache and admission. */
export async function createWebSearchRetryInspector(router, items) {
  if (!Array.isArray(items) || items.length > 50) throw new TypeError('invalid_retry_page');
  const candidates = (await router.getRouteCandidates({ purpose: 'metadata_enrichment' }))
    .filter(canReadWebSearchCandidateCache);
  const invalid = new Set();
  const keys = new Map(items.map(item => {
    try {
      return [item.queue_id, candidates.map(candidate => buildWebSearchProviderCacheIdentity({
        providerKey: candidate.providerKey, config: candidate.config, request: buildImdbLookupRequest(item) }).cacheKey)];
    } catch (error) {
      if (!(error instanceof WebSearchProviderContractError)) throw error;
      invalid.add(item.queue_id); return [item.queue_id, []];
    }
  }));
  const fresh = new Set(await router.executor.cacheStore.getFreshKeys([...keys.values()].flat()));
  let blockedUntil = 0;
  return async item => {
    // Let the normal per-item validation outcome handle malformed work without
    // preventing every other item in this page from progressing.
    if (invalid.has(item.queue_id)) return { ready: true, cached: false };
    if (keys.get(item.queue_id)?.some(key => fresh.has(key))) return { ready: true, cached: true };
    const now = Date.now();
    if (blockedUntil > now) return { ready: false, delayMs: blockedUntil - now };
    let delayMs = Infinity;
    for (const candidate of candidates) {
      const quotaDelay = quotaWait(candidate, now);
      const pacingDelay = await webSearchPacingWait(router.storage.db, candidate.providerKey, candidate.config.credentialContext);
      const delay = Math.max(quotaDelay, pacingDelay * 1000);
      if (!delay) return { ready: true, cached: false };
      delayMs = Math.min(delayMs, delay);
    }
    // Revisit configuration changes even when there is no usable provider.
    delayMs = Number.isFinite(delayMs) ? delayMs : 300_000;
    blockedUntil = now + delayMs;
    return { ready: false, delayMs };
  };
}
