/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const RETRY_READINESS_SEGMENTS = Object.freeze([
  { id: 'cached_ready', label: 'Cached results ready', color: '#6ee7b7' },
  { id: 'provider_ready', label: 'Provider ready', color: '#93c5fd' },
  { id: 'provider_wait', label: 'Provider waiting', color: '#fcd34d' },
  { id: 'settings_blocked', label: 'Provider setup needed', color: '#f9a8d4' },
  { id: 'scheduled', label: 'Scheduled later', color: '#c4b5fd' },
  { id: 'held', label: 'Held by safeguards', color: '#cbd5e1' },
])

export function parseRetryReadiness(value) {
  if (value?.version !== 1 || value.scope !== 'web_search' || value.limitPerQueue !== 50 ||
      typeof value.hasMore !== 'boolean' || typeof value.observedAt !== 'string' ||
      !Number.isFinite(Date.parse(value.observedAt)) || !Number.isSafeInteger(value.inspected) ||
      value.inspected < 0 || value.inspected > 100) return null
  const counts = {}
  for (const { id } of RETRY_READINESS_SEGMENTS) {
    const count = value.counts?.[id]
    if (!Number.isSafeInteger(count) || count < 0 || count > 100) return null
    counts[id] = count
  }
  if (Object.values(counts).reduce((sum, count) => sum + count, 0) !== value.inspected) return null
  if (value.earliestRetryAt !== null && (typeof value.earliestRetryAt !== 'string' ||
      !Number.isFinite(Date.parse(value.earliestRetryAt)))) return null
  return { version: 1, scope: 'web_search', observedAt: value.observedAt, counts,
    inspected: value.inspected, hasMore: value.hasMore, limitPerQueue: 50,
    earliestRetryAt: value.earliestRetryAt }
}

export function retryReadinessNextStep(report) {
  if (!report.inspected) return { text: 'No pending web-search retries. No action needed.' }
  if (report.counts.settings_blocked) return {
    text: 'Providers are off, unconfigured or unavailable. Keep them off if intentional.',
    label: 'Review web-search settings', to: { path: '/settings', query: { tab: 'web-search' } },
  }
  if (report.counts.held) return {
    text: 'Some retries do not meet item safeguards. Review library status before taking action.',
    label: 'Review libraries', to: '/libraries',
  }
  if (report.counts.cached_ready + report.counts.provider_ready) return {
    text: 'Ready for the worker to recheck. No manual retry needed.',
  }
  return { text: 'Waiting for retry timing or provider limits. No manual retry needed.' }
}
