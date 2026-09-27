/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const MAX_DELAY = 30 * 86400000;
const HTTP_DATE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

/** Preserve timing only, never arbitrary upstream headers; operational cap is 30 days. */
export function readTmdbRetryAfter(error, now = Date.now()) {
    if (![429, 503].includes(error?.response?.status)) return null;
    if (Number.isFinite(error.retryAfterMs) && error.retryAfterMs >= 0) return Math.min(MAX_DELAY, error.retryAfterMs);
    const value = error.response.headers?.['retry-after'];
    if (typeof value !== 'string' || value.length > 64) return null;
    const delay = /^\d{1,10}$/.test(value) ? Number(value) * 1000 : HTTP_DATE.test(value) ? Date.parse(value) - now : NaN;
    return Number.isFinite(delay) ? Math.min(MAX_DELAY, Math.max(0, delay)) : null;
}
