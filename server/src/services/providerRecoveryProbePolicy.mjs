/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const PROBE_OUTCOMES = Object.freeze(['verified', 'rejected', 'rate_limited',
  'quota_exhausted', 'invalid_response', 'unavailable']);
const HTTP_DATE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

/** Retain bounded timing only. Unlike the UI parser, preserve waits beyond one day. */
export function providerProbeRetryHint(response, now = Date.now()) {
  const headers = response?.headers ?? {};
  const value = headers['retry-after'];
  let delay = 0;
  if (typeof value === 'string' && value.length <= 64) {
    delay = /^\d{1,10}$/.test(value) ? Number(value) * 1000
      : HTTP_DATE.test(value) ? Math.max(0, Date.parse(value) - now) : 0;
  }
  const reset = headers['x-ratelimit-reset'];
  const windows = typeof reset === 'string' && reset.length <= 128 ? reset.split(',') : [];
  for (const part of windows) {
    if (/^\d{1,10}$/.test(part.trim())) delay = Math.max(delay, Number(part.trim()) * 1000);
  }
  return Number.isFinite(delay) ? Math.min(30 * 86400000, delay) : 0;
}

export function providerProbeDelay(failures, retryAfterMs = 0, random = Math.random) {
  const count = Number.isSafeInteger(failures) ? Math.max(0, Math.min(10, failures)) : 0;
  const jitter = Math.max(0, Math.min(1, Number(random()) || 0));
  const base = Math.min(6 * 3600000, 15 * 60000 * 2 ** count * (1 + jitter * 0.2));
  const hint = Number.isFinite(retryAfterMs) ? Math.max(0, Math.min(30 * 86400000, retryAfterMs)) : 0;
  return Math.ceil(Math.max(base, hint));
}

export function normalizeProbeOutcome(outcome) {
  const category = PROBE_OUTCOMES.includes(outcome?.category) ? outcome.category : 'unavailable';
  return { category, verified: category === 'verified', retryAfterMs:
    Number.isFinite(outcome?.retryAfterMs) ? Math.max(0, Math.min(30 * 86400000, outcome.retryAfterMs)) : 0 };
}
