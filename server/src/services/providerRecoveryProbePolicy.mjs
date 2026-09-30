/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { omdbPacingDelay } from './omdbPacingPolicy.mjs';
export const PROBE_OUTCOMES = Object.freeze(['verified', 'rejected', 'rate_limited',
  'quota_exhausted', 'invalid_response', 'unavailable']);

/** Retain bounded timing only. Unlike the UI parser, preserve waits beyond one day. */
export function providerProbeRetryHint(response, now = Date.now()) {
  return omdbPacingDelay(response, now) * 1000;
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
