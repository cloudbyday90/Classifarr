/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const RETRY_READINESS_CATEGORIES = Object.freeze([
  'cached_ready', 'provider_ready', 'provider_wait', 'settings_blocked', 'scheduled', 'held',
]);

/** Queue gates precede cache hints; a ready hint never authorizes execution. */
export function classifyRetryReadinessRow(row, now) {
  if (!row.item_eligible) return { reason: 'held' };
  if (row.credentials_blocked) return { reason: 'settings_blocked' };
  const due = Math.max(new Date(row.next_attempt_at ?? 0).getTime(), new Date(row.monthly_due_at ?? 0).getTime());
  if (due > now) return { reason: 'scheduled', retryAt: due };
  const cooldown = new Date(row.cooldown_until ?? 0).getTime();
  if (cooldown > now) return { reason: 'provider_wait', retryAt: cooldown };
  if (!row.candidate) return { reason: 'held' };
  return null;
}

export async function summarizeRetryReadiness(pages, inspectPage, now = Date.now(), scope = 'web_search') {
  if (!['web_search', 'omdb'].includes(scope)) throw new TypeError('unsupported_readiness_scope');
  const counts = Object.fromEntries(RETRY_READINESS_CATEGORIES.map(key => [key, 0]));
  let earliestRetry = Infinity;
  for (const page of pages) {
    const candidates = page.rows.filter(row => !classifyRetryReadinessRow(row, now));
    const inspect = candidates.length ? await inspectPage(candidates) : null;
    for (const row of page.rows) {
      const gate = classifyRetryReadinessRow(row, now);
      const result = gate ?? await inspect(row);
      if (!Object.hasOwn(counts, result.reason)) throw new TypeError('invalid_readiness_reason');
      counts[result.reason]++;
      const retryAt = result.retryAt ?? (result.reason === 'provider_wait' ? now + result.delayMs : Infinity);
      if (Number.isFinite(retryAt) && retryAt > now) earliestRetry = Math.min(earliestRetry, retryAt);
    }
  }
  return {
    version: 1, scope, observedAt: new Date(now).toISOString(),
    counts, inspected: Object.values(counts).reduce((sum, count) => sum + count, 0),
    hasMore: pages.some(page => page.hasMore), limitPerQueue: 50,
    earliestRetryAt: Number.isFinite(earliestRetry) ? new Date(earliestRetry).toISOString() : null,
  };
}
