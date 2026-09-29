/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readOmdbQuotaReadiness } from './omdbQuotaStore.mjs';
import { summarizeRetryReadiness } from './retryReadinessSummary.mjs';

/** No OMDb service/HTTP dependency: quota and queue observation cannot spend. */
export async function summarizeOmdbRetryReadiness(client, page, observedAt) {
  const quota = await readOmdbQuotaReadiness(client);
  const report = await summarizeRetryReadiness([page], async () => async item => {
    if (!item.imdb_id && !item.title) return { reason: 'held' };
    if (quota.status === 'available') return { reason: 'provider_ready' };
    if (quota.status === 'limit_reached') return {
      reason: 'provider_wait', retryAt: quota.resetAt ? Date.parse(quota.resetAt) : null,
    };
    return { reason: 'settings_blocked' };
  }, observedAt, 'omdb');
  // A queue due/cooldown time is not a usable estimate before the local budget
  // resets. Missing reset provenance or configuration means no timed promise.
  let earliestRetryAt = report.earliestRetryAt;
  if (quota.status === 'limit_reached') {
    earliestRetryAt = earliestRetryAt && quota.resetAt
      ? new Date(Math.max(Date.parse(earliestRetryAt), Date.parse(quota.resetAt))).toISOString() : null;
  } else if (quota.status !== 'available') earliestRetryAt = null;
  return { ...report, earliestRetryAt, quota };
}
